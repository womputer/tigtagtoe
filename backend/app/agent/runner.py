"""Agent run loop.

Processes a set of emails through Claude, persists each tool call with its
rationale, and updates the upload's progress along the way.

Concurrency comes from running several emails in parallel via asyncio +
a bounded semaphore. SQLite writes are quick enough that we don't worry
about a separate executor; each task opens its own short-lived session.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import anthropic
from anthropic import AsyncAnthropic

from app.agent.prompts import SYSTEM_PROMPT, render_email_user_message
from app.agent.tools import TOOLS, split_rationale
from app.config import get_settings
from app.db import session_scope
from app.models import Email, ToolCall, Upload

logger = logging.getLogger(__name__)

# Module-level singletons. Created lazily so importing doesn't require the key.
_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Add it to your .env file."
            )
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _process_one_email(
    email_id: str,
    *,
    semaphore: asyncio.Semaphore,
) -> bool:
    """Run the agent on a single email and persist its tool calls.

    Returns True on success, False on a per-email error. Errors are caught
    and recorded on the email row so the run can continue.
    """
    settings = get_settings()
    client = _get_client()

    async with semaphore:
        # Load the email fresh inside the worker so each task owns its session.
        with session_scope() as db:
            email = db.get(Email, email_id)
            if email is None:
                return False
            email_payload = {
                "source_id": email.source_id,
                "sender": email.sender,
                "recipients": email.recipients,
                "cc": email.cc,
                "subject": email.subject,
                "sent_at": email.sent_at,
                "body": email.body,
            }

        user_message = render_email_user_message(
            **email_payload, max_body_chars=settings.max_body_chars
        )

        try:
            response = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=1024,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=TOOLS,
                tool_choice={"type": "any"},
                messages=[{"role": "user", "content": user_message}],
            )
        except anthropic.RateLimitError as exc:
            logger.warning("Rate limited on %s, backing off: %s", email_id, exc)
            await asyncio.sleep(5)
            return await _process_one_email(email_id, semaphore=semaphore)
        except Exception as exc:  # noqa: BLE001, we want to capture every failure mode
            logger.exception("Agent error on email %s", email_id)
            with session_scope() as db:
                em = db.get(Email, email_id)
                if em is not None:
                    em.agent_status = "error"
                    em.agent_error = f"{type(exc).__name__}: {exc}"[:1000]
            return False

        # Pull tool_use blocks out of the response.
        tool_blocks = [b for b in response.content if b.type == "tool_use"]

        if not tool_blocks:
            # The model declined to call a tool even with tool_choice=any.
            # Treat as an error so it shows up in the UI.
            with session_scope() as db:
                em = db.get(Email, email_id)
                if em is not None:
                    em.agent_status = "error"
                    em.agent_error = "Model returned no tool calls."
            return False

        with session_scope() as db:
            em = db.get(Email, email_id)
            if em is None:
                return False
            for idx, block in enumerate(tool_blocks):
                args, rationale = split_rationale(block.input or {})
                db.add(
                    ToolCall(
                        email_id=em.id,
                        tool_name=block.name,
                        arguments=args,
                        rationale=rationale,
                        order_idx=idx,
                    )
                )
            em.agent_status = "done"
            em.agent_error = None

        return True


async def run_agent_for_upload(upload_id: str) -> None:
    """Run the agent over every pending email in an upload."""
    settings = get_settings()

    with session_scope() as db:
        upload = db.get(Upload, upload_id)
        if upload is None:
            logger.warning("run_agent_for_upload: upload %s not found", upload_id)
            return

        email_ids = [
            e.id
            for e in db.query(Email)
            .filter(Email.upload_id == upload_id)
            .filter(Email.agent_status.in_(("pending", "error")))
            .order_by(Email.created_at.asc())
            .all()
        ]

        if not email_ids:
            upload.agent_status = "done"
            upload.agent_progress = upload.agent_total = upload.email_count
            upload.agent_finished_at = _now()
            return

        # Cap to the per-run safety limit.
        email_ids = email_ids[: settings.max_emails_per_run]

        upload.agent_status = "running"
        upload.agent_progress = 0
        upload.agent_total = len(email_ids)
        upload.agent_started_at = _now()
        upload.agent_finished_at = None
        upload.agent_error_count = 0

    semaphore = asyncio.Semaphore(settings.agent_concurrency)
    error_count = 0
    done_count = 0

    async def worker(eid: str) -> None:
        nonlocal error_count, done_count
        ok = await _process_one_email(eid, semaphore=semaphore)
        if ok:
            done_count += 1
        else:
            error_count += 1
        # Push progress to the DB after each email so the UI can poll.
        with session_scope() as db:
            up = db.get(Upload, upload_id)
            if up is not None:
                up.agent_progress = done_count + error_count
                up.agent_error_count = error_count

    await asyncio.gather(*(worker(eid) for eid in email_ids))

    with session_scope() as db:
        upload = db.get(Upload, upload_id)
        if upload is not None:
            upload.agent_status = "done" if error_count == 0 else "done"
            upload.agent_finished_at = _now()
            upload.agent_progress = done_count + error_count
            upload.agent_error_count = error_count
