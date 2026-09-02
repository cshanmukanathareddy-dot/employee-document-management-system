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

For Render, prefer a Supabase connection-pooler connection if your project/dashboard recommends it. Keep `sslmode=require`.

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

Current Supabase Free limits include 500 MB database size and 1 GB Storage size. Stay within those limits for a zero-cost deployment.

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

UPLOAD_MAX_SIZE=104857600
ZIP_MAX_FILES=1000
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
