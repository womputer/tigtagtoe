"""List and detail routes for processed emails."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_session
from app.models import Email, ToolCall
from app.schemas import (
    EmailDetail,
    EmailListItem,
    EmailListResponse,
    ToolCallOut,
)

router = APIRouter(prefix="/api/emails", tags=["emails"])


@router.get("", response_model=EmailListResponse)
def list_emails(
    upload_id: str | None = Query(default=None),
    tool: str | None = Query(default=None, description="Filter by suggested tool name."),
    q: str | None = Query(default=None, description="Search sender or subject."),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_session),
) -> EmailListResponse:
    stmt = select(Email).options(joinedload(Email.tool_calls))

    if upload_id:
        stmt = stmt.where(Email.upload_id == upload_id)

    if tool:
        # Only emails that have at least one tool call with this name.
        stmt = stmt.where(
            Email.id.in_(select(ToolCall.email_id).where(ToolCall.tool_name == tool))
        )

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Email.sender.ilike(like), Email.subject.ilike(like)))

    stmt = stmt.order_by(Email.sent_at.desc().nullslast(), Email.created_at.desc())

    # Total count without pagination, for the UI.
    total_stmt = select(Email)
    if upload_id:
        total_stmt = total_stmt.where(Email.upload_id == upload_id)
    if tool:
        total_stmt = total_stmt.where(
            Email.id.in_(select(ToolCall.email_id).where(ToolCall.tool_name == tool))
        )
    if q:
        like = f"%{q.strip()}%"
        total_stmt = total_stmt.where(
            or_(Email.sender.ilike(like), Email.subject.ilike(like))
        )
    total = len(db.execute(total_stmt).all())

    rows = db.execute(stmt.limit(limit).offset(offset)).unique().scalars().all()

    items: list[EmailListItem] = []
    for e in rows:
        tools_seen: list[str] = []
        for tc in e.tool_calls:
            if tc.tool_name not in tools_seen:
                tools_seen.append(tc.tool_name)
        items.append(
            EmailListItem(
                id=e.id,
                source_id=e.source_id,
                sender=e.sender,
                subject=e.subject,
                sent_at=e.sent_at,
                agent_status=e.agent_status,
                tools=tools_seen,
            )
        )

    return EmailListResponse(items=items, total=total)


@router.get("/{email_id}", response_model=EmailDetail)
def get_email(email_id: str, db: Session = Depends(get_session)) -> EmailDetail:
    email = db.get(Email, email_id)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email not found."
        )
    return EmailDetail(
        id=email.id,
        upload_id=email.upload_id,
        source_id=email.source_id,
        sender=email.sender,
        recipients=email.recipients,
        cc=email.cc,
        subject=email.subject,
        sent_at=email.sent_at,
        body=email.body,
        agent_status=email.agent_status,
        agent_error=email.agent_error,
        tool_calls=[
            ToolCallOut(
                id=tc.id,
                tool_name=tc.tool_name,
                arguments=tc.arguments or {},
                rationale=tc.rationale,
                order_idx=tc.order_idx,
            )
            for tc in email.tool_calls
        ],
    )
