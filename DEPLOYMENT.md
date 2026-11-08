# EDMS Free Online Deployment

## Architecture

- GitHub — source code
- Vercel Hobby — React/Vite frontend
- Render Free Web Service — FastAPI backend
- Supabase Free — PostgreSQL database + private Storage bucket

The backend stores documents in Supabase Storage. Render's local filesystem is **not** used for permanent documents.

## 0. Important

The cleaned deployment package contains **no real `.env` file, passwords, Supabase keys, virtual environment, node_modules, or local uploaded files**.

If the original `backend/.env` was ever committed to a public GitHub repository, rotate the exposed database password and `SECRET_KEY` before deploying.

## 1. Create Supabase

Create one Supabase project.

### Database

Use the PostgreSQL connection string from:

**Supabase Dashboard → Connect → PostgreSQL**

For Render, use the Supabase Session Pooler connection (the `aws-...pooler.supabase.com` hostname, normally port 5432) when IPv4 compatibility is needed. The backend now enforces TLS (`sslmode=require`) for remote PostgreSQL connections, so the URL does not need a separate `sslmode` query parameter.

Set:

```text
DATABASE_URL=<your Supabase PostgreSQL connection string>
```

The database is used by FastAPI/SQLAlchemy.

### Storage

Create a bucket:

```text
edms-files
```

Keep it **Private**.

Do not create public URLs for employee documents.

Get:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side service role key>
```

The service-role key goes **only in Render**.

Supabase Free projects currently have a 50 MB maximum individual file-size limit. Pro and higher plans can raise the global limit substantially. To accept files larger than 50 MB, upgrade the Supabase plan, raise the global Storage file-size limit, and set the `edms-files` bucket limit to the desired size. The application is configured for up to 500 MiB per file, but Supabase remains the final authority.

## 2. Initialize the database

The application creates its base tables on first startup.

For a clean new Supabase database:

1. Deploy the backend once.
2. Let `/health` become healthy.
3. If your database needs the consolidated migration, open Supabase SQL Editor.
4. Run `backend/migration.sql`.

Do not run old migration files from earlier versions.

## 3. Push the cleaned project to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Prepare EDMS for free online deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit:

```text
backend/.env
frontend/.env
backend/venv/
frontend/node_modules/
storage/
```

They are already ignored by `.gitignore`.

## 4. Deploy backend on Render

The project pins Python 3.12.8 using `backend/.python-version` and `PYTHON_VERSION` in `render.yaml`, avoiding unexpected runtime changes.

Open Render and create:

**New → Web Service**

Connect your GitHub repository.

Use:

```text
Root Directory: backend
Runtime: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check Path: /health
Instance Type: Free
```

The repository `render.yaml` also sets `PYTHON_VERSION=3.12.8`, `UPLOAD_MAX_SIZE=524288000`, and `ZIP_MAX_FILES=10000`. For an existing manually-created Render service, update those environment variables in **Render → Environment** as well; editing `render.yaml` alone does not necessarily overwrite dashboard-managed values.

Add environment variables:

```text
DATABASE_URL=<Supabase PostgreSQL connection string>
SECRET_KEY=<new long random secret>
JWT_ALGORITHM=HS256
TOKEN_EXPIRE_MINUTES=60

CORS_ORIGINS=https://YOUR-APP.vercel.app

STORAGE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role key>
SUPABASE_BUCKET=edms-files

UPLOAD_MAX_SIZE=524288000
ZIP_MAX_FILES=10000
ZIP_MAX_UNCOMPRESSED_SIZE=2147483648

ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong admin password>
ADMIN_NAME=System Administrator
```

After deployment, copy the Render URL, for example:

```text
https://edms-api-xxxx.onrender.com
```

Test:

```text
https://edms-api-xxxx.onrender.com/health
```

You should get:

```json
{"status":"healthy"}
```

## 5. Deploy frontend on Vercel

Create a new Vercel project from the same GitHub repository.

Set:

```text
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Add this environment variable:

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Deploy.

Vercel will give you a URL such as:

```text
https://your-edms.vercel.app
```

## 6. Update Render CORS

Go back to Render and change:

