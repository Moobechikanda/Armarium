const MAX_TEXT_PAGES = 40;
const MAX_OCR_PAGES = 5;
const MIN_TEXT_LENGTH = 80;

async function ocr(images: (HTMLCanvasElement | File)[]): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const parts: string[] = [];
    for (const image of images) parts.push((await worker.recognize(image)).data.text);
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}

// Runs after the upload so slow OCR never blocks or fails the upload itself.
export function saveExtractedText(paperId: string, file: File, save: (text: string) => PromiseLike<unknown>) {
  const timeout = new Promise<string>(resolve => setTimeout(() => resolve(''), 180000));
  void Promise.race([extractPdfText(file), timeout]).then(text => text && save(text)).catch(() => undefined);
  return paperId;
}

// Uses the PDF text layer and falls back to OCR for scans and photos.
export async function extractPdfText(file: File): Promise<string> {
  const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 200000);
  try {
    if (/^image\//.test(file.type)) return clean(await ocr([file]));
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return '';

    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

    const pages: string[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_TEXT_PAGES); number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
    }
    const text = clean(pages.join('\n'));
    if (text.length >= MIN_TEXT_LENGTH) return text;

    const canvases: HTMLCanvasElement[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_OCR_PAGES); number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      canvases.push(canvas);
    }
    return clean(await ocr(canvases));
  } catch {
    return '';
  }
}
