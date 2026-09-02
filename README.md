Employee Document Management System (EDMS)

A secure, role-based Employee Document Management System built with Python, FastAPI, PostgreSQL, SQLAlchemy, HTML, CSS and JavaScript.

EDMS provides employee document management, administrator approval workflows, registration approval, read-only access, storage quotas, additional storage requests, notifications and Excel export.

Features


ZIP Upload & Extraction

ZIP uploads remain intact after upload. Extraction happens only when the user clicks the Extract button.

- Employee ZIP uploads are extracted into that employee's directory.
- Administrator ZIP uploads are extracted into the administrator's directory.
- The original ZIP is used only temporarily and is not retained as the document.
- Each supported extracted file is added to the document library and can be viewed/downloaded using the existing document controls.
- Folder structure inside the ZIP is preserved.
- Storage quota is calculated from the extracted files, not the temporary ZIP.
- ZIP path traversal and symbolic-link entries are blocked.
- ZIP file-count and uncompressed-size limits protect against ZIP bombs.
- Unsupported file types inside a ZIP are rejected.


Secure login and registration

Role-based access control

Admin, Employee and Read Only Employee roles

Pending registration workflow

Admin approval/rejection of registrations

Employee document upload and management

Document approval/rejection workflow

Read-only employee restrictions

Per-employee storage allocation and usage

Storage quota enforcement

Additional storage requests

Admin approval/decline of storage requests

Employee storage dashboard

Employee information Excel export

Role/status/storage information in Excel export

Employee profile

Notifications

PostgreSQL persistence

Backend-enforced authorization

Roles

Admin

admin

Full administration access, including:

Manage users

Review Registration Requests

Approve as Employee

Approve as Read Only

Reject registrations

Manage documents

Review document workflows

Manage Storage Requests

Approve or decline storage requests

View employee storage usage

Export employee information to Excel

Employee

employee

Normal employee access:

Log in

View dashboard

Upload employee documents

View permitted documents

Download permitted documents

Delete permitted employee documents where allowed

Request additional storage

View storage allocation, usage and remaining storage

View profile

Read Only Employee

readonlyemployee

Can:

Open the portal

View allowed administrator-shared documents

Download allowed administrator-shared documents

View profile

Cannot:

Upload employee documents

Delete employee documents

Access employee-owned document files through the employee document API

Use personal document storage

Read-only employees receive 0 GB personal storage.

Registration Workflow

New registrations are created as:

status = pending
is_active = false

Pending users cannot log in.

Workflow:

Registration
     |
     v
Pending + Disabled
     |
     v
Admin -> Registration Requests
     |
     +-------------------+
     |                   |
     v                   v
 Employee            Read Only
     |                   |
     v                   v
Active Account      Active Account

Admin may also Reject

Approval as Employee makes the account active and keeps the requested initial storage allocation, subject to the application's limits.

Approval as Read Only makes the account active with 0 GB storage.

Rejected users remain disabled.

No approval/rejection notification is created.

Document Workflow

Documents support approval-related fields:

status
rejection_reason

Typical workflow:

Upload -> Pending -> Approved
                                   -> Rejected

Storage Management

New registrations can request up to 2 GB initial storage.

Existing employees are assigned 2 GB.

Read-only employees have 0 GB.

The system tracks:

Storage allocation

Storage used

Storage remaining

Uploads are blocked when the quota would be exceeded.

Additional Storage Requests

Employees can request additional storage from the Dashboard.

Admins can review requests under:

Storage Requests

and:

Approve

Decline

Requests include:

Employee

Requested storage

Status

Request date

Admin note

Decision date

Excel Export

Admins can export employee information to Excel.

The export includes information such as:

Employee details

Role

Status

Storage allocation

Storage usage

Remaining storage

Excel generation uses openpyxl.

Technology Stack

Backend

Python

FastAPI

SQLAlchemy

PostgreSQL

psycopg2

Uvicorn

Frontend

HTML5

CSS3

JavaScript

Excel

openpyxl

Project Structure

Employee-Document-Management/
│
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── database/
│   │   └── main.py
│   ├── uploads/
│   ├── .env
│   ├── .env.example
│   ├── requirements.txt
│   ├── role_migration.sql
│   └── storage_migration.sql
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── README.md
└── steps.txt

Exact files can vary slightly with the supplied project version.

Environment

The real backend/.env is intentionally not included.

Use the existing .env, or copy:

backend/.env.example

to:

backend/.env

Example database setting:

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/employee_edms

Replace YOUR_PASSWORD with the PostgreSQL password on the new machine.

Never commit real passwords, secret keys or API keys.

Database

The project uses PostgreSQL.

Important current columns:

users

storage_limit_bytes
storage_limit_gb

