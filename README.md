# System Complaint Registration

A responsive complaint-management portal for reporting, tracking, and resolving computer-lab system issues. Students can submit and follow tickets; administrators can triage, update, and resolve them from a separate dashboard.

## Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: SQLite3 (Embedded, zero external DB setup needed)
- **Security**: PBKDF2 HMAC-SHA256 password hashing and signed bearer tokens
- **Frontend**: Vanilla HTML5, Modern CSS (Responsive + Custom Variables), and Vanilla JavaScript

---

## Features

### 👨‍🎓 For Students:
- **Sign Up & Login**: Students can register with Roll Number/Username, Name, and Email.
- **Register System Complaints**:
  - Select Lab Name (e.g., Programming Lab, AI/DS Lab, Networks Lab, Cloud Lab, etc.).
  - Specify System / PC Number (e.g. `PC-07`, `SYS-14`).
  - Categorize Issue (Hardware, Display, Peripherals, OS/Boot failure, Network, Software, etc.).
  - Set Urgency / Priority (`Low`, `Medium`, `High`, `Critical`).
  - Provide a clear problem description.
- **Track Status**: View all your submitted complaints with real-time status badges (`Pending`, `In Progress`, `Technician Assigned`, `Resolved`, `Rejected`) and read technician/service details.

### 🛡️ For Administrators:
- **Admin setup**: Admin accounts are provisioned locally with `create_admin.py`; passwords are entered through a hidden, confirmed prompt.
- **Live Statistics Overview**: Counters for Total, Pending, In Progress, and Resolved complaints.
- **Search & Filter**: Search complaints by student name, roll number, system ID, or keyword; filter by lab and status.
- **Email Students**: Use the row's **Email** action to compose a complaint-specific message. Delivery always uses that student's registered database email address.
- **Complaint Actions**: View all complaint details, email the student, or delete only the selected complaint after confirmation.
- **Technician Assignment & Resolution**:
  - Assign a technician, add contact details, schedule a service visit, and record repair instructions and admin remarks.
  - Update ticket status (`Pending`, `In Progress`, `Technician Assigned`, `Resolved`, or `Rejected`).
  - Send assignment updates and repair-completion emails to the student's registered address.
  - Delete ticket if needed.

---

## Project Structure

```text
.
├── main.py                  # FastAPI application and API routes
├── database.py              # SQLite schema and connection helpers
├── auth.py                  # Password hashing and bearer-token helpers
├── create_admin.py          # CLI utility for administrator accounts
├── email_service.py         # Gmail SMTP delivery and HTML/plain-text templates
├── requirements.txt
├── .env.example             # SMTP configuration template (copy to .env)
├── complaints.db            # Local SQLite database (created at runtime)
└── static/
    ├── index.html           # Student sign-in, registration, and dashboards
    ├── admin-login.html     # Separate administrator sign-in
    ├── css/styles.css
    ├── images/
    │   ├── admin-dashboard-bg.png
    │   └── computer-network-background.jpg
    └── js/
        ├── app.js
        └── admin-login.js
```

---

## 🛠️ Getting Started

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
```

On Windows:
```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Gmail SMTP

If `.env` does not already exist, copy `.env.example` to create it. Otherwise,
keep your existing `.env` and update its `GMAIL_ADDRESS` and
`GMAIL_APP_PASSWORD` entries. Use a Google App Password, not your regular
Google password. The app loads `.env` from the project root. Keep `.env`
private; it is ignored by Git. Gmail App Passwords require 2-Step Verification.

PowerShell:
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

### 4. Create an administrator account

Run the setup utility and enter a strong, unique password when prompted:
```bash
python create_admin.py
```

### 5. Start the server
```bash
uvicorn main:app --reload --port 8001
```

### 6. Open the application

Administrator sign-in:
```text
http://127.0.0.1:8001
```

Student sign-in and registration:
```text
http://127.0.0.1:8001/student-login
```

After signing in, users are taken to the role-appropriate dashboard at `/dashboard`. FastAPI's interactive API documentation is available at `/docs`.

### Troubleshooting student sign-in and registration

