"""Pydantic models for request and response bodies."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class UploadCreateResponse(BaseModel):
    upload_id: str
    email_count: int
    warnings: list[str] = Field(default_factory=list)


class UploadStatusResponse(BaseModel):
    # The SQL model exposes this column as `id`; we surface it as
    # `upload_id` in the API so callers don't have to disambiguate
    # against email ids in the same response.
    upload_id: str = Field(validation_alias="id", serialization_alias="upload_id")
    filename: str
    email_count: int
    agent_status: str  # idle | running | done | error
    agent_progress: int
    agent_total: int
    agent_error_count: int
    agent_started_at: Optional[datetime] = None
    agent_finished_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ToolCallOut(BaseModel):
    id: str
    tool_name: str
    arguments: dict[str, Any]
    rationale: str
    order_idx: int

    model_config = ConfigDict(from_attributes=True)


class EmailListItem(BaseModel):
    id: str
    source_id: str
    sender: str
    subject: str
    sent_at: Optional[datetime] = None
    agent_status: str
    tools: list[str]  # distinct tool names suggested by the agent

    model_config = ConfigDict(from_attributes=True)


class EmailListResponse(BaseModel):
    items: list[EmailListItem]
    total: int


class EmailDetail(BaseModel):
    id: str
    upload_id: str
    source_id: str
    sender: str
    recipients: str
    cc: str
    subject: str
    sent_at: Optional[datetime] = None
    body: str
    agent_status: str
    agent_error: Optional[str] = None
    tool_calls: list[ToolCallOut]

    model_config = ConfigDict(from_attributes=True)


class ToolExecuteRequest(BaseModel):
    arguments: dict[str, Any]


class ToolExecuteResponse(BaseModel):
    tool: str
    arguments: dict[str, Any]
    result: dict[str, Any]


class AgentRunRequest(BaseModel):
    upload_id: str


class AgentRunResponse(BaseModel):
    upload_id: str
    status: str
    total: int


class ErrorResponse(BaseModel):
    detail: str
