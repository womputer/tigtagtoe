"""SQLAlchemy ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    email_count: Mapped[int] = mapped_column(Integer, default=0)

    # Agent run state. Possible values: idle, running, done, error.
    agent_status: Mapped[str] = mapped_column(String(16), default="idle")
    agent_progress: Mapped[int] = mapped_column(Integer, default=0)
    agent_total: Mapped[int] = mapped_column(Integer, default=0)
    agent_error_count: Mapped[int] = mapped_column(Integer, default=0)
    agent_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    agent_finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    emails: Mapped[list["Email"]] = relationship(
        "Email", back_populates="upload", cascade="all, delete-orphan"
    )


class Email(Base):
    __tablename__ = "emails"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    upload_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("uploads.id", ondelete="CASCADE"), index=True
    )

    # The id column from the uploaded CSV. Kept so reviewers can cross-reference.
    source_id: Mapped[str] = mapped_column(String(128), index=True)

    sender: Mapped[str] = mapped_column(String(512), index=True)
    recipients: Mapped[str] = mapped_column(Text, default="")
    cc: Mapped[str] = mapped_column(Text, default="")
    subject: Mapped[str] = mapped_column(String(512), default="", index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, default="")

    # Per-email agent state. pending until the runner touches it.
    agent_status: Mapped[str] = mapped_column(String(16), default="pending")
    agent_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    upload: Mapped["Upload"] = relationship("Upload", back_populates="emails")
    tool_calls: Mapped[list["ToolCall"]] = relationship(
        "ToolCall",
        back_populates="email",
        cascade="all, delete-orphan",
        order_by="ToolCall.order_idx",
    )


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("emails.id", ondelete="CASCADE"), index=True
    )

    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    arguments: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[str] = mapped_column(Text, default="")
    order_idx: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    email: Mapped["Email"] = relationship("Email", back_populates="tool_calls")
