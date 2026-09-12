# Public document delivery — V15

Clean public document URLs are now served by a Vercel Edge Function which reads
the document record from Supabase and streams the object directly from Supabase
Storage. Render is not in the public-document request path.

Browser:
`https://www.web-a2z.com/<directory>/<path>`

Vercel rewrite:
`/<directory>/<path>` -> `/api/public-document?directory=...&filePath=...`

Vercel Function:
Supabase REST metadata lookup -> Supabase Storage object -> browser.

Required Vercel server-side environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET` (normally `edms-files`)

Do not prefix the service-role key with `VITE_`.

Token-based legacy share URLs remain on the existing authenticated/backend flow.
Normal login, uploads, extraction, permissions, downloads and admin functions are
not changed by this public-path optimization.
