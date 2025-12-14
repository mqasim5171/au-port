# models/grading_audit.py
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, ForeignKey
from core.base import Base

def gen_id() -> str:
    return str(uuid.uuid4())

class GradingAudit(Base):
    __tablename__ = "grading_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    assessment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("assessments.id"), index=True
    )

    metric: Mapped[str] = mapped_column(String(50))  # mean, std_dev, outliers, clo_avg
    value: Mapped[str] = mapped_column(Text)  # store JSON string like {"mean": 14.2}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
