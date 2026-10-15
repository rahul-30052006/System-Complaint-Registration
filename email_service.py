import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Mapping

from dotenv import load_dotenv


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _smtp_credentials() -> tuple[str, str]:
    sender = os.getenv("SMTP_EMAIL", "").strip() or os.getenv("GMAIL_ADDRESS", "").strip()
    app_password = os.getenv("SMTP_PASSWORD", "") or os.getenv("GMAIL_APP_PASSWORD", "")
    app_password = "".join(app_password.split())

    if not sender or not app_password:
        raise RuntimeError("SMTP_EMAIL and SMTP_PASSWORD must be configured")

    return sender, app_password


def _send_message(message: EmailMessage) -> None:
    sender, app_password = _smtp_credentials()
    message["From"] = sender

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(sender, app_password)
        smtp.send_message(message)


def send_custom_email(to_email: str, subject: str, content: str) -> None:
    message = EmailMessage()
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(content)
    _send_message(message)


def send_resolution_email(complaint: Mapping[str, object]) -> None:
    recipient = str(complaint.get("student_email", "")).strip()

    if not recipient:
        raise RuntimeError("The student does not have a registered email address")

    system_location = " - ".join(filter(None, (
        str(complaint.get("lab_name", "")),
        str(complaint.get("lab_location", "")),
        str(complaint.get("system_no", "")),
    )))
    admin_remarks = str(complaint.get("admin_remarks", "")).strip()
    assigned_technician = str(complaint.get("assigned_technician", "")).strip()
    repair_action = str(complaint.get("repair_action", "")).strip()

    message = EmailMessage()
    message["Subject"] = f"System complaint #{complaint['id']} resolved"
    message["To"] = recipient
    message.set_content(
        "Your reported computer system has been repaired and verified as working normally.\n\n"
        f"Ticket ID: #{complaint['id']}\n"
        f"Student: {complaint.get('student_name', '')}\n"
        f"System location: {system_location}\n"
        f"Complaint details: {complaint.get('issue_type', '')} - "
        f"{complaint.get('description', '')}\n"
        f"Assigned technician: {assigned_technician or 'Not specified'}\n"
        f"Repair action taken: {repair_action or 'Not specified'}\n"
        f"Resolution status: {complaint.get('status', 'Resolved')}\n"
        f"Technician remarks: {admin_remarks or 'No additional remarks provided.'}\n"
    )

    _send_message(message)
