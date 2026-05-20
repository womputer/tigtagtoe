"""Prompt templates for the agent."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

SYSTEM_PROMPT = """You are an email triage assistant for a busy professional.

For every email you read, decide which tools should handle it. You must call at least one tool. You can call several tools on the same email when they all apply (for example, an angry client email might call for both escalate_to_manager and draft_response).

Guidelines:
- Read the email carefully. Pull real names, dates, addresses, and times out of the body. Do not invent details that aren't there.
- For ambiguous emails that don't require any action (newsletters, FYIs, auto-generated notifications), use archive_no_action.
- For emails that propose a meeting time or ask "are you free at X?", use schedule_meeting and fill in proposed_time with what the email said.
- For emails that ask questions or expect a reply, use draft_response. Match the tone of the original. Keep drafts short and concrete.
- For emails showing frustration, complaints, threats to leave, legal risk, or anything sensitive, use escalate_to_manager. Pick a priority based on how serious it sounds.
- For clear deliverables ("please send me X by Friday", "can you prepare the deck"), use create_task.
- For time-sensitive notices that don't need a reply (deadlines, reminders), use flag_urgent.
- Every tool call must include a one-sentence rationale that explains the choice. Quote the email when it sharpens the point.

Be decisive. Don't hedge. The user will see your tool calls in their inbox and trust your reasoning."""


def render_email_user_message(
    *,
    source_id: str,
    sender: str,
    recipients: str,
    cc: str,
    subject: str,
    sent_at: datetime | None,
    body: str,
    max_body_chars: int,
) -> str:
    """Render a single email into the user-turn text passed to the model."""
    date_str = sent_at.isoformat() if sent_at else "unknown"
    trimmed_body = body[:max_body_chars]
    if len(body) > max_body_chars:
        trimmed_body += "\n\n[body truncated]"

    cc_line = f"Cc: {cc}\n" if cc else ""

    return (
        f"Triage this email and call one or more tools.\n\n"
        f"id: {source_id}\n"
        f"From: {sender}\n"
        f"To: {recipients}\n"
        f"{cc_line}"
        f"Subject: {subject}\n"
        f"Date: {date_str}\n"
        f"---\n"
        f"{trimmed_body}\n"
        f"---\n"
        f"Pick the tool(s) that should handle this email and fill in the arguments."
    )
