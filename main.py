import os
import logging
import sqlite3
import smtplib
from datetime import date, datetime
from typing import Optional, Tuple
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field, field_validator

from database import get_db, init_db
from email_service import send_custom_email, send_resolution_email
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
    require_student
)

logger = logging.getLogger(__name__)

# Keep these confirmed demo records in SQLite, but out of admin dashboard views.
ADMIN_HIDDEN_COMPLAINTS = (
    (3, 3, "Sarah Connor", "21CS_1791179196", "PC-08", "2026-10-05 11:16:36"),
    (4, 3, "Sarah Connor", "21CS_1791179196", "PC-15", "2026-10-05 11:16:36"),
)


def admin_complaint_visibility_filter(alias: str = "c") -> Tuple[str, tuple]:
    fields = ("id", "student_id", "student_name", "student_roll", "system_no", "created_at")
    hidden_rows = [
        "(" + " AND ".join(f"{alias}.{field} = ?" for field in fields) + ")"
        for _ in ADMIN_HIDDEN_COMPLAINTS
    ]
    return (
        f"NOT ({' OR '.join(hidden_rows)})",
        tuple(value for row in ADMIN_HIDDEN_COMPLAINTS for value in row),
    )


# Initialize Database on app load
init_db()

app = FastAPI(
    title="System Complaint Registration API",
    description="Lab System & Computer Complaint Management System for Students and Administrators",
    version="1.0.0"
)

# Enable CORS for local testing / cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Pydantic Models -----------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Roll Number or Username")
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=4, max_length=100)

class LoginRequest(BaseModel):
    login_id: str = Field(..., description="Username, Roll Number or Email")
    password: str = Field(..., min_length=1)

class ComplaintCreate(BaseModel):
    complaint_date: date
    department: str = Field(default="", max_length=100)
    lab_name: str = Field(..., min_length=1, max_length=100)
    lab_location: str = Field(..., min_length=1, max_length=100)
    system_no: str = Field(..., min_length=1, max_length=50)
    issue_type: str = Field(..., min_length=1, max_length=100)
    priority: str = Field(default="Medium", pattern="^(Low|Medium|High|Critical)$")
    description: str = Field(..., min_length=5, max_length=1000)

class ComplaintStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Pending|In Progress|Resolved|Rejected)$")
    assigned_technician: Optional[str] = Field(default=None, max_length=100)
    repair_action: Optional[str] = Field(default=None, max_length=2000)
    admin_remarks: Optional[str] = Field(default=None, max_length=1000)

# ----------------- Email Routes -----------------

class EmailContentRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=998)
    message: str

    @field_validator("subject")
    @classmethod
    def subject_must_not_contain_newlines(cls, subject: str) -> str:
        if "\r" in subject or "\n" in subject:
            raise ValueError("Subject must not contain newline characters")
        return subject


class EmailRequest(EmailContentRequest):
    to_email: EmailStr


class ComplaintEmailRequest(EmailContentRequest):
    pass


@app.post("/send-email")
def send_email(data: EmailRequest):
    try:
        send_custom_email(str(data.to_email), data.subject, data.message)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SMTP_EMAIL and SMTP_PASSWORD environment variables must be set.",
        ) from exc
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("SMTP email send failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send email. Check SMTP settings and credentials.",
        ) from exc

    return {"message": "Email sent successfully"}


@app.post("/api/admin/complaints/{complaint_id}/email")
def send_complaint_email(
    complaint_id: int,
    data: ComplaintEmailRequest,
    admin: dict = Depends(require_admin),
):
    conn = get_db()
    try:
        complaint = conn.execute("""
            SELECT u.email AS student_email
            FROM complaints c
            LEFT JOIN users u ON u.id = c.student_id
            WHERE c.id = ?
        """, (complaint_id,)).fetchone()
    finally:
        conn.close()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if not complaint["student_email"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The student does not have a registered email address.",
        )

    try:
        send_custom_email(complaint["student_email"], data.subject, data.message)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SMTP_EMAIL and SMTP_PASSWORD environment variables must be set.",
        ) from exc
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("SMTP email send failed for complaint #%s", complaint_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send email. Check SMTP settings and credentials.",
        ) from exc

    return {"message": "Email sent successfully"}

