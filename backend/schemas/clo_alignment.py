# schemas/clo_alignment.py
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class CLOPair(BaseModel):
    clo: str
    assessment: str   # renamed for clarity
    similarity: float





class AssessmentItem(BaseModel):
    name: str

class CLOAlignmentRequest(BaseModel):
    clos: List[str]
    assessments: List[AssessmentItem]

class CLOAlignmentResponse(BaseModel):
    avg_top: float
    flags: List[str] = Field(default_factory=list)
    pairs: List[CLOPair]
    clos: List[str]
    assessments: List[AssessmentItem]
    # mapping clo -> {best_assessment: str, similarity: float}
    alignment: Dict[str, Dict[str, str | float]]

class CLOAlignmentAutoResponse(BaseModel):
    clos: List[str]
    assessments: List[str]
    alignment: Dict[str, Dict[str, float]]
