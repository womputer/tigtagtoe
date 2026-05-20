"""Tool catalog for the agent.

Each tool follows Anthropic's tool-use input schema. Every tool requires a
`rationale` field, so the model is forced to explain its choice. The rationale
is stripped from arguments before mock execution.
"""

from __future__ import annotations

from typing import Any

RATIONALE_FIELD = "rationale"

RATIONALE_PROP = {
    "type": "string",
    "description": (
        "One short sentence explaining why this tool fits the email. "
        "Quote the email when it helps."
    ),
}


TOOLS: list[dict[str, Any]] = [
    {
        "name": "schedule_meeting",
        "description": (
            "Book a meeting when the email proposes one, asks for a time, or "
            "names a specific availability window."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Email addresses of everyone who should attend.",
                },
                "proposed_time": {
                    "type": "string",
                    "description": "ISO-8601 timestamp or human description if no specific time was given.",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Best-guess duration. Default to 30 if unstated.",
                },
                "subject": {
                    "type": "string",
                    "description": "Short subject line for the calendar event.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["attendees", "proposed_time", "subject", RATIONALE_FIELD],
        },
    },
    {
        "name": "draft_response",
        "description": (
            "Draft a reply when the email asks a question, expects an answer, "
            "or requires acknowledgement."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient address for the reply.",
                },
                "subject": {
                    "type": "string",
                    "description": "Reply subject, typically 'Re: ...'.",
                },
                "body": {
                    "type": "string",
                    "description": "The full draft reply.",
                },
                "tone": {
                    "type": "string",
                    "description": "One of: professional, friendly, apologetic, brief, formal.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["to", "subject", "body", "tone", RATIONALE_FIELD],
        },
    },
    {
        "name": "escalate_to_manager",
        "description": (
            "Flag emails that show client dissatisfaction, threats to leave, "
            "regulatory or legal risk, or anything a manager should see."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Why this needs management attention.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                },
                "original_email_id": {
                    "type": "string",
                    "description": "The id of the email being escalated.",
                },
                "suggested_owner": {
                    "type": "string",
                    "description": "Email address of the manager who should own this.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["reason", "priority", "original_email_id", RATIONALE_FIELD],
        },
    },
    {
        "name": "create_task",
        "description": (
            "Create a follow-up task when the email contains a clear action item, "
            "deliverable, or commitment to track."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short imperative title for the task.",
                },
                "due_date": {
                    "type": "string",
                    "description": "ISO date if mentioned, otherwise leave empty.",
                },
                "assignee": {
                    "type": "string",
                    "description": "Email address of the person responsible.",
                },
                "notes": {
                    "type": "string",
                    "description": "Extra context the assignee will need.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["title", "assignee", RATIONALE_FIELD],
        },
    },
    {
        "name": "flag_urgent",
        "description": (
            "Mark emails that are time-sensitive but don't require an immediate "
            "reply, so the user sees them at the top of the inbox."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Why this is time-sensitive.",
                },
                "deadline": {
                    "type": "string",
                    "description": "ISO date or natural-language deadline.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["reason", RATIONALE_FIELD],
        },
    },
    {
        "name": "archive_no_action",
        "description": (
            "Archive newsletters, FYIs, system notifications, and other emails "
            "that need no follow-up."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["newsletter", "fyi", "automated", "social", "promotional", "other"],
                },
                "reason": {
                    "type": "string",
                    "description": "Why no action is needed.",
                },
                RATIONALE_FIELD: RATIONALE_PROP,
            },
            "required": ["category", "reason", RATIONALE_FIELD],
        },
    },
]


TOOL_NAMES: set[str] = {t["name"] for t in TOOLS}


def split_rationale(arguments: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Return (arguments_without_rationale, rationale_text)."""
    args = dict(arguments)
    rationale = (args.pop(RATIONALE_FIELD, "") or "").strip()
    return args, rationale


def get_tool_definition(name: str) -> dict[str, Any] | None:
    for tool in TOOLS:
        if tool["name"] == name:
            return tool
    return None
