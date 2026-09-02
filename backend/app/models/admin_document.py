from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column

import secrets

from app.database.database import Base


class AdminDocument(Base):

    __tablename__ = "admin_documents"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    # --------------------------------------------------
    # FILE INFORMATION
    # --------------------------------------------------

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
        default="General",
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

    # --------------------------------------------------
    # ACCESS
    #
    # all       -> every employee
    # department -> employees in department
    # employee   -> specific employee
    # --------------------------------------------------

    access_type: Mapped[str] = mapped_column(
        String(30),
        default="all",
        nullable=False
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True,
        index=True
    )

    # --------------------------------------------------
    # PERMISSIONS
    # --------------------------------------------------

    can_view: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    can_download: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    # --------------------------------------------------
    # ADMIN WHO UPLOADED
    # --------------------------------------------------

    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
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
        ForeignKey("admin_documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Physical storage directory. Parent admin uploads live in the admin
    # directory; employee-side ZIP extractions are stored in the employee's
    # own directory.
    storage_directory: Mapped[str | None] = mapped_column(
        String(100),
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