storage_requests

id
employee_id
status
admin_note
created_at
requested_gb
decided_at

Old storage-request columns such as:

current_limit
requested_limit
reason
processed_at

are not part of the current implementation.

documents

status
rejection_reason

Installation

Requirements

Install:

Python 3.x

PostgreSQL

Visual Studio Code

Modern web browser

Live Server extension if used by the frontend

Clone

git clone <YOUR_REPOSITORY_URL>
cd Employee-Document-Management

Create virtual environment

cd backend
python -m venv venv
venv\Scripts\activate

Install dependencies

pip install -r requirements.txt

PostgreSQL Setup

Open:

psql -U postgres

Create the database:

CREATE DATABASE employee_edms;

Connect:

\c employee_edms

Configure backend/.env.

Database Initialization

Start the backend once:

cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

The backend automatically applies required schema migrations on startup where supported by the supplied project version.

Stop with:

CTRL + C

Existing Database Migration

For an existing EDMS database, run:

backend/role_migration.sql

once before testing the new registration workflow.

This keeps the administrator as admin and converts existing non-admin users to active employee accounts.

Storage migration is available at:

backend/storage_migration.sql

The current project can also apply required storage schema changes automatically on startup.

Running the Backend

cd Employee-Document-Management\backend
venv\Scripts\activate
uvicorn app.main:app --reload

Backend:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs

Running the Frontend

Open the frontend in Visual Studio Code.

If using Live Server:

Install Live Server.

Right-click the frontend index.html.

Select Open with Live Server.

Make sure the frontend API configuration points to the running backend.

Normally:

http://127.0.0.1:8000

Testing Checklist

Registration

Register a new user.

Confirm it is pending.

Confirm login is blocked.

Log in as Admin.

Open Registration Requests.

Approve as Employee or Read Only.

Confirm the account becomes active.

Read Only

Verify that a readonlyemployee can view/download permitted administrator-shared documents and view their profile, but cannot upload/delete employee documents or access employee-owned document files through employee APIs.

Storage

Log in as Employee.

Check allocation, usage and remaining storage.

Upload a document.

Verify usage increases.

Attempt an upload beyond the quota.

Confirm it is rejected.

Submit an additional storage request.

Approve/decline it from Admin.

Excel

Log in as Admin.

Open Admin Dashboard.

Export employee information.

Open the .xlsx.

Verify role, status, allocation, usage and remaining storage.

Troubleshooting

PostgreSQL connection error

Check:

PostgreSQL is running

employee_edms exists

Username/password are correct

DATABASE_URL is correct

Undefined column error

Examples:

column storage_requests.requested_gb does not exist
column storage_requests.decided_at does not exist

Run:

backend/storage_migration.sql

or the current migration commands supplied with the project.

current_limit NOT NULL error

If PostgreSQL reports:

null value in column "current_limit"

the database still has the old storage-request schema.

The current implementation uses:

requested_gb
decided_at

and not:

current_limit
requested_limit
reason
processed_at

Run the storage migration.

storage_limit_gb does not exist

Run the storage migration and verify:

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users';

HTTP 500

Check the FastAPI terminal traceback. Database connection, migration and environment configuration issues are common causes.

Handover

Give the next developer:

Project source code
README.md
steps.txt
backend/.env.example
backend/role_migration.sql
backend/storage_migration.sql

Do not provide backend/.env if it contains your credentials.

Summary

EDMS provides:

Admin / Employee / Read Only Employee roles

Registration approval

Pending account protection

Document management

Document approval/rejection

Backend-enforced read-only restrictions

Storage quotas

Storage requests

Storage approval

Storage usage tracking

Excel export

PostgreSQL persistence

FastAPI backend

Web frontend

See steps.txt for the complete new-machine setup and command sequence.
## Online Deployment

For the recommended prototype deployment (Vercel + Render + Neon + Supabase Storage), see `DEPLOYMENT.md`.

The backend supports `STORAGE_PROVIDER=local` for local development and `STORAGE_PROVIDER=supabase` for online deployment. Keep Supabase Storage private and store the service-role key only on the backend.

Registration now requires acceptance of the Terms and Conditions. The backend also validates the checkbox value, so the requirement cannot be bypassed by calling the API directly.

Database changes are consolidated into `backend/migration.sql`.


## Free Online Deployment

Recommended free prototype architecture:

- GitHub for source control
- Vercel Hobby for the React frontend
- Render Free for the FastAPI backend
- Supabase Free for PostgreSQL + private Storage

See `DEPLOYMENT.md` for the complete deployment steps.

For online deployment, set:

```text
STORAGE_PROVIDER=supabase
```

and keep the Supabase service-role key only on the backend/Render environment.
