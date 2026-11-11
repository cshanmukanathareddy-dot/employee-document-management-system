# Render deployment and large upload fix

This package keeps the existing Vercel frontend and Supabase document delivery flow. The changes are limited to Render/Python deployment configuration, PostgreSQL connection safety, and streaming upload/ZIP processing.

## 1. Render service settings

### PostgreSQL startup-driver correction

The Render log supplied for the previous deployment showed that the build completed, but the process crashed while importing the database engine with `ModuleNotFoundError: No module named 'psycopg'`. The project installs `psycopg2-binary`, while SQLAlchemy 2.1 can select the Psycopg 3 dialect from a plain `postgresql://` URL. The corrected database configuration explicitly selects `postgresql+psycopg2` for default PostgreSQL URLs. No extra driver package is required, and the bounded SQLAlchemy pool remains unchanged.


For the existing Render Web Service, confirm:

- **Root Directory:** `backend`
- **Runtime:** Python
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`

The project pins Python to `3.12.8` with both `backend/.python-version` and `PYTHON_VERSION` in `render.yaml`.

## 2. Update these Render environment variables

For the existing service, open **Render → your Web Service → Environment** and set:

```text
PYTHON_VERSION=3.12.8
UPLOAD_MAX_SIZE=524288000
SUPABASE_MAX_FILE_SIZE=50000000
ZIP_MAX_FILES=20000
ZIP_MAX_UNCOMPRESSED_SIZE=2147483648
STORAGE_PROVIDER=supabase
SUPABASE_BUCKET=edms-files
```

Keep the other required variables configured with your newly rotated/current values:

```text
DATABASE_URL=<Supabase PostgreSQL Session Pooler connection string>
SECRET_KEY=<new long random secret>
JWT_ALGORITHM=HS256
TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=https://web-a2z.com,https://www.web-a2z.com,https://employee-document-management-system.vercel.app
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<new server-side service-role key>
ADMIN_EMAIL=<administrator email>
ADMIN_PASSWORD=<new strong administrator password>
ADMIN_NAME=System Administrator
```

Do not put the service-role key in a `VITE_` variable or frontend environment. Do not commit any real `.env` file or secret to GitHub.

## 3. Supabase file-size setting

The application ceiling is **500 MiB per file**. Supabase also applies its own global and bucket size limits. On Supabase Free, the individual file cap is **50 MB**; files above that require an eligible paid plan and an increased global Storage file-size limit. Set the `edms-files` bucket limit to the intended maximum as well. A Render environment variable cannot override a Supabase plan or bucket cap.

ZIP controls:

- Up to **20,000 actual files** per ZIP (directory entries do not count).
- Up to **2 GiB total uncompressed ZIP content**.
- Standard and password-protected ZIP archives are supported, including WinZip AES encryption. When an encrypted archive is extracted, EDMS asks for the password; it is used only for that request and is not saved.
- ZIP uploads remain ZIP files until the user explicitly chooses **Extract**.
- Extraction remains sequential; individual members are streamed instead of loading them all into memory.

## 4. Deploy and check logs

1. Save the environment changes in Render.
2. Push this corrected package to the connected GitHub branch.
3. In Render, trigger **Manual Deploy → Deploy latest commit** if auto-deploy is not enabled.
4. Open **Logs** and confirm the service starts and `/health` becomes healthy.
5. Test login, a small document upload, a ZIP upload, and extraction before testing a large archive.

If deployment still fails, copy the first Python traceback from Render's **Deploy Logs** and the **Runtime Logs** immediately after startup. Redact passwords, connection strings, JWT/service-role keys, and tokens before sharing. The source package can be checked locally, but the actual production database connection and Render deployment cannot be certified without those live logs.

## 5. Git push reminder

Use the repository's existing Git remote rather than adding a duplicate one. `git push --force` replaces the remote `main` branch history; use it only when you intentionally want this package to replace the current branch and have a backup of any commits you need.