```text
CORS_ORIGINS=https://your-edms.vercel.app
```

Save/redeploy the backend.

If you later add a second frontend domain, use:

```text
CORS_ORIGINS=https://your-edms.vercel.app,https://your-custom-domain.com
```

## 7. First login

The backend creates the administrator automatically on first startup using:

```text
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_NAME
```

Login using that account.

Immediately verify:

- Admin dashboard
- Registration approval
- Employee registration
- Read-only employee role
- Document upload
- Supabase Storage upload
- Document view/download
- ZIP upload
- Admin document sharing
- Storage requests
- Excel export

## 8. Supabase Storage verification

After uploading a document:

**Supabase → Storage → edms-files**

You should see paths similar to:

```text
employee_directory/unique-file.pdf
admin/archive_xxxxx/file.pdf
```

The bucket should remain private.

The browser never receives the service-role key.

## 9. Free-tier limitations

Render Free web services spin down after 15 minutes without traffic. The next request can take roughly a minute while the service starts again.

Supabase Free currently includes:

- 500 MB database per project
- 1 GB Storage
- 5 GB egress

Vercel Hobby is free for personal/non-commercial use under its current terms.

This setup is suitable for a demo, portfolio, college project, prototype, or light internal testing. It is not the right configuration for a business-critical production system with strict uptime/backup requirements.

## 10. Recommended final structure

```text
EDMS-Online-Deploy-Free-Ready/
├── backend/
│   ├── app/
│   ├── migration.sql
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── vercel.json
│   └── .env.example
├── .gitignore
├── render.yaml
├── DEPLOYMENT.md
└── README.md
```


## Fast clean public document URLs

The production frontend keeps the clean public URL for both **View** and **Copy Link**.
For example:

`https://web-a2z.com/arjun_kumar/School-Websites-Template-main/index.html`

Vercel transparently rewrites file-like public paths to the existing Render public document endpoint (`https://employee-document-management-system.onrender.com/documents/public-path/...`) without changing the browser URL. Vercel edge rewrite caching is enabled for these read-only public files, so repeat views/assets can be served from the edge instead of waking Render every time.

The View button no longer opens `/documents/public-path/...` directly. It always opens the same canonical URL that Copy Link produces.

No new frontend secret is required for this optimization.

Uploaded HTML remains sandboxed without `allow-same-origin` because the public URL uses the same custom domain as the EDMS application. This prevents a shared HTML website from accessing EDMS browser storage while still allowing scripts, forms, popups, CSS, images, and normal relative website navigation.

## Clean public document URLs

Employee documents now support clean, read-only public URLs through the
frontend domain:

`https://web-a2z.com/<employee-directory>/<document-name>`

Examples:

- `https://web-a2z.com/rahul_123/index.html`
- `https://web-a2z.com/rahul_123/photos/index.html`

These URLs do not require login and expose only the requested document.
They do not expose document-management controls or write operations.

ZIP extraction is manual. Uploading a ZIP stores the ZIP unchanged; clicking
**Extract** creates a folder named after the ZIP file and stores the extracted
contents inside the employee's directory.


## Upload and ZIP limits

- Application per-file limit: **500 MiB** (`UPLOAD_MAX_SIZE=524288000`).
- ZIP entry limit: **10,000 actual files** (`ZIP_MAX_FILES=10000`); directory entries do not consume the file count.
- ZIP total uncompressed limit remains **2 GiB** (`ZIP_MAX_UNCOMPRESSED_SIZE=2147483648`).
- Large uploads are streamed from FastAPI's spooled upload directly to Supabase in bounded chunks, without creating a second full-size temporary copy. ZIP members are streamed to a temporary file one at a time so CRC validation completes before each upload. ZIP extraction remains sequential to avoid a burst of Supabase Storage requests.
- Supabase Free projects cannot accept an individual file larger than 50 MB. For uploads above 50 MB, set the Supabase Storage global and bucket limits accordingly on an eligible paid plan.
- Supabase recommends resumable uploads for files above 6 MB; this build retains the existing authenticated backend upload workflow and streams it to Supabase, rather than changing the frontend upload architecture. For very large uploads, a resumable/TUS upload flow would be a separate future enhancement.
