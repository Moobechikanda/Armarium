# Armarium Setup

## Create an Administrator

Do not create administrators through public signup. Sign in with Google using the admin's account; the database creates a student profile. Then create/promote its app profile in the Supabase Dashboard SQL Editor, replacing the email:

```powershell
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'admin'
FROM auth.users
WHERE lower(email) = lower('admin@example.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

Public signup always creates student accounts. The app has no administrator signup page; administrators use the regular sign-in page after being invited. Admin-only screens and database policies check the profile role.

## Google Sign-In

1. In Google Cloud Console, create an OAuth client with application type **Web application**.
2. In Supabase Dashboard > Authentication > Sign In / Providers > Google, enable Google and enter the client ID and client secret. Supabase shows the callback URI to add under the Google OAuth client's **Authorized redirect URIs**; it looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard > Authentication > URL Configuration, add the app callback URLs, including local development (`http://localhost:5173/dashboard`, `http://localhost:5174/dashboard`) and the deployed Cloudflare Pages URL (`https://<project>.pages.dev/dashboard`).
4. The app's **Continue with Google** button uses Google's hosted sign-in. New users receive the student role from the database trigger. Promote admins only with the Supabase Dashboard SQL above; public signup cannot grant an admin role.

## R2 Paper Storage

Keep Supabase Postgres for accounts, catalogue, metadata, study groups, and search. The app uses a private Cloudflare R2 bucket for files when `VITE_R2_WORKER_URL` is set; without it, it continues using Supabase Storage so current files remain readable. Supabase Free includes 1 GB of object storage. R2's published free tier is 10 GB-month and has operation limits; check Cloudflare's current terms before relying on it for all traffic.

1. Create a **private** R2 bucket in Cloudflare Dashboard > R2. Create an R2 API token with Object Read & Write access for that bucket. Do not enable public bucket access.
2. Set the bucket CORS policy. Replace the origins with your actual local and Pages origins:

```json
[
	{
		"AllowedOrigins": ["http://localhost:5173", "http://localhost:5174", "https://<project>.pages.dev"],
		"AllowedMethods": ["GET", "PUT", "HEAD"],
		"AllowedHeaders": ["Content-Type"],
		"ExposeHeaders": ["ETag"],
		"MaxAgeSeconds": 3600
	}
]
```

3. From `project/r2-worker`, run `npm install` and `npx wrangler login`. Set Worker secrets with `npx wrangler secret put` for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `APP_ORIGINS` (comma-separated exact app origins). Never put the service-role key or R2 secret in a `VITE_` variable or commit them.
4. Deploy the Worker with `npm run deploy`. Set `VITE_R2_WORKER_URL` to its `workers.dev` URL in Cloudflare Pages project settings and in the local ignored `project/.env.local` when testing. Set the Supabase Edge Function secret `R2_STORAGE_WORKER_URL` to the same Worker URL so the AI solver can read R2 resources.
5. From `project/`, link this CLI directory to the hosted project with `npx supabase link --project-ref <project-ref>` (find the ref in Supabase Dashboard > Project Settings > General), then run `npx supabase db push`. This adds each resource's storage provider and creates student profiles automatically for Google OAuth users. The repository-root CLI link does not link `project/`.
6. To copy existing papers, notes, books and answer attachments from local Supabase into R2 and the hosted metadata database, fill the ignored `project/r2-worker/.env.r2.local` using `.env.r2.example`. Keep the local Supabase Docker stack running as the source. First run `node --env-file=.env.r2.local scripts/migrate-resource-files.mjs --dry-run` from `project/r2-worker`, then run the same command without `--dry-run`. The transfer is resumable; it streams files and skips objects already in R2. Keep this file private and never paste its values into chat.

## Configure the AI Provider

The AI function requires an OpenAI API key. Create the ignored local file `.env.functions.local` using `.env.functions.example` as a template and add the key there. Do not commit the local file or place the key in a `VITE_` variable.

The solver defaults to OpenAI's current flagship alias, `gpt-6-astra`. Set `OPENAI_MODEL` in `.env.functions.local` to override it. Aliases follow newer model versions; use a dated snapshot instead when you need reproducible outputs.

With Docker and the local Supabase stack running, serve the function in a terminal:

```powershell
npm run functions:serve
```

Start the Vite app in another terminal with `npm run dev`. If no provider key is configured, the solver reports that configuration is missing instead of returning a fabricated answer.