from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from datetime import datetime, date
from uuid import UUID


class AssessmentCreate(BaseModel):
    type: str
    title: str

    # Make marks required (or keep default if you really want)
    max_marks: int = Field(..., ge=0)

    # ✅ REQUIRED because DB column is NOT NULL
    weightage: int = Field(..., ge=0)

    # ✅ REQUIRED because DB column is NOT NULL
    # Send as "2025-12-21"
    date: date


class AssessmentOut(BaseModel):
    id: UUID
    course_id: str
    type: str
    title: str
    max_marks: int
    weightage: int
    date: date

    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True



class AssessmentFileOut(BaseModel):
    id: UUID
    assessment_id: UUID
    upload_id: Optional[UUID] = None
    filename_original: str
    filename_stored: str
    ext: str
    created_at: datetime
    extracted_text: Optional[str] = None

    class Config:
        from_attributes = True


class ExpectedAnswersOut(BaseModel):
    prompt_version: str = "v1"
    model: Optional[str] = None
    input_hash: Optional[str] = None
    parsed_json: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CLOAlignmentOut(BaseModel):
    coverage_percent: float = 0.0
    per_clo: Optional[Dict[str, float]] = None
    per_question: Optional[List[Dict[str, Any]]] = None
    model: Optional[str] = None
    prompt_version: str = "v1"
    created_at: datetime

    class Config:
        from_attributes = True


class AssessmentDetailOut(BaseModel):
    assessment: AssessmentOut
    files: List[AssessmentFileOut] = []
    expected: Optional[ExpectedAnswersOut] = None
    clo_alignment: Optional[CLOAlignmentOut] = None


class SubmissionOut(BaseModel):
    id: UUID
    assessment_id: UUID
    student_id: Optional[UUID] = None
    upload_id: Optional[UUID] = None
    status: str
    ai_marks: Optional[float] = None
    ai_feedback: Optional[str] = None
    evidence_json: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True
