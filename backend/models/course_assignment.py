from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from core.db import Base

import uuid

def gen_id() -> str:
    return str(uuid.uuid4())

class CourseAssignment(Base):
    __tablename__ = "course_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", "assignment_role", name="uq_course_assignment"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id"), index=True)

    # TEACHER or COURSE_LEAD (simple + enough for your case)
    assignment_role: Mapped[str] = mapped_column(String(50), default="TEACHER")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
