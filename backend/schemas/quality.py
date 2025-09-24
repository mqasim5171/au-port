from pydantic import BaseModel
from typing import List

class QualityOut(BaseModel):
    overall_score: float
    completeness_score: float
    alignment_score: float
    feedback_score: float
    suggestions: List[str]

    class Config:
        from_attributes = True  # ✅ allows .from_orm() to work
