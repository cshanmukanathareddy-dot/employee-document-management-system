from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from sqlalchemy.orm import Mapped, mapped_column

import secrets

from app.database.database import Base


class Document(Base):

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    document_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    stored_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    category: Mapped[str] = mapped_column(
        String(100),
        default="Other",
        nullable=False
    )

    file_type: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )

    # --------------------------------------------------
    # DOCUMENT APPROVAL
    # --------------------------------------------------

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )


    # --------------------------------------------------
    # ZIP / FOLDER SUPPORT
    # --------------------------------------------------

    is_archive: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    extracted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    parent_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # --------------------------------------------------
    # PUBLIC SHARE LINK
    # --------------------------------------------------

    share_token: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: secrets.token_urlsafe(32),
    )

    # --------------------------------------------------
    # DATES
    # --------------------------------------------------

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )