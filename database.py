import sqlite3
import os
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
configured_db_path = os.environ.get("DATABASE_PATH", "").strip()
if configured_db_path:
    database_path = Path(configured_db_path).expanduser()
    if not database_path.is_absolute():
        database_path = PROJECT_DIR / database_path
else:
    database_path = PROJECT_DIR / "complaints.db"
DB_PATH = str(database_path.resolve())

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TEXT NOT NULL
    )
    """)
    
    # Create Complaints table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_roll TEXT NOT NULL,
        complaint_date TEXT NOT NULL DEFAULT '',
        department TEXT NOT NULL DEFAULT '',
        lab_name TEXT NOT NULL,
        lab_location TEXT NOT NULL DEFAULT '',
        system_no TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'Medium',
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        assigned_technician TEXT NOT NULL DEFAULT '',
        technician_contact TEXT NOT NULL DEFAULT '',
        service_visit_at TEXT,
        repair_action TEXT NOT NULL DEFAULT '',
        admin_remarks TEXT DEFAULT '',
        rectified_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users (id)
    )
    """)

    complaint_columns = {
        column["name"] for column in cursor.execute("PRAGMA table_info(complaints)")
    }
    migration_columns = {
        "complaint_date": "TEXT NOT NULL DEFAULT ''",
        "lab_location": "TEXT NOT NULL DEFAULT ''",
        "department": "TEXT NOT NULL DEFAULT ''",
        "assigned_technician": "TEXT NOT NULL DEFAULT ''",
        "technician_contact": "TEXT NOT NULL DEFAULT ''",
        "service_visit_at": "TEXT",
        "repair_action": "TEXT NOT NULL DEFAULT ''",
        "rectified_date": "TEXT",
    }
    for column_name, column_definition in migration_columns.items():
        if column_name not in complaint_columns:
            cursor.execute(
                f"ALTER TABLE complaints ADD COLUMN {column_name} {column_definition}"
            )

    cursor.execute("""
        UPDATE complaints
        SET complaint_date = substr(created_at, 1, 10)
        WHERE complaint_date = ''
          AND created_at IS NOT NULL
          AND created_at != ''
    """)

    cursor.execute("""
        UPDATE complaints
        SET rectified_date = substr(updated_at, 1, 10)
        WHERE status = 'Resolved'
          AND rectified_date IS NULL
          AND updated_at IS NOT NULL
          AND updated_at != ''
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
