import os
import tempfile
import unittest

import database
import main
from auth import verify_access_token, verify_password
from fastapi import HTTPException
from main import LoginRequest, RegisterRequest


class AuthenticationFlowTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        database.DB_PATH = os.path.join(self.temp_dir.name, "test_complaints.db")
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def register_student(self, username="student-01", email="student@example.com"):
        return main.register_student(RegisterRequest(
            username=username,
            full_name="Test Student",
            email=email,
            password="StrongTestPassword!",
        ))

    def test_signup_persists_student_fields_and_password_hash(self):
        result = self.register_student()
        conn = database.get_db()
        stored = conn.execute(
            "SELECT username, full_name, email, password_hash FROM users WHERE id = ?",
            (result["user"]["id"],),
        ).fetchone()
        conn.close()

        self.assertEqual(stored["username"], "student-01")
        self.assertEqual(stored["full_name"], "Test Student")
        self.assertEqual(stored["email"], "student@example.com")
        self.assertNotEqual(stored["password_hash"], "StrongTestPassword!")
        self.assertTrue(verify_password("StrongTestPassword!", stored["password_hash"]))

    def test_login_with_username(self):
        self.register_student()

        result = main.login(LoginRequest(
            login_id="student-01",
            password="StrongTestPassword!",
        ))

        self.assertEqual(result["user"]["username"], "student-01")
        self.assertTrue(result["access_token"])

    def test_login_with_email_ignores_email_case(self):
        self.register_student(email="student@example.com")

        result = main.login(LoginRequest(
            login_id="STUDENT@EXAMPLE.COM",
            password="StrongTestPassword!",
        ))

        self.assertEqual(result["user"]["email"], "student@example.com")

    def test_existing_mixed_case_email_can_log_in(self):
        conn = database.get_db()
        conn.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'student', ?)
        """, (
            "legacy-student",
            "Legacy Student",
            "Legacy.Student@Example.COM",
            main.hash_password("StrongTestPassword!"),
            "2024-01-01 00:00:00",
        ))
        conn.commit()
        conn.close()

        result = main.login(LoginRequest(
            login_id="legacy.student@example.com",
            password="StrongTestPassword!",
        ))

        self.assertEqual(result["user"]["username"], "legacy-student")

    def test_incorrect_password_is_rejected(self):
        self.register_student()

        with self.assertRaises(HTTPException) as raised:
            main.login(LoginRequest(login_id="student-01", password="incorrect"))

        self.assertEqual(raised.exception.status_code, 401)

    def test_email_duplicate_check_is_case_insensitive(self):
        self.register_student(email="student@example.com")

        with self.assertRaises(HTTPException) as raised:
            self.register_student(username="another-student", email="STUDENT@EXAMPLE.COM")

        self.assertEqual(raised.exception.status_code, 400)

    def test_duplicate_username_is_rejected(self):
        self.register_student()

        with self.assertRaises(HTTPException) as raised:
            self.register_student(email="another@example.com")

        self.assertEqual(raised.exception.status_code, 400)

    def test_login_succeeds_again_after_client_logout(self):
        self.register_student()
        first_login = main.login(LoginRequest(
            login_id="student-01",
            password="StrongTestPassword!",
        ))
        self.assertIsNotNone(verify_access_token(first_login["access_token"]))

        # Logout clears the browser token; login itself is stateless.
        second_login = main.login(LoginRequest(
            login_id="student-01",
            password="StrongTestPassword!",
        ))

        self.assertTrue(second_login["access_token"])
        self.assertEqual(second_login["user"]["id"], first_login["user"]["id"])

    def test_admin_login_remains_supported(self):
        conn = database.get_db()
        conn.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, 'admin', ?)
        """, (
            "test-admin",
            "Test Admin",
            "admin@example.com",
            main.hash_password("AdminPassword!"),
            "2024-01-01 00:00:00",
        ))
        conn.commit()
        conn.close()

        result = main.login(LoginRequest(login_id="admin@example.com", password="AdminPassword!"))

        self.assertEqual(result["user"]["role"], "admin")


if __name__ == "__main__":
    unittest.main()