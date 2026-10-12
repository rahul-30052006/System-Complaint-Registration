# LabSys Care — System Complaint Registration

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
├── requirements.txt
├── complaints.db            # Local SQLite database (created at runtime)
└── static/
    ├── index.html           # Student sign-in, registration, and dashboards
    ├── admin-login.html     # Separate administrator sign-in
    ├── css/styles.css
    ├── images/auth-background.jpg
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

### 3. Create an administrator account

Run the setup utility and enter a strong, unique password when prompted:
```bash
python create_admin.py
```

### 4. Start the server
```bash
uvicorn main:app --reload --port 8001
```

### 5. Open the application

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
- The bundled bearer-token signing key is for local development. Configure a private secret and restrict CORS origins before deploying this application to a public environment.
- Use HTTPS and a production ASGI server configuration for deployments; do not use `--reload` outside development.

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
| `GET` | `/` | Admin login page | Public |
| `GET` | `/student-login` | Student login and registration page | Public |
| `GET` | `/dashboard` | Student or admin dashboard | Public page; API data requires authentication |

The `/admin-login` route is an alias for the administrator login page.
