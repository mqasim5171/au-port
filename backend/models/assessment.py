# backend/models/assessment.py

import uuid
from datetime import datetime, timezone, date

from sqlalchemy import String, Integer, Date, DateTime, Table, Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base import Base  # ✅ IMPORTANT (this fixes your NameError)


# ✅ Association table MUST be defined before the relationship uses it
assessment_clos = Table(
    "assessment_clos",
    Base.metadata,
    Column("assessment_id", UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True),
    Column("clo_id", UUID(as_uuid=True), ForeignKey("course_clos.id", ondelete="CASCADE"), primary_key=True),
)

class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), index=True, nullable=False
    )

    type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    total_marks: Mapped[int] = mapped_column(Integer, nullable=False)
    weightage: Mapped[int] = mapped_column(Integer, nullable=False)
    date_conducted: Mapped[date] = mapped_column(Date, nullable=False)

    clos = relationship(
        "CourseCLO",
        secondary=assessment_clos,
        back_populates="assessments",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