Start FastAPI from the project root in a terminal to keep Uvicorn access and
error logs visible:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8001 --log-level debug --access-log --no-use-colors
```

The application initializes its SQLite schema when `main.py` imports
`database.py`; the database path is anchored to the project directory, not the
current shell directory. A SQLite error in either authentication route is
logged with a traceback by the application. Look for Uvicorn's ASGI error
traceback and its final exception line; do not share passwords, tokens, or
other secrets with the traceback.

Use the automated auth API tests to exercise successful registration and
login, duplicate accounts, invalid fields, and incorrect passwords against a
temporary test database without adding test accounts to `complaints.db`:

```powershell
python -m unittest discover -s tests -p "test_auth.py" -v
```

Expected results are HTTP 201 for a valid signup, HTTP 200 for a valid username
or email login, HTTP 400 for duplicate signup, HTTP 401 for invalid
credentials, and HTTP 422 for malformed signup input. If a real request still
returns HTTP 500, reproduce it with the logging command above and inspect the
server terminal for the SQLite/Python exception; the response intentionally
does not expose traceback details to the browser.

## Configuration and deployment

- The SQLite database is stored locally in `complaints.db`; back it up before replacing or removing it.
- `DATABASE_PATH` can override the SQLite file location. Render's default service filesystem is ephemeral, so SQLite data there can disappear on a restart or deployment. To keep SQLite on Render, attach a persistent disk (for example, mounted at `/var/data`) and set `DATABASE_PATH=/var/data/complaints.db`. Before pointing the app at that path, stop it and copy the existing database file there; otherwise the app will initialize a new, empty database at the configured location. Keep a backup before copying. A managed PostgreSQL database is recommended for production, especially if running more than one application instance.
- On next backend startup, `database.py` automatically adds the technician contact and scheduled service visit columns to existing complaint tables. Existing complaint records are preserved; no manual migration command is required.
- The login pages use the supplied computer-network background image at `static/images/computer-network-background.jpg`.
- The bundled bearer-token signing key is for local development. Configure a private secret and restrict CORS origins before deploying this application to a public environment.
- Use HTTPS and a production ASGI server configuration for deployments; do not use `--reload` outside development.
- Custom email delivery and complaint updates require an authenticated admin. Do not expose Gmail credentials to the browser.

### Gmail email delivery

When technician/service details change and a technician is assigned, the app
sends an assignment email to the student's registered address. A transition to
`Resolved` sends a repair-completion email once; saving an unchanged update
does not resend it. Complaint changes are saved before delivery is attempted.
If SMTP fails, the dashboard and API clearly report that the email was not sent.

Both custom emails and complaint notifications use Gmail SMTP at
`smtp.gmail.com:587` with STARTTLS. Messages include HTML and plain-text
alternatives.

1. Open your Google Account **Security** settings and enable **2-Step
   Verification**.
2. After enabling it, open **App passwords** in the Security settings, sign in
   again if prompted, and create an app password for this project. Google may
   hide this option for managed accounts or Advanced Protection accounts.
3. If `.env` does not already exist, copy `.env.example` to `.env`; otherwise
   update the existing file. Set `GMAIL_ADDRESS` to the sending Gmail
   address and `GMAIL_APP_PASSWORD` to the generated 16-character App Password.
   Google may show spaces in the password; either form works. Do not use your
   normal Google password, commit `.env`, or share the App Password.
   Existing installations using `SMTP_EMAIL` and `SMTP_PASSWORD` continue to
   work, but new configuration should use the `GMAIL_*` names.
4. From the project root, install dependencies and start the FastAPI app:

   ```powershell
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8001
   ```

5. Open `http://127.0.0.1:8001` for admin sign-in or
   `http://127.0.0.1:8001/student-login` for the student portal. FastAPI serves
   the existing frontend; it does not need a separate frontend build/server.
   API documentation is available at `http://127.0.0.1:8001/docs`.
6. For technician assignment, sign in as an admin, open a complaint's
   **View Complaints** details, enter the technician, contact information, and
   service visit date/time, then select **Technician Assigned** and save. That
   status requires both technician name and visit date/time.
7. To test resolution, select **Resolved** and confirm the prompt. The
   completion email is sent after saving. Repeating the same update does not
   send a duplicate. **Email Student** and the table's **Email** action send an
   intentional custom email to the complaint's registered address.
8. Run automated tests using `python -m unittest discover -s tests`.

Common delivery issues:

- **SMTP 535 / username-password not accepted:** verify `GMAIL_ADDRESS`, use
  the current 16-character App Password, and confirm 2-Step Verification is
  active. Never use the regular Google Account password.
- **SMTP 534 / application-specific password required:** generate an App
  Password after enabling 2-Step Verification. Organization policy or
  Advanced Protection may prevent App Passwords.
- **Connection timeout/refused:** allow outbound SMTP on port 587 to
  `smtp.gmail.com` and confirm network/firewall settings allow STARTTLS.
- **Dashboard says email was not sent:** inspect the dashboard delivery message
  and backend terminal, verify `.env` is in the project root, then restart the
  backend after changing configuration. Complaint updates remain saved even
  when delivery fails. Check the student address and Spam folder.

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Student registration | Public |
| `POST` | `/api/auth/login` | Student & Admin login | Public |
| `GET` | `/api/auth/me` | Current user profile | Authenticated |
| `POST` | `/api/complaints` | Submit a system complaint | Student |
| `GET` | `/api/complaints/my` | View student's own complaints | Student |
| `GET` | `/api/admin/complaints` | View all complaints (search/filter) | Admin |
| `GET` | `/api/admin/stats` | Complaint summary metrics | Admin |
| `PATCH` | `/api/admin/complaints/{id}` | Update status, technician, service visit, and remarks | Admin |
| `DELETE` | `/api/admin/complaints/{id}` | Remove a complaint ticket | Admin |
| `POST` | `/api/admin/complaints/{id}/email` | Email the student's registered address about a complaint | Admin |
| `POST` | `/send-email` | Send a custom email through Gmail SMTP | Admin |
| `GET` | `/` | Admin login page | Public |
| `GET` | `/student-login` | Student login and registration page | Public |
| `GET` | `/dashboard` | Student or admin dashboard | Public page; API data requires authentication |

The `/admin-login` route is an alias for the administrator login page.
