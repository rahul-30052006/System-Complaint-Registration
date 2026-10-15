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
- **Track Status**: View all your submitted complaints with real-time status badges (`Pending`, `In Progress`, `Resolved`, `Rejected`) and read technician remarks.

### 🛡️ For Administrators:
- **Admin setup**: Admin accounts are provisioned locally with `create_admin.py`; passwords are entered through a hidden, confirmed prompt.
- **Live Statistics Overview**: Counters for Total, Pending, In Progress, and Resolved complaints.
- **Search & Filter**: Search complaints by student name, roll number, system ID, or keyword; filter by lab and status.
- **Action & Resolution**:
  - Update ticket status (`Pending` -> `In Progress` -> `Resolved` / `Rejected`).
  - Add administrative remarks or action notes (e.g. *"RAM replaced, system tested OK"*).
  - Delete ticket if needed.

---

## Project Structure

```text
.
├── main.py                  # FastAPI application and API routes
├── database.py              # SQLite schema and connection helpers
├── auth.py                  # Password hashing and bearer-token helpers
├── create_admin.py          # CLI utility for administrator accounts
├── email_service.py         # Gmail SMTP delivery for custom and resolution emails
├── requirements.txt
├── .env.example             # SMTP configuration template (copy to .env)
├── complaints.db            # Local SQLite database (created at runtime)
└── static/
    ├── index.html           # Student sign-in, registration, and dashboards
    ├── admin-login.html     # Separate administrator sign-in
    ├── css/styles.css
    ├── images/computer-network-background.jpg
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

Copy `.env.example` to `.env` and set `SMTP_EMAIL` to your Gmail address and
`SMTP_PASSWORD` to a Google App Password (not your regular Google password).
The app loads `.env` from the project root. Keep `.env` private; it is ignored by
Git. Gmail App Passwords require 2-Step Verification.

PowerShell:
```powershell
Copy-Item .env.example .env
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

## Configuration and deployment

- The SQLite database is stored locally in `complaints.db`; back it up before replacing or removing it.
- The login pages use the supplied computer-network background image at `static/images/computer-network-background.jpg`.
- The bundled bearer-token signing key is for local development. Configure a private secret and restrict CORS origins before deploying this application to a public environment.
- Use HTTPS and a production ASGI server configuration for deployments; do not use `--reload` outside development.
- `POST /send-email` is unauthenticated to match the requested endpoint. Restrict access or add authentication and rate limiting before exposing it to the public internet.

### Gmail email delivery

When an admin changes a ticket from a status other than `Resolved` to `Resolved`, the app sends one email to the address registered to that ticket's student account. Saving an already-resolved ticket does not send another notification. The ticket update is retained even if Gmail is unavailable; the admin sees a warning and the server logs the failure.

The app also provides `POST /send-email` for sending a custom email. Both custom
emails and resolution notifications use Gmail SMTP at `smtp.gmail.com:587` with
STARTTLS. The mailer uses Python's built-in SMTP and email libraries.

1. In the student's Google Account, enable 2-Step Verification.
2. Open the Google Account **App passwords** page from Security, create an app password for this project, and copy the generated password. Use an app password, not the normal Google Account password. If Google does not offer App passwords, the account or organization may not allow them.
3. Copy `.env.example` to `.env` and set `SMTP_EMAIL` and `SMTP_PASSWORD`. Do not commit `.env` or share the App Password.
4. Start the server from the project root:

  ```powershell
  .\.venv\Scripts\Activate.ps1
  uvicorn main:app --reload --port 8001
  ```

5. Test custom sending at `http://127.0.0.1:8001/docs`: expand `POST /send-email`, choose **Try it out**, enter a recipient, subject, and message, then select **Execute**. A successful delivery returns `{"message":"Email sent successfully"}`. A missing configuration is reported as HTTP 500; SMTP delivery failures are reported as HTTP 502. Check Spam if the email is not in the inbox.
6. To test the existing complaint workflow, sign in as a student and submit a complaint with a registered email address, then sign in as an admin. In **Update Ticket**, select `Resolved` and click **Save Changes**. The existing resolution email is sent on the transition to `Resolved`; saving an already-resolved ticket does not send a duplicate. If the ticket saves but the admin sees an email failure warning, check the server terminal and verify the App Password in `.env`. Once corrected, move the ticket to another status and then resolve it again to trigger a new notification.
7. To connect custom email to another complaint action, call `send_custom_email(...)` from the backend after the relevant action succeeds, or call `POST /send-email` from a trusted client. The built-in resolution notification already runs in the backend; no extra frontend call is needed. Avoid sending SMTP credentials to browser code.

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
| `PATCH` | `/api/admin/complaints/{id}` | Update status & add remarks | Admin |
| `DELETE` | `/api/admin/complaints/{id}` | Remove a complaint ticket | Admin |
| `POST` | `/send-email` | Send an email through Gmail SMTP | Public |
| `GET` | `/` | Admin login page | Public |
| `GET` | `/student-login` | Student login and registration page | Public |
| `GET` | `/dashboard` | Student or admin dashboard | Public page; API data requires authentication |

The `/admin-login` route is an alias for the administrator login page.
