# EDMS upload and CORS correction

This update addresses two conditions that could make document uploads fail with a browser-side CORS/network message.

## What changed

- CORS now always includes `https://web-a2z.com` and `https://www.web-a2z.com`, even when Render's `CORS_ORIGINS` variable is present but contains only one of those variants.
- The `web-a2z.com` production domain and its first-level HTTPS subdomains are accepted by a restrictive CORS origin pattern. Arbitrary external origins are not allowed.
- CORS now wraps the complete ASGI app, so unhandled backend errors also include CORS response headers. This lets the browser receive a real API error instead of reporting only a network/CORS failure.
- Admin and employee upload routes convert common Supabase storage failures into readable HTTP responses and write the underlying exception to Render logs.
- On Supabase Free, EDMS rejects individual files larger than `50,000,000` bytes (50 MB decimal) before attempting the Storage upload. The 500 MiB `UPLOAD_MAX_SIZE` remains in place as the general application ceiling for storage providers that permit larger files.
- `SUPABASE_MAX_FILE_SIZE` is configurable for a paid Supabase plan with a larger global and bucket limit.

## Render environment

Keep these values for Supabase Free:

```ini
STORAGE_PROVIDER=supabase
SUPABASE_BUCKET=edms-files
UPLOAD_MAX_SIZE=524288000
SUPABASE_MAX_FILE_SIZE=50000000
CORS_ORIGINS=https://web-a2z.com,https://www.web-a2z.com,https://employee-document-management-system.vercel.app
```

Do not paste real database passwords, service-role keys, or other secrets into GitHub. Keep `SUPABASE_SERVICE_ROLE_KEY` configured only as a private Render environment variable.

## Supabase dashboard checks

1. Open Supabase Dashboard → Storage → Settings.
2. Set the global file-size limit to the Free-plan maximum of 50 MB.
3. Open the private `edms-files` bucket and ensure its per-bucket limit is not lower than the file size you intend to upload. The bucket cannot exceed the global limit or the plan maximum.
4. Confirm the project has remaining Storage quota. The Free plan includes 1 GB of Storage; reaching that quota can also prevent new uploads.

## Expected behaviour

- Files up to 50 MB can be uploaded, subject to remaining project storage and bucket restrictions.
- Files over 50 MB are rejected with a clear message before EDMS sends them to Supabase.
- On a paid plan, increase `SUPABASE_MAX_FILE_SIZE` only after raising the Supabase global and `edms-files` bucket limits to the same or a higher value.
- No database migration is required.

This does not convert Supabase Free into large-file storage. A file larger than 50 MB requires a storage provider/plan with a higher per-file limit.