# ----------------- Auth Routes -----------------

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register_student(req: RegisterRequest):
    conn = get_db()
    cursor = conn.cursor()

    username = req.username.strip()
    full_name = (req.full_name or "").strip() or username
    email = req.email.strip().lower()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            SELECT id FROM users
            WHERE username = ? OR lower(trim(email)) = ?
        """, (username, email))
        if cursor.fetchone():
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student with this Roll Number/Username or Email already exists"
            )

        pwd_hash = hash_password(req.password)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'student', ?)
        """, (username, full_name, email, pwd_hash, now))

        new_user_id = cursor.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student with this Roll Number/Username or Email already exists"
        )
    finally:
        conn.close()

    token = create_access_token({"sub": new_user_id, "username": username, "role": "student"})
    
    return {
        "message": "Student registered successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user_id,
            "username": username,
            "full_name": full_name,
            "email": email,
            "role": "student"
        }
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    identifier = req.login_id.strip()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, full_name, email, password_hash, role
        FROM users
        WHERE username = ? OR lower(trim(email)) = ?
    """, (identifier, identifier.lower()))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your username/email and password."
        )
    
    token = create_access_token({"sub": user["id"], "username": user["username"], "role": user["role"]})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    }


def create_or_update_admin(username="rahul", email="rahulrsrahul54@mail.com", password="rahul2006", full_name="Lab Administrator"):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username or email already exists
    cursor.execute("""
        SELECT id, username, role FROM users
        WHERE username = ? OR lower(trim(email)) = lower(trim(?))
    """, (username, email))
    existing = cursor.fetchone()
    
    password_hash = hash_password(password)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if existing:
        user_id = existing["id"]
        cursor.execute("""
            UPDATE users 
            SET full_name = ?, email = ?, password_hash = ?, role = 'admin'
            WHERE id = ?
        """, (full_name, email, password_hash, user_id))
        conn.commit()
        print(f"[SUCCESS] Admin user '{username}' (ID: {user_id}) updated successfully.")
    else:
        cursor.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'admin', ?)
        """, (username, full_name, email, password_hash, now))
        conn.commit()
        print(f"[SUCCESS] Admin user '{username}' created successfully.")
        
    conn.close()
    print("-" * 50)
    print("Admin Account Details:")
    print(f"  Username  : {username}")
    print(f"  Email     : {email}")
    print(f"  Full Name : {full_name}")
    print(f"  Role      : admin")
    print("-" * 50)


@app.get("/api/auth/me")
def get_current_user_profile(user: dict = Depends(get_current_user)):
    return {"user": user}

# ----------------- Student Complaint Routes -----------------

@app.post("/api/complaints", status_code=status.HTTP_201_CREATED)
def submit_complaint(complaint: ComplaintCreate, user: dict = Depends(require_student)):
    conn = get_db()
    cursor = conn.cursor()
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        INSERT INTO complaints (
            student_id, student_name, student_roll, complaint_date, department, lab_name,
            lab_location, system_no, issue_type, priority, description,
            status, assigned_technician, repair_action, admin_remarks,
            rectified_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', '', '', NULL, ?, ?)
    """, (
        user["id"],
        user["full_name"],
        user["username"],
        complaint.complaint_date.isoformat(),
        complaint.department.strip(),
        complaint.lab_name.strip(),
        complaint.lab_location.strip(),
        complaint.system_no.strip(),
        complaint.issue_type.strip(),
        complaint.priority,
        complaint.description.strip(),
        now,
        now
    ))
    
    complaint_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    row = dict(cursor.fetchone())
    conn.close()
    
    return {"message": "Complaint submitted successfully", "complaint": row}

@app.get("/api/complaints/my")
def get_student_complaints(user: dict = Depends(require_student)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM complaints 
        WHERE student_id = ? 
        ORDER BY id DESC
    """, (user["id"],))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"complaints": rows}

# ----------------- Admin Complaint Routes -----------------

@app.get("/api/admin/complaints")
def get_all_complaints(
    status_filter: Optional[str] = Query(None, alias="status"),
    lab_filter: Optional[str] = Query(None, alias="lab"),
    search: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    conn = get_db()
    cursor = conn.cursor()
    visibility_filter, hidden_params = admin_complaint_visibility_filter()
    query = """
        SELECT c.*, u.email AS student_email
        FROM complaints c
        LEFT JOIN users u ON u.id = c.student_id
        WHERE {visibility_filter}
    """.format(visibility_filter=visibility_filter)
    params = list(hidden_params)
    
    if status_filter and status_filter.lower() != "all":
        query += " AND status = ?"
        params.append(status_filter)
        
    if lab_filter and lab_filter.lower() != "all":
        query += " AND lab_name = ?"
        params.append(lab_filter)
        
    if search:
        search_term = f"%{search.strip()}%"
        query += " AND (student_name LIKE ? OR student_roll LIKE ? OR department LIKE ? OR lab_name LIKE ? OR lab_location LIKE ? OR system_no LIKE ? OR issue_type LIKE ? OR description LIKE ? OR assigned_technician LIKE ? OR repair_action LIKE ? OR admin_remarks LIKE ?)"
        params.extend([search_term] * 11)
        
    query += " ORDER BY c.id DESC"
    
    cursor.execute(query, tuple(params))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"complaints": rows}

