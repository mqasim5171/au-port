# backend/models/student_submission.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Float, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base import Base


def utcnow():
    return datetime.now(timezone.utc)


class StudentSubmission(Base):
    __tablename__ = "student_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # students.id is varchar(36)
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("students.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # uploads.id is UUID
    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploads.id", ondelete="SET NULL"),
        nullable=True,
    )

    # DB column exists (you added it) OR add it if missing
    status: Mapped[str] = mapped_column(
        String(30),
        default="uploaded",
        nullable=False,
    )

    # DB columns exist (add them if missing)
    ai_marks: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    evidence_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ✅ IMPORTANT FIX:
    # DB uses submitted_at (NOT NULL). We keep your API field name "created_at",
    # but map it to the DB column "submitted_at".
    created_at: Mapped[datetime] = mapped_column(
        "submitted_at",
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    # relationships
    assessment = relationship("Assessment", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")
