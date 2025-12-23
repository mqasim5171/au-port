# backend/schemas/clo_alignment.py

from typing import List, Dict, Optional
from pydantic import BaseModel


class AssessmentItem(BaseModel):
    name: str


class CLOPair(BaseModel):
    clo: str
    assessment: Optional[str]
    similarity: float


class CLOAlignmentRequest(BaseModel):
    clos: List[str]
    assessments: List[AssessmentItem]
    threshold: Optional[float] = 0.65


class CLOAlignmentResponse(BaseModel):
    avg_top: float
    flags: List[str]

    # core results
    clos: List[str]
    assessments: List[str]
    alignment: Dict[str, Dict[str, float | bool]]
    pairs: List[CLOPair]

    # 🔍 explainability
    audit: Optional[Dict] = None


class CLOAlignmentAutoResponse(BaseModel):
    clos: List[str]
    assessments: List[str]
    alignment: Dict[str, Dict[str, float]] = {}