@app.get("/api/admin/stats")
def get_admin_stats(admin: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    visibility_filter, hidden_params = admin_complaint_visibility_filter()

    cursor.execute(
        f"SELECT COUNT(*) as total FROM complaints c WHERE {visibility_filter}",
        hidden_params,
    )
    total = cursor.fetchone()["total"]

    cursor.execute(
        f"SELECT COUNT(*) as count FROM complaints c WHERE {visibility_filter} AND c.status = 'Pending'",
        hidden_params,
    )
    pending = cursor.fetchone()["count"]

    cursor.execute(
        f"SELECT COUNT(*) as count FROM complaints c WHERE {visibility_filter} AND c.status = 'In Progress'",
        hidden_params,
    )
    in_progress = cursor.fetchone()["count"]

    cursor.execute(
        f"SELECT COUNT(*) as count FROM complaints c WHERE {visibility_filter} AND c.status = 'Resolved'",
        hidden_params,
    )
    resolved = cursor.fetchone()["count"]

    cursor.execute(
        f"SELECT COUNT(*) as count FROM complaints c WHERE {visibility_filter} AND c.status = 'Rejected'",
        hidden_params,
    )
    rejected = cursor.fetchone()["count"]
    
    # Complaints grouped by lab
    cursor.execute(
        f"SELECT c.lab_name, COUNT(*) as count FROM complaints c "
        f"WHERE {visibility_filter} GROUP BY c.lab_name",
        hidden_params,
    )
    by_lab = [dict(r) for r in cursor.fetchall()]
    
    # Complaints grouped by issue type
    cursor.execute(
        f"SELECT c.issue_type, COUNT(*) as count FROM complaints c "
        f"WHERE {visibility_filter} GROUP BY c.issue_type",
        hidden_params,
    )
    by_issue = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved,
        "rejected": rejected,
        "by_lab": by_lab,
        "by_issue_type": by_issue
    }

@app.patch("/api/admin/complaints/{complaint_id}")
def update_complaint_status(
    complaint_id: int,
    update_data: ComplaintStatusUpdate,
    admin: dict = Depends(require_admin)
):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            SELECT c.*, u.email AS student_email
            FROM complaints c
            JOIN users u ON u.id = c.student_id
            WHERE c.id = ? AND c.student_id = u.id
        """, (complaint_id,))
        existing_complaint = cursor.fetchone()
        if not existing_complaint:
            raise HTTPException(status_code=404, detail="Complaint not found")

        should_notify = (
            update_data.status == "Resolved"
            and existing_complaint["status"] != "Resolved"
        )
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if update_data.status == "Resolved":
            rectified_date = existing_complaint["rectified_date"]
            if existing_complaint["status"] != "Resolved" or not rectified_date:
                rectified_date = now[:10]
        else:
            rectified_date = None

        assigned_technician = (
            update_data.assigned_technician
            if update_data.assigned_technician is not None
            else existing_complaint["assigned_technician"]
        )
        repair_action = (
            update_data.repair_action
            if update_data.repair_action is not None
            else existing_complaint["repair_action"]
        )
        admin_remarks = (
            update_data.admin_remarks
            if update_data.admin_remarks is not None
            else existing_complaint["admin_remarks"]
        )

        cursor.execute("""
            UPDATE complaints
            SET status = ?, assigned_technician = ?, repair_action = ?,
                admin_remarks = ?, rectified_date = ?, updated_at = ?
            WHERE id = ?
        """, (
            update_data.status,
            (assigned_technician or "").strip(),
            (repair_action or "").strip(),
            (admin_remarks or "").strip(),
            rectified_date,
            now,
            complaint_id,
        ))

        conn.commit()
        cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
        updated_complaint = dict(cursor.fetchone())
        student_email = existing_complaint["student_email"]
    finally:
        conn.close()

    email_notification = "not_triggered"
    if should_notify:
        try:
            send_resolution_email({
                **updated_complaint,
                "student_email": student_email
            })
            email_notification = "sent"
        except Exception:
            logger.exception("Resolution email failed for complaint #%s", complaint_id)
            email_notification = "failed"

    return {
        "message": "Complaint updated successfully",
        "complaint": updated_complaint,
        "email_notification": email_notification
    }

@app.delete("/api/admin/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, admin: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM complaints WHERE id = ?", (complaint_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Complaint not found")

        conn.commit()
    finally:
        conn.close()

    return {"message": f"Complaint #{complaint_id} deleted successfully"}

# ----------------- Serve Frontend Static Files -----------------

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    admin_login_path = os.path.join(STATIC_DIR, "admin-login.html")
    if os.path.exists(admin_login_path):
        return FileResponse(admin_login_path)
    return {"message": "System Complaint Registration API is running. Static frontend not yet created."}

@app.get("/student-login", include_in_schema=False)
def serve_student_login():
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)

@app.get("/admin-login", include_in_schema=False)
def serve_admin_login():
    return serve_index()

@app.get("/dashboard", include_in_schema=False)
def serve_dashboard():
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)
