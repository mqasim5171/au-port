from pydantic import BaseModel

class QualityOut(BaseModel):
    course_id: str
    overall_score: float
    completeness_score: float
    alignment_score: float
    feedback_score: float
    suggestions: str
