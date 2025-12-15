# schemas/assessment_question.py
from pydantic import BaseModel
from typing import List, Optional

class AssessmentQuestionCreate(BaseModel):
    label: str
    max_marks: int
    text: Optional[str]

class QuestionCLOMap(BaseModel):
    clo_ids: List[str]
