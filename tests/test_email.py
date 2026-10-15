import os
import smtplib
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import email_service
import main


class EmailEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()

    @patch.object(main, "send_custom_email")
    def test_send_email_endpoint_accepts_valid_request(self, send_custom_email):
        response = self.client.post(
            "/send-email",
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

    @patch.object(main, "send_custom_email")
    def test_send_email_endpoint_rejects_invalid_email_and_header_newline(
        self, send_custom_email
    ):
        invalid_email = self.client.post(
            "/send-email",
            json={"to_email": "not-an-email", "subject": "Hello", "message": "Body"},
        )
        newline_subject = self.client.post(
            "/send-email",
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
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello",
                "message": "Body",
            },
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "SMTP_EMAIL and SMTP_PASSWORD environment variables must be set.",
        )

    @patch.object(main, "send_custom_email", side_effect=smtplib.SMTPException("SMTP failure"))
    def test_send_email_endpoint_reports_smtp_failure(self, _send_custom_email):
        response = self.client.post(
            "/send-email",
            json={
                "to_email": "recipient@example.com",
                "subject": "Hello",
                "message": "Body",
            },
        )

        self.assertEqual(response.status_code, 502)


class SMTPTransportTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {"SMTP_EMAIL": "sender@gmail.com", "SMTP_PASSWORD": "abcd efgh ijkl mnop"},
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
