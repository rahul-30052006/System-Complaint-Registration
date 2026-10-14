import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Mapping


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def send_resolution_email(complaint: Mapping[str, object]) -> None:
    sender = os.getenv("GMAIL_ADDRESS", "").strip()
    app_password = "".join(os.getenv("GMAIL_APP_PASSWORD", "").split())
    recipient = str(complaint.get("student_email", "")).strip()

    if not sender or not app_password:
        raise RuntimeError("GMAIL_ADDRESS and GMAIL_APP_PASSWORD must be configured")
    if not recipient:
        raise RuntimeError("The student does not have a registered email address")

    system_location = " - ".join(filter(None, (
        str(complaint.get("lab_name", "")),
        str(complaint.get("lab_location", "")),
        str(complaint.get("system_no", "")),
    )))
    admin_remarks = str(complaint.get("admin_remarks", "")).strip()

    message = EmailMessage()
    message["Subject"] = f"System complaint #{complaint['id']} resolved"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        "Your reported computer system has been repaired and verified as working normally.\n\n"
        f"Ticket ID: #{complaint['id']}\n"
        f"Student: {complaint.get('student_name', '')}\n"
        f"System location: {system_location}\n"
        f"Complaint details: {complaint.get('issue_type', '')} - "
        f"{complaint.get('description', '')}\n"
        f"Resolution status: {complaint.get('status', 'Resolved')}\n"
        f"Admin remarks: {admin_remarks or 'No additional remarks provided.'}\n"
    )

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=20) as smtp:
        smtp.login(sender, app_password)
        smtp.send_message(message)
