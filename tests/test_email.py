import os
import smtplib
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import database
import email_service
import main
from main import LoginRequest


class EmailEndpointTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        database.DB_PATH = os.path.join(self.temp_dir.name, "email_test.db")
        database.init_db()
        conn = database.get_db()
        conn.execute(
            "INSERT INTO users (username, full_name, email, password_hash, role, created_at) "
            "VALUES (?, ?, ?, ?, 'admin', ?)",
            (
                "email-admin",
                "Email Admin",
                "email-admin@example.com",
                main.hash_password("AdminPassword123!"),
                "2026-01-01 00:00:00",
            ),
        )
        conn.commit()
        conn.close()
        token = main.login(
            LoginRequest(login_id="email-admin", password="AdminPassword123!")
        )["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {token}"}
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    @patch.object(main, "send_custom_email")
    def test_send_email_endpoint_accepts_valid_request(self, send_custom_email):
        response = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={
                "to_email": "recipient@example.com",
                "subject": "Complaint update",
                "message": "Your complaint was received.",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Email sent successfully"})
        send_custom_email.assert_called_once_with(
            "recipient@example.com",
            "Complaint update",
            "Your complaint was received.",
        )

    def test_send_email_endpoint_requires_admin(self):
        response = self.client.post(
            "/send-email",
            json={
                "to_email": "recipient@example.com",
                "subject": "Complaint update",
                "message": "Your complaint was received.",
            },
        )
        self.assertEqual(response.status_code, 401)

    @patch.object(main, "send_custom_email")
    def test_send_email_endpoint_rejects_invalid_email_and_header_newline(
        self, send_custom_email
    ):
        invalid_email = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={"to_email": "not-an-email", "subject": "Hello", "message": "Body"},
        )
        newline_subject = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello\r\nBcc: other@example.com",
                "message": "Body",
            },
        )

        self.assertEqual(invalid_email.status_code, 422)
        self.assertEqual(newline_subject.status_code, 422)
        send_custom_email.assert_not_called()

    @patch.dict(os.environ, {}, clear=True)
    def test_send_email_endpoint_reports_missing_smtp_configuration(self):
        response = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello",
                "message": "Body",
            },
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "GMAIL_ADDRESS and GMAIL_APP_PASSWORD environment variables must be set.",
        )

    @patch.object(main, "send_custom_email", side_effect=smtplib.SMTPException("SMTP failure"))
    def test_send_email_endpoint_reports_smtp_failure(self, _send_custom_email):
        response = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello",
                "message": "Body",
            },
        )

        self.assertEqual(response.status_code, 502)

    @patch.object(
        main,
        "send_custom_email",
        side_effect=smtplib.SMTPAuthenticationError(535, b"credentials rejected"),
    )
    def test_send_email_endpoint_reports_actionable_authentication_failure(self, _send_custom_email):
        response = self.client.post(
            "/send-email",
            headers=self.admin_headers,
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello",
                "message": "Body",
            },
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("GMAIL_ADDRESS", response.json()["detail"])
        self.assertIn("Google App Password", response.json()["detail"])
        self.assertNotIn("credentials rejected", response.json()["detail"])


class SMTPTransportTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {"GMAIL_ADDRESS": "sender@gmail.com", "GMAIL_APP_PASSWORD": "abcd efgh ijkl mnop"},
        clear=True,
    )
    @patch("email_service.smtplib.SMTP")
    @patch("email_service.ssl.create_default_context")
    def test_custom_email_uses_gmail_starttls(self, create_context, smtp_factory):
        context = create_context.return_value
        smtp = smtp_factory.return_value.__enter__.return_value

        email_service.send_custom_email(
            "recipient@example.com",
            "Complaint update",
            "Your complaint was received.",
        )

        smtp_factory.assert_called_once_with("smtp.gmail.com", 587, timeout=20)
        smtp.ehlo.assert_any_call()
        smtp.starttls.assert_called_once_with(context=context)
        smtp.login.assert_called_once_with("sender@gmail.com", "abcdefghijklmnop")
        sent_message = smtp.send_message.call_args.args[0]
        self.assertEqual(sent_message["From"], "sender@gmail.com")
        self.assertEqual(sent_message["To"], "recipient@example.com")
        self.assertEqual(sent_message["Subject"], "Complaint update")

    @patch.object(email_service, "_send_message")
    def test_assignment_email_has_html_and_plain_text_and_escapes_user_content(
        self, send_message
    ):
        email_service.send_assignment_email({
            "id": 17,
            "student_email": "student@example.com",
            "description": "<script>alert('x')</script>",
            "lab_name": "UG Lab",
            "lab_location": "Block A",
            "system_no": "PC-17",
            "status": "Technician Assigned",
            "assigned_technician": "Jordan Technician",
            "technician_contact": "555-0100",
            "service_visit_at": "2026-10-20T10:30",
            "repair_action": "Inspect the system.",
            "admin_remarks": "Please bring your ID.",
        })

        message = send_message.call_args.args[0]
        self.assertEqual(message["Subject"], "Technician assigned for system complaint #17")
        plain_body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("<script>alert('x')</script>", plain_body)
        html_body = message.get_body(preferencelist=("html",)).get_content()
        self.assertIn("&lt;script&gt;", html_body)
        self.assertIn("555-0100", html_body)
        self.assertIn("2026-10-20T10:30", html_body)
        for expected in (
            "Complaint ID: #17",
            "Issue:",
            "UG Lab - Block A - PC-17",
            "Technician Assigned",
            "Jordan Technician",
            "Please bring your ID.",
        ):
            self.assertIn(expected, plain_body)

    @patch.object(email_service, "_send_message")
    def test_assignment_email_uses_clear_fallbacks_for_optional_values(self, send_message):
        email_service.send_assignment_email({
            "id": 18,
            "student_email": "student@example.com",
            "description": "No display.",
            "lab_name": "UG Lab",
            "system_no": "PC-18",
            "status": "In Progress",
            "assigned_technician": "Taylor Technician",
            "technician_contact": None,
            "service_visit_at": None,
            "repair_action": None,
            "admin_remarks": None,
        })

        message = send_message.call_args.args[0]
        plain_body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("Technician contact: Not provided", plain_body)
        self.assertIn("Scheduled service visit: To be confirmed", plain_body)
        self.assertNotIn("None", plain_body)

    @patch.dict(
        os.environ,
        {"GMAIL_ADDRESS": "sender@gmail.com", "GMAIL_APP_PASSWORD": "not-a-valid-app-password"},
        clear=True,
    )
    def test_smtp_configuration_rejects_non_app_password(self):
        with self.assertRaisesRegex(RuntimeError, "16-character Google App Password"):
            email_service._smtp_credentials()
