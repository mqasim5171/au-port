# backend/routers/assessments.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid

from core.db import SessionLocal
from routers.auth import get_current_user
from models.course import Course
from models.assessment import Assessment
from models.student_submission import StudentSubmission

from schemas.assessment import (
    AssessmentCreate, AssessmentOut, AssessmentDetailOut, SubmissionOut
)

from services.assessment_service import (
    create_assessment,
    save_questions_file_and_extract_text,
    ai_generate_expected_answers,
    ai_clo_alignment,
)
from services.grading_service import upload_submissions_zip, grade_all


router = APIRouter(tags=["Assessments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _uid(current) -> str:
    return (current.get("id") if isinstance(current, dict) else str(getattr(current, "id", ""))) or ""


@router.post("/courses/{course_id}/assessments", response_model=AssessmentOut)
def create_assessment_api(
    course_id: str,
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    # ✅ validate UUID format BUT store/use as string (because DB is varchar(36))
    try:
        uuid.UUID(course_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid course_id (must be UUID format)")

    # ✅ courses.id in DB is varchar => db.get expects string
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    a = create_assessment(
        db,
        course_id=course_id,                 # ✅ string
        payload=payload.model_dump(),
        created_by=_uid(current),            # ✅ string
    )
    return a


@router.get("/courses/{course_id}/assessments", response_model=List[AssessmentOut])
def list_assessments(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        uuid.UUID(course_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid course_id (must be UUID format)")

    return (
        db.query(Assessment)
        .filter(Assessment.course_id == course_id)  # ✅ string compare
        .order_by(Assessment.created_at.desc())
        .all()
    )


@router.get("/assessments/{assessment_id}", response_model=AssessmentDetailOut)
def get_assessment_detail(
    assessment_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {
        "assessment": a,
        "files": list(a.files or []),
        "expected": a.expected,
        "clo_alignment": a.clo_alignment,
    }


@router.post("/assessments/{assessment_id}/questions/upload")
async def upload_questions_file(
    assessment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    b = await file.read()
    if not b:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        af = save_questions_file_and_extract_text(
            db=db,
            assessment_id=a.id,
            course_id=a.course_id,  # ✅ string in DB
            file_bytes=b,
            filename=file.filename or "questions.pdf",
        )
        return {
            "ok": True,
            "assessment_file_id": str(af.id),
            "extracted_len": len(af.extracted_text or ""),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assessments/{assessment_id}/generate-expected-answers")
def generate_expected_answers(
    assessment_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    try:
        exp = ai_generate_expected_answers(db, a)
        clo = ai_clo_alignment(db, a)
        return {
            "ok": True,
            "expected_answers_created": True,
            "model": exp.model,
            "prompt_version": exp.prompt_version,
            "clo_coverage_percent": clo.coverage_percent,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assessments/{assessment_id}/submissions/upload-zip")
async def upload_submissions(
    assessment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    b = await file.read()
    if not b:
        raise HTTPException(status_code=400, detail="Empty ZIP")

    try:
        out = upload_submissions_zip(db, a, b, file.filename or "submissions.zip")
        return {"ok": True, **out}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assessments/{assessment_id}/grade-all")
def grade_all_api(
    assessment_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    try:
        out = grade_all(db, a, created_by=_uid(current))
        return {"ok": True, **out}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assessments/{assessment_id}/submissions", response_model=List[SubmissionOut])
def list_submissions(
    assessment_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        aid = uuid.UUID(assessment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid assessment_id")

    return (
        db.query(StudentSubmission)
        .filter(StudentSubmission.assessment_id == aid)
        .order_by(StudentSubmission.created_at.desc())
        .all()
    )
