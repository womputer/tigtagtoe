"""Deterministic mock executors for each tool.

Each function returns a realistic-looking JSON response. Output is derived from
a hash of the inputs, so the same arguments always produce the same output.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any


def _stable_hash(tool: str, args: dict[str, Any]) -> str:
    blob = json.dumps({"tool": tool, "args": args}, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def _stable_id(prefix: str, tool: str, args: dict[str, Any], length: int = 10) -> str:
    return f"{prefix}_{_stable_hash(tool, args)[:length]}"


def _stable_offset_minutes(tool: str, args: dict[str, Any], max_offset: int) -> int:
    h = _stable_hash(tool, args)
    return int(h[:8], 16) % max_offset


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _schedule_meeting(args: dict[str, Any]) -> dict[str, Any]:
    mid = _stable_id("mtg", "schedule_meeting", args)
    duration = int(args.get("duration_minutes") or 30)
    return {
        "status": "scheduled",
        "meeting_id": mid,
        "calendar_link": f"https://calendar.example.com/m/{mid}",
        "subject": args.get("subject", "Meeting"),
        "attendees": args.get("attendees", []),
        "proposed_time": args.get("proposed_time", ""),
        "duration_minutes": duration,
        "confirmation_message": (
            f"Invite sent to {len(args.get('attendees') or [])} attendee(s)."
        ),
    }


def _draft_response(args: dict[str, Any]) -> dict[str, Any]:
    did = _stable_id("dft", "draft_response", args)
    body = args.get("body") or ""
    return {
        "status": "drafted",
        "draft_id": did,
        "to": args.get("to", ""),
        "subject": args.get("subject", ""),
        "tone": args.get("tone", "professional"),
        "preview": body[:280] + ("..." if len(body) > 280 else ""),
        "body": body,
        "word_count": len(body.split()),
        "saved_to": "drafts",
    }


def _escalate_to_manager(args: dict[str, Any]) -> dict[str, Any]:
    tid = _stable_id("esc", "escalate_to_manager", args)
    return {
        "status": "escalated",
        "ticket_id": tid,
        "ticket_url": f"https://tickets.example.com/{tid}",
        "priority": args.get("priority", "medium"),
        "assigned_to": args.get("suggested_owner") or "manager@example.com",
        "reason": args.get("reason", ""),
        "original_email_id": args.get("original_email_id", ""),
        "sla_response_hours": {
            "low": 48, "medium": 24, "high": 8, "critical": 2,
        }.get(args.get("priority"), 24),
    }


def _create_task(args: dict[str, Any]) -> dict[str, Any]:
    tid = _stable_id("tsk", "create_task", args)
    return {
        "status": "created",
        "task_id": tid,
        "task_url": f"https://tasks.example.com/t/{tid}",
        "title": args.get("title", ""),
        "assignee": args.get("assignee") or "you@example.com",
        "due_date": args.get("due_date") or "",
        "board": "Inbox follow-ups",
        "notes": args.get("notes", ""),
    }


def _flag_urgent(args: dict[str, Any]) -> dict[str, Any]:
    fid = _stable_id("flag", "flag_urgent", args)
    # Compute an "expires_at" that's deterministic from the args.
    minutes = _stable_offset_minutes("flag_urgent", args, max_offset=60 * 48) + 60
    return {
        "status": "flagged",
        "flag_id": fid,
        "reason": args.get("reason", ""),
        "deadline": args.get("deadline", ""),
        "expires_at": (_now() + timedelta(minutes=minutes)).isoformat(),
        "pinned_to_top": True,
    }


def _archive_no_action(args: dict[str, Any]) -> dict[str, Any]:
    aid = _stable_id("arc", "archive_no_action", args)
    return {
        "status": "archived",
        "archive_id": aid,
        "category": args.get("category", "other"),
        "reason": args.get("reason", ""),
        "folder": f"Archive/{args.get('category', 'other')}",
    }


_EXECUTORS = {
    "schedule_meeting": _schedule_meeting,
    "draft_response": _draft_response,
    "escalate_to_manager": _escalate_to_manager,
    "create_task": _create_task,
    "flag_urgent": _flag_urgent,
    "archive_no_action": _archive_no_action,
}


def execute_mock(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Run the mock executor for a given tool. Raises KeyError on unknown tools."""
    if tool_name not in _EXECUTORS:
        raise KeyError(f"Unknown tool: {tool_name}")
    return _EXECUTORS[tool_name](arguments or {})
