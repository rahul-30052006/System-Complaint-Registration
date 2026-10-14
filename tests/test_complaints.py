import os
import sqlite3
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch

import database
import main
from fastapi.testclient import TestClient
from main import LoginRequest, RegisterRequest


class ComplaintWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        database.DB_PATH = os.path.join(self.temp_dir.name, "complaints.db")
        database.init_db()

        student = main.register_student(RegisterRequest(
            username="student-17",
            full_name="Sam Student",
            email="sam.student@example.com",
            password="StudentPassword123!",
        ))
        self.student_headers = {"Authorization": f"Bearer {student['access_token']}"}

        conn = database.get_db()
        conn.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'admin', ?)
        """, (
            "repair-admin",
            "Repair Admin",
            "repair-admin@example.com",
            main.hash_password("AdminPassword123!"),
            "2026-01-01 00:00:00",
        ))
        conn.commit()
        conn.close()
        admin = main.login(LoginRequest(
            login_id="repair-admin",
            password="AdminPassword123!",
        ))
        self.admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_student_submit_admin_repair_resolution_and_email(self):
        complaint_response = self.client.post(
            "/api/complaints",
            headers=self.student_headers,
            json={
                "department": "Computer Science",
                "lab_name": "UG Lab",
                "lab_location": "Block A, Room 204",
                "system_no": "PC-17",
                "issue_type": "Hardware / CPU / Power Issue",
                "priority": "High",
                "description": "The computer will not power on.",
                "student_name": "Untrusted Submitted Name",
                "student_roll": "UNTRUSTED-ROLL",
            },
        )
        self.assertEqual(complaint_response.status_code, 201)
        complaint = complaint_response.json()["complaint"]
        self.assertEqual(complaint["student_name"], "Sam Student")
        self.assertEqual(complaint["student_roll"], "student-17")
        self.assertEqual(complaint["department"], "Computer Science")
        self.assertEqual(complaint["status"], "Pending")
        self.assertEqual(complaint["created_at"][:10], datetime.now().strftime("%Y-%m-%d"))

        with patch.object(main, "send_resolution_email") as send_email:
            in_progress = self.client.patch(
                f"/api/admin/complaints/{complaint['id']}",
                headers=self.admin_headers,
                json={
                    "status": "In Progress",
                    "assigned_technician": "Jordan Technician",
                    "repair_action": "Inspected the power supply.",
                    "admin_remarks": "Replacement part requested.",
                },
            )
            self.assertEqual(in_progress.status_code, 200)
            self.assertIsNone(in_progress.json()["complaint"]["rectified_date"])
            self.assertEqual(in_progress.json()["email_notification"], "not_triggered")

            resolved = self.client.patch(
                f"/api/admin/complaints/{complaint['id']}",
                headers=self.admin_headers,
                json={
                    "status": "Resolved",
                    "assigned_technician": "Jordan Technician",
                    "repair_action": "Replaced the power supply and tested the system.",
                    "admin_remarks": "System is working normally.",
                },
            )
            self.assertEqual(resolved.status_code, 200)
            resolved_complaint = resolved.json()["complaint"]
            self.assertEqual(resolved_complaint["rectified_date"], datetime.now().strftime("%Y-%m-%d"))
            self.assertEqual(resolved_complaint["assigned_technician"], "Jordan Technician")
            self.assertEqual(resolved_complaint["repair_action"], "Replaced the power supply and tested the system.")
            self.assertEqual(resolved.json()["email_notification"], "sent")
            send_email.assert_called_once()
            emailed = send_email.call_args.args[0]
            self.assertEqual(emailed["student_email"], "sam.student@example.com")
            self.assertEqual(emailed["repair_action"], resolved_complaint["repair_action"])

            repeated = self.client.patch(
                f"/api/admin/complaints/{complaint['id']}",
                headers=self.admin_headers,
                json={"status": "Resolved"},
            )
            self.assertEqual(repeated.status_code, 200)
            self.assertEqual(repeated.json()["email_notification"], "not_triggered")
            self.assertEqual(repeated.json()["complaint"]["admin_remarks"], "System is working normally.")
            send_email.assert_called_once()

        my_complaints = self.client.get("/api/complaints/my", headers=self.student_headers)
        self.assertEqual(my_complaints.status_code, 200)
        self.assertEqual(my_complaints.json()["complaints"][0]["id"], complaint["id"])

        admin_complaints = self.client.get("/api/admin/complaints", headers=self.admin_headers)
        self.assertEqual(admin_complaints.status_code, 200)
        admin_ticket = admin_complaints.json()["complaints"][0]
        for field in (
            "department", "student_name", "student_roll", "lab_name", "system_no",
            "assigned_technician", "priority", "status", "rectified_date",
            "repair_action", "admin_remarks",
        ):
            self.assertIn(field, admin_ticket)

    def test_migration_preserves_existing_complaints_and_backfills_rectified_date(self):
        legacy_path = os.path.join(self.temp_dir.name, "legacy.db")
        legacy_conn = sqlite3.connect(legacy_path)
        legacy_conn.executescript("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                created_at TEXT NOT NULL
            );
            CREATE TABLE complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                student_name TEXT NOT NULL,
                student_roll TEXT NOT NULL,
                lab_name TEXT NOT NULL,
                lab_location TEXT NOT NULL DEFAULT '',
                system_no TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                admin_remarks TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO users VALUES (1, 'legacy-student', 'Legacy Student', 'legacy@example.com', 'hash', 'student', '2025-01-01 00:00:00');
            INSERT INTO complaints VALUES (8, 1, 'Legacy Student', 'legacy-student', 'Old Lab', 'Room 1', 'PC-08', 'Hardware', 'Medium', 'Existing complaint', 'Resolved', 'Old repair remarks', '2025-01-02 09:00:00', '2025-01-03 10:00:00');
        """)
        legacy_conn.commit()
        legacy_conn.close()

        current_db_path = database.DB_PATH
        database.DB_PATH = legacy_path
        try:
            database.init_db()
            conn = database.get_db()
            complaint = conn.execute("SELECT * FROM complaints WHERE id = 8").fetchone()
            self.assertEqual(complaint["description"], "Existing complaint")
            self.assertEqual(complaint["admin_remarks"], "Old repair remarks")
            self.assertEqual(complaint["rectified_date"], "2025-01-03")
            self.assertEqual(complaint["department"], "")
            conn.close()
        finally:
            database.DB_PATH = current_db_path


if __name__ == "__main__":
    unittest.main()