# System Complaint Registration (LabSys Care)

A lightweight, robust web application for managing and resolving computer system issues in college and university computer laboratories.

## 🚀 Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: SQLite3 (Embedded, zero external DB setup needed)
- **Security**: PBKDF2 HMAC-SHA256 password hashing & tamper-proof signed bearer tokens
- **Frontend**: Vanilla HTML5, Modern CSS (Responsive + Custom Variables), and Vanilla JavaScript

---

## 🌟 Key Features

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
- **Created via Server File**: Admins can be created/managed via `create_admin.py`.
- **Live Statistics Overview**: Counters for Total, Pending, In Progress, and Resolved complaints.
- **Search & Filter**: Search complaints by student name, roll number, system ID, or keyword; filter by lab and status.
- **Action & Resolution**:
  - Update ticket status (`Pending` -> `In Progress` -> `Resolved` / `Rejected`).
  - Add administrative remarks or action notes (e.g. *"RAM replaced, system tested OK"*).
  - Delete ticket if needed.

---

## 📁 Project Structure

```text
foxtech mini project/
│
├── main.py              # FastAPI server, API endpoints, static file hosting
├── database.py          # SQLite database connection & schema tables
├── auth.py              # Password hashing & authentication token handlers
├── create_admin.py      # Server file to create or reset administrator accounts
├── requirements.txt     # Python package requirements
├── README.md            # Project documentation & run guide
│
└── static/              # Frontend files
    ├── index.html       # Clean responsive single-page web interface
    ├── css/
    │   └── styles.css   # Modern styling, cards, tables, modals, toasts
    └── js/
        └── app.js       # Dynamic UI rendering, API fetch calls, auth state
```

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Create Administrator Account via Server File
Run the server file:
```bash
python create_admin.py
```
Or specify custom admin credentials directly:
```bash
python create_admin.py admin admin@lab.local admin123 "Lab Administrator"
```

> **Default Admin Credentials (if run without arguments):**
> - **Username**: `admin`
> - **Password**: `admin123`

### 3. Start the Server
```bash
uvicorn main:app --reload --port 8001
```
*(You can also use `--port 8000` or any preferred port)*

### 4. Open in Your Browser
Visit:
```text
http://127.0.0.1:8001
```

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
| `GET` | `/` | Serves web application | Public |
