# backend/app/services/email_service.py
#
# Sends transactional emails via SMTP (Gmail App Password by default).
# All config is driven by Settings — no hardcoded credentials.
#
# Usage:
#   from app.services.email_service import send_invite_email
#   send_invite_email(to="person@example.com", token="abc123", business_name="Acme")
#
# Retry policy:
#   3 attempts with 2-second back-off.  On final failure the error is logged
#   but NOT raised — the invite row is already committed, so the business
#   owner can resend manually rather than losing the DB record.

from __future__ import annotations

import logging
import smtplib
import ssl
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Retry config ──────────────────────────────────────────────────────────────
MAX_ATTEMPTS = 3
RETRY_DELAY  = 2  # seconds between attempts


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_invite_message(to: str, token: str, business_name: str) -> MIMEMultipart:
    """Build the MIME message for a team invite email."""
    deep_link = f"{settings.APP_DEEP_LINK_SCHEME}://team/accept/{token}"
    web_link  = f"{settings.FRONTEND_URL}/team/accept?token={token}"

    subject = f"You've been invited to join {business_name} on CompliancePro"

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body  {{ font-family: Arial, sans-serif; background: #f3faff; margin: 0; padding: 0; }}
    .wrap {{ max-width: 560px; margin: 40px auto; background: #ffffff;
             border-radius: 12px; border: 1px solid #c5c6cf; overflow: hidden; }}
    .hdr  {{ background: #000b25; padding: 28px 32px; }}
    .hdr h1 {{ color: #ffffff; font-size: 20px; margin: 0; }}
    .hdr p  {{ color: #dbf1fe; font-size: 13px; margin: 6px 0 0; }}
    .body {{ padding: 32px; }}
    .body p  {{ color: #44474e; font-size: 15px; line-height: 1.6; }}
    .body strong {{ color: #000b25; }}
    .btn  {{ display: inline-block; margin: 24px 0 8px;
             background: #2a6b2c; color: #ffffff !important;
             padding: 14px 28px; border-radius: 8px;
             text-decoration: none; font-size: 15px; font-weight: 600; }}
    .alt  {{ color: #75777f; font-size: 12px; word-break: break-all; }}
    .ftr  {{ background: #f3faff; padding: 18px 32px;
             border-top: 1px solid #e6f6ff; }}
    .ftr p {{ color: #75777f; font-size: 12px; margin: 0; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>CompliancePro Botswana</h1>
      <p>Business Compliance Intelligence</p>
    </div>
    <div class="body">
      <p>You have been invited to join <strong>{business_name}</strong> as an accountant on CompliancePro Botswana.</p>
      <p>Click the button below to accept the invitation. If you don't have an account yet, you'll be able to create one first.</p>
      <a href="{web_link}" class="btn">Accept Invitation</a>
      <p>Or open the CompliancePro app and tap <strong>Accept</strong> using this link:</p>
      <p class="alt">{deep_link}</p>
      <p style="margin-top:24px; color:#75777f; font-size:13px;">
        This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
      </p>
    </div>
    <div class="ftr">
      <p>CompliancePro Botswana &bull; Gaborone, Botswana</p>
    </div>
  </div>
</body>
</html>
"""

    text_body = (
        f"You've been invited to join {business_name} on CompliancePro Botswana.\n\n"
        f"Accept your invitation here:\n{web_link}\n\n"
        f"Or open the app with this link:\n{deep_link}\n\n"
        "This invitation expires in 7 days.\n"
        "If you did not expect this email, please ignore it."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"CompliancePro Botswana <{settings.SMTP_FROM_EMAIL}>"
    msg["To"]      = to
    msg["Reply-To"] = settings.SMTP_FROM_EMAIL

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))
    return msg


def _smtp_send(msg: MIMEMultipart, to: str) -> None:
    """Open an SMTP connection and send one message. Raises on failure."""
    context = ssl.create_default_context()

    if settings.SMTP_USE_SSL:
        # Port 465 — direct SSL (Gmail default)
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to], msg.as_string())
    else:
        # Port 587 — STARTTLS (SendGrid, Mailgun, Office 365, etc.)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to], msg.as_string())


# ── Public API ────────────────────────────────────────────────────────────────

def send_invite_email(to: str, token: str, business_name: str) -> bool:
    """
    Send a team invite email.

    Returns True on success, False if all retry attempts fail.
    Never raises — failures are logged so the invite DB row is preserved.
    """
    if not settings.SMTP_HOST:
        logger.warning(
            "[email] SMTP_HOST is not configured — skipping invite email to %s. "
            "Set SMTP_* variables in .env to enable email delivery.",
            to,
        )
        return False

    msg = _build_invite_message(to=to, token=token, business_name=business_name)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            logger.info("[email] Sending invite to %s (attempt %d/%d)", to, attempt, MAX_ATTEMPTS)
            _smtp_send(msg, to)
            logger.info("[email] Invite sent successfully to %s", to)
            return True
        except smtplib.SMTPAuthenticationError as exc:
            # Auth errors won't improve with a retry — fail fast
            logger.error(
                "[email] SMTP authentication failed — check SMTP_USERNAME / SMTP_PASSWORD. Error: %s",
                exc,
            )
            return False
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[email] Attempt %d/%d failed for %s: %s",
                attempt, MAX_ATTEMPTS, to, exc,
            )
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY)

    logger.error(
        "[email] All %d attempts failed for %s. "
        "The invite token is still valid — the user can be re-invited.",
        MAX_ATTEMPTS, to,
    )
    return False


def send_test_email(to: str) -> bool:
    """
    Send a plain test email to verify SMTP config.
    Call via: POST /v1/team/test-email?to=you@example.com  (dev only, DEBUG=true)
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "CompliancePro — SMTP Test"
    msg["From"]    = f"CompliancePro <{settings.SMTP_FROM_EMAIL}>"
    msg["To"]      = to
    msg.attach(MIMEText("SMTP is configured correctly. This is a test email from CompliancePro Botswana.", "plain"))

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            _smtp_send(msg, to)
            logger.info("[email] Test email delivered to %s", to)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("[email] Test email attempt %d failed: %s", attempt, exc)
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY)
    return False