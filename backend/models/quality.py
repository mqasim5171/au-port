from datetime import datetime, timezone
from core.base import Base

def gen_id() -> str:
    return str(uuid.uuid4())

class QualityScore(Base):
    __tablename__ = "quality_scores"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    course_id: Mapped[str] = mapped_column(String(36))
    overall_score: Mapped[float] = mapped_column(Float)
    completeness_score: Mapped[float] = mapped_column(Float)
    alignment_score: Mapped[float] = mapped_column(Float)
    feedback_score: Mapped[float] = mapped_column(Float)
    suggestions: Mapped[str] = mapped_column(Text)  # JSON string
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
