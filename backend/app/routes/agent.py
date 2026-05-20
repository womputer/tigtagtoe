"""Routes for kicking off and observing agent runs."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agent.runner import run_agent_for_upload
from app.db import get_session
from app.models import Upload
from app.schemas import AgentRunRequest, AgentRunResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _kick_off_run(upload_id: str) -> None:
    """Start an asyncio task that runs the agent. Called from a BackgroundTasks
    hook so it runs after the HTTP response is sent."""
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(run_agent_for_upload(upload_id))
    except RuntimeError:
        # No running loop in this thread; run synchronously as a fallback.
        asyncio.run(run_agent_for_upload(upload_id))


@router.post("/run", response_model=AgentRunResponse)
def start_run(
    payload: AgentRunRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_session),
) -> AgentRunResponse:
    upload = db.get(Upload, payload.upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    if upload.agent_status == "running":
        # Idempotent: don't restart, just report current state.
        return AgentRunResponse(
            upload_id=upload.id, status="running", total=upload.agent_total
        )

    background.add_task(_kick_off_run, upload.id)

    return AgentRunResponse(
        upload_id=upload.id, status="queued", total=upload.email_count
    )
