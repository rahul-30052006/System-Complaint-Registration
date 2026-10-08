import os
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field

from database import get_db, init_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
    require_student
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
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=4, max_length=100)

class LoginRequest(BaseModel):
    login_id: str = Field(..., description="Username, Roll Number or Email")
    password: str = Field(..., min_length=1)

class ComplaintCreate(BaseModel):
    lab_name: str = Field(..., min_length=1, max_length=100)
    system_no: str = Field(..., min_length=1, max_length=50)
    issue_type: str = Field(..., min_length=1, max_length=100)
    priority: str = Field(default="Medium", pattern="^(Low|Medium|High|Critical)$")
    description: str = Field(..., min_length=5, max_length=1000)

class ComplaintStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Pending|In Progress|Resolved|Rejected)$")
    admin_remarks: Optional[str] = Field(default="", max_length=1000)

# ----------------- Auth Routes -----------------

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register_student(req: RegisterRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username or email is already registered
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (req.username.strip(), req.email.strip().lower()))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student with this Roll Number/Username or Email already exists"
        )
    
    pwd_hash = hash_password(req.password)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        INSERT INTO users (username, full_name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, 'student', ?)
    """, (req.username.strip(), req.full_name.strip(), req.email.strip().lower(), pwd_hash, now))
    
    new_user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    token = create_access_token({"sub": new_user_id, "username": req.username.strip(), "role": "student"})
    
    return {
        "message": "Student registered successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user_id,
            "username": req.username.strip(),
            "full_name": req.full_name.strip(),
            "email": req.email.strip().lower(),
            "role": "student"
        }
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    identifier = req.login_id.strip()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, username, full_name, email, password_hash, role FROM users WHERE username = ? OR email = ?",
        (identifier, identifier.lower())
    )
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


@app.get("/admin_function")
def create_or_update_admin(username="rahul", email="rahul@mail.com", password="rahul123", full_name="Lab Administrator"):
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username or email already exists
    cursor.execute("SELECT id, username, role FROM users WHERE username = ? OR email = ?", (username, email))
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
    print(f"  Password  : {password}")
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
            student_id, student_name, student_roll, lab_name, 
            system_no, issue_type, priority, description, 
            status, admin_remarks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', ?, ?)
    """, (
        user["id"],
        user["full_name"],
        user["username"],
        complaint.lab_name.strip(),
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
    
    query = "SELECT * FROM complaints WHERE 1=1"
    params = []
    
    if status_filter and status_filter.lower() != "all":
        query += " AND status = ?"
        params.append(status_filter)
        
    if lab_filter and lab_filter.lower() != "all":
        query += " AND lab_name = ?"
        params.append(lab_filter)
        
    if search:
        search_term = f"%{search.strip()}%"
        query += " AND (student_name LIKE ? OR student_roll LIKE ? OR system_no LIKE ? OR issue_type LIKE ? OR description LIKE ?)"
        params.extend([search_term, search_term, search_term, search_term, search_term])
        
    query += " ORDER BY id DESC"
    
    cursor.execute(query, tuple(params))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"complaints": rows}

@app.get("/api/admin/stats")
def get_admin_stats(admin: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM complaints")
    total = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'Pending'")
    pending = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'In Progress'")
    in_progress = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'Resolved'")
    resolved = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'Rejected'")
    rejected = cursor.fetchone()["count"]
    
    # Complaints grouped by lab
    cursor.execute("SELECT lab_name, COUNT(*) as count FROM complaints GROUP BY lab_name")
    by_lab = [dict(r) for r in cursor.fetchall()]
    
    # Complaints grouped by issue type
    cursor.execute("SELECT issue_type, COUNT(*) as count FROM complaints GROUP BY issue_type")
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
    
    cursor.execute("SELECT id FROM complaints WHERE id = ?", (complaint_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        UPDATE complaints 
        SET status = ?, admin_remarks = ?, updated_at = ?
        WHERE id = ?
    """, (update_data.status, update_data.admin_remarks.strip(), now, complaint_id))
    
    conn.commit()
    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    updated_complaint = dict(cursor.fetchone())
    conn.close()
    
    return {"message": "Complaint updated successfully", "complaint": updated_complaint}

@app.delete("/api/admin/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, admin: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM complaints WHERE id = ?", (complaint_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    cursor.execute("DELETE FROM complaints WHERE id = ?", (complaint_id,))
    conn.commit()
    conn.close()
    return {"message": f"Complaint #{complaint_id} deleted successfully"}

# ----------------- Serve Frontend Static Files -----------------

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "System Complaint Registration API is running. Static frontend not yet created."}
