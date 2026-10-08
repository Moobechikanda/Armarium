import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function authenticatedSubject(authorization: string): string | null {
  const token = authorization.match(/^Bearer\s+([^.]+\.([^.]+)\.[^.]+)$/i)?.[1];
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; role?: unknown };
    return claims.role === 'authenticated' && typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "AI solver storage is not configured" }, 503);

    const userAuthorization = req.headers.get("Authorization") || "";
    const userId = authenticatedSubject(userAuthorization);
    if (!userId) return jsonResponse({ error: "Sign in to use the AI solver" }, 401);

    const serviceClient = createClient(supabaseUrl, serviceKey);

    async function privateFileUrl(filePath: string, provider: string) {
      if (provider === "r2") {
        const workerUrl = Deno.env.get("R2_STORAGE_WORKER_URL");
        if (!workerUrl) return null;
        const response = await fetch(`${workerUrl.replace(/\/$/, "")}/download-url`, {
          method: "POST",
          headers: { Authorization: userAuthorization, "Content-Type": "application/json" },
          body: JSON.stringify({ key: filePath }),
        });
        if (!response.ok) return null;
        const result = await response.json() as { url?: string };
        return result.url || null;
      }
      const { data, error } = await serviceClient.storage.from("papers").createSignedUrl(filePath, 120);
      return error ? null : data?.signedUrl || null;
    }

    const { data: studentProfile } = await serviceClient
      .from("profiles")
      .select("programme_id, study_year")
      .eq("id", userId)
      .maybeSingle();
    if (!studentProfile) return jsonResponse({ error: "Complete your student profile before using the AI solver" }, 404);

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) return jsonResponse({ error: "AI solver is not configured. Set OPENAI_API_KEY in the local Supabase function environment." }, 503);
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-6-astra";

    const body = await req.json();
    const paperId = typeof body.paper_id === "string" ? body.paper_id : null;
    const requestedCourseId = typeof body.course_id === "string" ? body.course_id : null;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const mode = body.mode === "question_answer" ? "question_answer" : "solve";
    if (!paperId && !question) return jsonResponse({ error: "Attach a document or enter a question" }, 400);

    let paperTitle = "";
    let context = "";
    const inputContent: Array<Record<string, unknown>> = [];
    let courseId = requestedCourseId;
    let totalFileBytes = 0;

    if (studentProfile.programme_id) {
      const { data: enrolledProgramme } = await serviceClient
        .from("programmes")
        .select("name, ai_guidance, parent_programme_id, schools(name, ai_guidance)")
        .eq("id", studentProfile.programme_id)
        .maybeSingle();
      if (enrolledProgramme) {
        const enrolledSchool = Array.isArray(enrolledProgramme.schools) ? enrolledProgramme.schools[0] : enrolledProgramme.schools;
        context += `Student programme: ${enrolledProgramme.name}. Year of study: ${studentProfile.study_year || "not specified"}.\n`;
        if (enrolledSchool?.ai_guidance) context += `Student school guidance: ${enrolledSchool.ai_guidance}\n`;
        if (enrolledProgramme.ai_guidance) context += `Student programme guidance: ${enrolledProgramme.ai_guidance}\n`;
        if (enrolledProgramme.parent_programme_id) {
          const { data: parentProgramme } = await serviceClient.from("programmes").select("name, ai_guidance").eq("id", enrolledProgramme.parent_programme_id).maybeSingle();
          if (parentProgramme?.ai_guidance) context += `Parent programme guidance (${parentProgramme.name}): ${parentProgramme.ai_guidance}\n`;
        }
      }
    }

    async function attachResourceFile(filePath: string | null, fileName: string | null, storageProvider: string) {
      if (!filePath || inputContent.length >= 8 || totalFileBytes >= 20 * 1024 * 1024) return;
      const fileUrl = await privateFileUrl(filePath, storageProvider);
      if (!fileUrl) return;
      const response = await fetch(fileUrl);
      if (!response.ok) return;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length + totalFileBytes > 20 * 1024 * 1024) return;
      totalFileBytes += bytes.length;
      const name = fileName || "course-reference";
      if (/\.pdf$/i.test(name)) {
        inputContent.push({ type: "input_file", filename: name, file_data: `data:application/pdf;base64,${encodeBase64(bytes)}` });
      } else if (/\.(png|jpe?g|webp)$/i.test(name)) {
        const mime = name.toLowerCase().endsWith(".png") ? "image/png" : name.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
        inputContent.push({ type: "input_image", image_url: `data:${mime};base64,${encodeBase64(bytes)}` });
      } else if (/\.(txt|md)$/i.test(name)) {
        inputContent.push({ type: "input_text", text: `Reference file ${name}:\n${new TextDecoder().decode(bytes).slice(0, 12000)}` });
      }
    }

    async function loadCourseStudyContext(selectedCourseId: string) {
      courseId = selectedCourseId;
      const { data: course } = await serviceClient
        .from("courses")
        .select("id, course_code, title, description, ai_guidance, school_id, programme_id, schools(name, ai_guidance), programmes(name, ai_guidance)")
        .eq("id", selectedCourseId)
        .maybeSingle();
      if (!course) return;
      const school = Array.isArray(course.schools) ? course.schools[0] : course.schools;
      const programme = Array.isArray(course.programmes) ? course.programmes[0] : course.programmes;
      context += `\nCourse: ${course.course_code} — ${course.title}\nSchool: ${school?.name || "not specified"}\nProgramme: ${programme?.name || "not specified"}\nCourse description: ${course.description || ""}\n`;
      if (school?.ai_guidance) context += `School/lecturer method: ${school.ai_guidance}\n`;
      if (programme?.ai_guidance) context += `Programme method: ${programme.ai_guidance}\n`;
      if (course.ai_guidance) context += `Course/lecturer method: ${course.ai_guidance}\n`;

      const [{ data: notes }, { data: books }] = await Promise.all([
        serviceClient.from("notes").select("title, content, file_path, file_name, storage_provider").eq("course_id", selectedCourseId).order("created_at", { ascending: false }).limit(5),
        serviceClient.from("recommended_books").select("title, author, description, file_path, file_name, storage_provider").eq("course_id", selectedCourseId).order("created_at", { ascending: false }).limit(5),
      ]);
      for (const note of notes || []) {
        context += `\nCourse note: ${note.title}\n${(note.content || "").slice(0, 6000)}\n`;
        await attachResourceFile(note.file_path, note.file_name, note.storage_provider || "supabase");
      }
      for (const book of books || []) {
        context += `\nPrescribed/recommended text: ${book.title} by ${book.author}. ${book.description || ""}\n`;
        await attachResourceFile(book.file_path, book.file_name, book.storage_provider || "supabase");
      }
    }

    if (paperId) {
      const { data: paper, error: paperError } = await serviceClient
        .from("papers")
        .select("id, course_id, title, paper_type, year, file_path, file_name, storage_provider")
        .eq("id", paperId)
        .maybeSingle();
      if (paperError || !paper) return jsonResponse({ error: "Course document not found" }, 404);
      if (!paper.file_path) return jsonResponse({ error: "This course document has no attached file to analyze" }, 400);

      paperTitle = paper.title;
      await loadCourseStudyContext(paper.course_id);
      context += `\nSelected document: ${paper.title}\nType: ${paper.paper_type}\nYear: ${paper.year || "Not supplied"}\n`;

      const fileUrl = await privateFileUrl(paper.file_path, paper.storage_provider || "supabase");
      if (!fileUrl) return jsonResponse({ error: "Could not access the uploaded document" }, 500);
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) return jsonResponse({ error: "Could not read the uploaded document" }, 502);
      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      if (bytes.byteLength > 20 * 1024 * 1024) return jsonResponse({ error: "The AI solver accepts files up to 20 MB" }, 413);
      totalFileBytes += bytes.byteLength;

      const fileName = paper.file_name || "course-document";
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith(".pdf")) {
        inputContent.push({ type: "input_file", filename: fileName, file_data: `data:application/pdf;base64,${encodeBase64(bytes)}` });
      } else if (/\.(png|jpe?g|webp)$/i.test(lowerName)) {
        const mimeType = lowerName.endsWith(".png") ? "image/png" : lowerName.endsWith(".webp") ? "image/webp" : "image/jpeg";
        inputContent.push({ type: "input_image", image_url: `data:${mimeType};base64,${encodeBase64(bytes)}` });
      } else if (/\.(txt|md)$/i.test(lowerName)) {
        const text = new TextDecoder().decode(bytes).slice(0, 50000);
        inputContent.push({ type: "input_text", text: `Document text:\n${text}` });
      } else {
        return jsonResponse({ error: "Unsupported file type. Upload a PDF, text/Markdown file, or image." }, 415);
      }
    } else if (requestedCourseId) {
      await loadCourseStudyContext(requestedCourseId);
    }

    const systemPrompt = mode === "question_answer"
      ? "You are Armarium, a patient study tutor. Explain concepts accurately, show reasoning, and ask a clarifying question when the prompt is ambiguous. Follow provided school, programme, and course guidance and the methods used in supplied notes/texts before applying a generic method. If instructions conflict, explain the conflict. Do not claim affiliation with an institution."
      : "You are Armarium, a careful study assistant. Follow provided school, programme, and course guidance and the methods used in supplied notes/texts before applying a generic method. Solve the attached material step by step, preserve question numbering, and point out ambiguity. If instructions conflict, explain the conflict. Do not claim affiliation with an institution.";
    const questionText = mode === "question_answer" ? `Student question:\n${question}` : "Solve the attached material and explain each answer.";
    const userContent = [{ type: "input_text", text: `${context}\n\n${questionText}` }, ...inputContent];

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: openAiModel,
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: userContent },
        ],
        max_output_tokens: 5000,
      }),
    });

    if (!aiResponse.ok) {
      console.error("OpenAI response error", aiResponse.status, await aiResponse.text());
      return jsonResponse({ error: "The AI provider could not process this request. Try again later." }, 502);
    }

    const aiData = await aiResponse.json();
    const solution = typeof aiData.output_text === "string"
      ? aiData.output_text
      : (aiData.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
        .filter((item: { type?: string }) => item.type === "output_text")
        .map((item: { text?: string }) => item.text || "")
        .join("\n");
    if (!solution) return jsonResponse({ error: "The AI provider returned an empty response" }, 502);

    if (paperId) {
      const { error: saveError } = await serviceClient.from("ai_solutions").insert({
        paper_id: paperId,
        content: solution,
        requested_by: userId,
      });
      if (saveError) console.error("Could not save AI solution", saveError.message);
    }

    return jsonResponse({ solution, paper_title: paperTitle, model: openAiModel });
  } catch (error) {
    console.error("AI solver error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected AI solver error" }, 500);
  }
});
