# backend/models/assessment.py
import uuid
from datetime import datetime, date, timezone

from sqlalchemy import (
    String,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Table,
    Column,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base import Base

# Association table: Assessment <-> CourseCLO
assessment_clos = Table(
    "assessment_clos",
    Base.metadata,
    Column("assessment_id", UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True),
    Column("clo_id", UUID(as_uuid=True), ForeignKey("course_clos.id", ondelete="CASCADE"), primary_key=True),
)


class Assessment(Base):  # ✅ missing colon fixed
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    type: Mapped[str] = mapped_column(String(20), nullable=False)  # quiz/assignment/midterm/final
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    total_marks: Mapped[int] = mapped_column(Integer, nullable=False)
    weightage: Mapped[int] = mapped_column(Integer, nullable=False)
    date_conducted: Mapped[date] = mapped_column(Date, nullable=False)

    # Many-to-many with CourseCLO
    clos = relationship(
        "CourseCLO",
        secondary=assessment_clos,
        back_populates="assessments",
        lazy="selectin",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
