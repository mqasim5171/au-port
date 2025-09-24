from sqlalchemy import Column, String, Float, Text, DateTime
import uuid
from datetime import datetime, timezone
from core.base import Base

def gen_id() -> str:
    return str(uuid.uuid4())

class QualityScore(Base):
    __tablename__ = "quality_scores"
    
    id = Column(String, primary_key=True)
    course_id = Column(String, nullable=False)  # this should store UUID
    overall_score = Column(Float)
    completeness_score = Column(Float)
    alignment_score = Column(Float)
    feedback_score = Column(Float)
    suggestions = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))  # ✅ new default