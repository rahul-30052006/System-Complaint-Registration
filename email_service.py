import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape
from typing import Mapping

from dotenv import load_dotenv
from pydantic import EmailStr, TypeAdapter, ValidationError


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL_VALIDATOR = TypeAdapter(EmailStr)


def _smtp_credentials() -> tuple[str, str]:
    sender = (
        os.getenv("GMAIL_ADDRESS", "").strip()
        or os.getenv("SMTP_EMAIL", "").strip()
    )
    app_password = os.getenv("GMAIL_APP_PASSWORD", "") or os.getenv("SMTP_PASSWORD", "")
    app_password = "".join(app_password.split())

    if not sender or not app_password:
        raise RuntimeError("GMAIL_ADDRESS and GMAIL_APP_PASSWORD must be configured")
    try:
        sender = str(SENDER_EMAIL_VALIDATOR.validate_python(sender))
    except ValidationError as exc:
        raise RuntimeError("GMAIL_ADDRESS must be a valid email address") from exc
    if len(app_password) != 16 or not app_password.isalnum():
        raise RuntimeError("GMAIL_APP_PASSWORD must be a 16-character Google App Password")

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


def send_assignment_email(complaint: Mapping[str, object]) -> None:
    recipient = str(complaint.get("student_email") or "").strip()
    if not recipient:
        raise RuntimeError("The student does not have a registered email address")

    complaint_id = complaint["id"]
    status = str(complaint.get("status") or "Pending")
    technician = str(complaint.get("assigned_technician") or "").strip()
    technician_contact = str(complaint.get("technician_contact") or "").strip()
    visit_at = str(complaint.get("service_visit_at") or "").strip()
    repair_action = str(complaint.get("repair_action") or "").strip()
    admin_remarks = str(complaint.get("admin_remarks") or "").strip()
    location = " - ".join(filter(None, (
        str(complaint.get("lab_name") or "").strip(),
        str(complaint.get("lab_location") or "").strip(),
        str(complaint.get("system_no") or "").strip(),
    )))
    description = str(complaint.get("description") or "").strip()
    instructions = admin_remarks or "Please coordinate with the lab administrator if you need assistance."

    message = EmailMessage()
    message["To"] = recipient
    message["Subject"] = f"Technician assigned for system complaint #{complaint_id}"
    message.set_content(
        f"System Complaint Registration\n\n"
        f"Complaint ID: #{complaint_id}\n"
        f"Issue: {description}\n"
        f"Lab / system: {location}\n"
        f"Current status: {status}\n"
        f"Assigned technician: {technician or 'Not assigned'}\n"
        f"Technician contact: {technician_contact or 'Not provided'}\n"
        f"Scheduled service visit: {visit_at or 'To be confirmed'}\n"
        f"Service instructions: {repair_action or 'No additional instructions provided.'}\n"
        f"Admin remarks: {admin_remarks or 'No additional remarks provided.'}\n"
        f"Contact instructions: {instructions}\n"
    )
    message.add_alternative(
        f"""\
        <html>
          <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:620px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="padding:22px 28px;background:#3730a3;color:#fff">
                <h1 style="margin:0;font-size:21px">System Complaint Registration</h1>
                <p style="margin:8px 0 0">Technician assigned · Complaint #{escape(str(complaint_id))}</p>
              </div>
              <div style="padding:24px 28px">
                <p>Your reported system issue is being handled by our service team.</p>
                <table style="width:100%;border-collapse:collapse">
                  {''.join(
                      f'<tr><th align="left" style="padding:9px;border-bottom:1px solid #e2e8f0;color:#64748b">{escape(label)}</th>'
                      f'<td style="padding:9px;border-bottom:1px solid #e2e8f0">{escape(value)}</td></tr>'
                      for label, value in (
                          ("Issue description", description),
                          ("Lab / system", location),
                          ("Current status", status),
                          ("Assigned technician", technician or "Not assigned"),
                          ("Technician contact", technician_contact or "Not provided"),
                          ("Service visit", visit_at or "To be confirmed"),
                          ("Service instructions", repair_action or "No additional instructions provided."),
                          ("Admin remarks", admin_remarks or "No additional remarks provided."),
                          ("Contact instructions", instructions),
                      )
                  )}
                </table>
                <p style="margin:22px 0 0;color:#475569">Please contact the lab administrator if you need help with this appointment.</p>
              </div>
            </div>
          </body>
        </html>
        """,
        subtype="html",
    )
    _send_message(message)


def send_resolution_email(complaint: Mapping[str, object]) -> None:
    recipient = str(complaint.get("student_email") or "").strip()

    if not recipient:
        raise RuntimeError("The student does not have a registered email address")

    system_location = " - ".join(filter(None, (
        str(complaint.get("lab_name") or ""),
        str(complaint.get("lab_location") or ""),
        str(complaint.get("system_no") or ""),
    )))
    admin_remarks = str(complaint.get("admin_remarks") or "").strip()
    assigned_technician = str(complaint.get("assigned_technician") or "").strip()
    repair_action = str(complaint.get("repair_action") or "").strip()

    message = EmailMessage()
    message["Subject"] = f"System complaint #{complaint['id']} resolved"
    message["To"] = recipient
    message.set_content(
        "System Complaint Registration\n\n"
        "Your reported computer system has been repaired and verified as working normally.\n\n"
        f"Ticket ID: #{complaint['id']}\n"
        f"Student: {complaint.get('student_name') or ''}\n"
        f"System location: {system_location}\n"
        f"Complaint details: {complaint.get('issue_type') or ''} - "
        f"{complaint.get('description') or ''}\n"
        f"Assigned technician: {assigned_technician or 'Not specified'}\n"
        f"Repair action taken: {repair_action or 'Not specified'}\n"
        f"Resolution status: {complaint.get('status') or 'Resolved'}\n"
        f"Technician remarks: {admin_remarks or 'No additional remarks provided.'}\n"
    )
    message.add_alternative(
        f"""\
        <html>
          <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:620px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="padding:22px 28px;background:#047857;color:#fff">
                <h1 style="margin:0;font-size:21px">System Complaint Registration</h1>
                <p style="margin:8px 0 0">Repair completed · Complaint #{escape(str(complaint['id']))}</p>
              </div>
              <div style="padding:24px 28px">
                <p>Your reported system has been repaired and verified. Thank you for your patience.</p>
                <table style="width:100%;border-collapse:collapse">
                  {''.join(
                      f'<tr><th align="left" style="padding:9px;border-bottom:1px solid #e2e8f0;color:#64748b">{escape(label)}</th>'
                      f'<td style="padding:9px;border-bottom:1px solid #e2e8f0">{escape(value)}</td></tr>'
                      for label, value in (
                          ("Complaint ID", f"#{complaint['id']}"),
                          ("Issue", f"{complaint.get('issue_type') or ''} - {complaint.get('description') or ''}"),
                          ("Lab / system", system_location),
                          ("Status", str(complaint.get("status") or "Resolved")),
                          ("Assigned technician", assigned_technician or "Not specified"),
                          ("Repair action", repair_action or "Not specified"),
                          ("Admin remarks", admin_remarks or "No additional remarks provided."),
                      )
                  )}
                </table>
              </div>
            </div>
          </body>
        </html>
        """,
        subtype="html",
    )

    _send_message(message)
