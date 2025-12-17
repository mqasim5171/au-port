# backend/routers/assessment_router.py

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.db import get_db
from core.rbac import require_course_access

from models.assessment import Assessment
from models.course import Course
from models.course_clo import CourseCLO
from models.student import Student
from models.student_submission import StudentSubmission
from models.uploads import Upload

router = APIRouter(tags=["assessments"])


# ------------------ Helpers ------------------

def _to_uuid(val: str, field_name: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(val)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} (must be UUID)")


def _safe_filename(name: str) -> str:
    return (name or "file").replace("/", "_").replace("\\", "_")


# ------------------ Schemas ------------------

class AssessmentCreate(BaseModel):
    title: str
    type: str = Field(..., description="quiz | assignment | mid | final")
    total_marks: int
    weightage: int
    date_conducted: date
    clo_ids: Optional[List[str]] = None


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    total_marks: Optional[int] = None
    weightage: Optional[int] = None
    date_conducted: Optional[date] = None
    clo_ids: Optional[List[str]] = None


class AssessmentOut(BaseModel):
    id: str
    course_id: str
    title: str
    type: str
    total_marks: int
    weightage: int
    date_conducted: date
    created_at: Optional[datetime] = None
    clo_ids: List[str] = []

    class Config:
        from_attributes = True


def _assessment_to_out(a: Assessment) -> AssessmentOut:
    return AssessmentOut(
        id=str(a.id),
        course_id=str(a.course_id),
        title=a.title,
        type=a.type,
        total_marks=a.total_marks,
        weightage=a.weightage,
        date_conducted=a.date_conducted,
        created_at=getattr(a, "created_at", None),
        clo_ids=[str(c.id) for c in (a.clos or [])],
    )


# ------------------ Assessment CRUD ------------------

@router.post(
    "/courses/{course_id}/assessments",
    response_model=AssessmentOut,
    status_code=status.HTTP_201_CREATED
)
def create_assessment(
    course_id: str,
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    cid = _to_uuid(course_id, "course_id")

    course = db.get(Course, course_id) or db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    a = Assessment(
        course_id=cid,  # ✅ UUID stored
        title=payload.title,
        type=payload.type,
        total_marks=payload.total_marks,
        weightage=payload.weightage,
        date_conducted=payload.date_conducted,
    )

    # attach CLOs (optional)
    if payload.clo_ids:
        clo_uuids = []
        for x in payload.clo_ids:
            clo_uuids.append(_to_uuid(x, "clo_id"))
        clos = db.query(CourseCLO).filter(CourseCLO.id.in_(clo_uuids)).all()
        a.clos = clos

    db.add(a)
    db.commit()
    db.refresh(a)
    return _assessment_to_out(a)


@router.get("/courses/{course_id}/assessments", response_model=List[AssessmentOut])
def list_assessments(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    cid = _to_uuid(course_id, "course_id")
    items = db.query(Assessment).filter(Assessment.course_id == cid).order_by(Assessment.created_at.desc()).all()
    return [_assessment_to_out(a) for a in items]


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    aid = _to_uuid(assessment_id, "assessment_id")
    a = db.query(Assessment).filter(Assessment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _assessment_to_out(a)


@router.put("/assessments/{assessment_id}", response_model=AssessmentOut)
def update_assessment(
    assessment_id: str,
    payload: AssessmentUpdate,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    aid = _to_uuid(assessment_id, "assessment_id")
    a = db.query(Assessment).filter(Assessment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    for field in ["title", "type", "total_marks", "weightage", "date_conducted"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(a, field, val)

    if payload.clo_ids is not None:
        clo_uuids = []
        for x in payload.clo_ids:
            clo_uuids.append(_to_uuid(x, "clo_id"))
        clos = db.query(CourseCLO).filter(CourseCLO.id.in_(clo_uuids)).all()
        a.clos = clos

    db.commit()
    db.refresh(a)
    return _assessment_to_out(a)


# ------------------ Bulk Upload Marks (CSV) ------------------

@router.post("/assessments/{assessment_id}/submissions/bulk-upload")
async def bulk_upload_marks(
    assessment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    """
    CSV format supported:
      reg_no, obtained_marks
    OR
      student_id, obtained_marks
    """
    aid = _to_uuid(assessment_id, "assessment_id")
    a = db.query(Assessment).filter(Assessment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    raw = await file.read()
    text = raw.decode("utf-8", errors="ignore")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")

    # normalize headers
    headers = [h.strip().lower() for h in reader.fieldnames]
    has_reg = "reg_no" in headers or "regno" in headers
    has_sid = "student_id" in headers
    has_marks = "obtained_marks" in headers or "marks" in headers

    if not has_marks or (not has_reg and not has_sid):
        raise HTTPException(
            status_code=400,
            detail="CSV must include (reg_no OR student_id) and obtained_marks",
        )

    updated = 0
    created = 0

    for row in reader:
        # get marks
        marks_val = row.get("obtained_marks") or row.get("marks")
        if marks_val is None:
            continue
        try:
            marks = int(float(marks_val))
        except Exception:
            continue

        student_id = None

        # by student_id
        if row.get("student_id"):
            student_id = row.get("student_id").strip()

        # by reg_no -> Student table
        if not student_id:
            reg = row.get("reg_no") or row.get("regno")
            if reg:
                st = db.query(Student).filter(Student.reg_no == reg.strip()).first()
                if st:
                    student_id = st.user_id  # Student.user_id points to users.id in your project

        if not student_id:
            continue

        sub = (
            db.query(StudentSubmission)
            .filter(StudentSubmission.assessment_id == aid, StudentSubmission.student_id == student_id)
            .first()
        )

        if not sub:
            # no file yet -> create a placeholder submission with upload_id empty?
            # better: create record with upload_id as "marks_only"
            sub = StudentSubmission(
                assessment_id=aid,
                student_id=student_id,
                upload_id="marks_only",
                obtained_marks=marks,
            )
            db.add(sub)
            created += 1
        else:
            sub.obtained_marks = marks
            updated += 1

    db.commit()

    return {"message": "Marks processed", "created": created, "updated": updated}


# ------------------ Upload Student Solution File ------------------

@router.post("/assessments/{assessment_id}/submissions/file")
async def upload_solution_file(
    assessment_id: str,
    reg_no: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    """
    Upload student solution/evidence for an assessment.
    Saves file -> uploads table -> student_submissions table.
    """
    aid = _to_uuid(assessment_id, "assessment_id")
    a = db.query(Assessment).filter(Assessment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    student = db.query(Student).filter(Student.reg_no == reg_no.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for given reg_no")

    # storage path
    storage_dir = Path("storage") / "assessments" / str(assessment_id) / "submissions"
    storage_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_name = _safe_filename(file.filename)
    dest = storage_dir / f"{reg_no.strip()}_{ts}_{safe_name}"

    total_bytes = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_bytes += len(chunk)
            out.write(chunk)

    upload = Upload(
        id=str(uuid.uuid4()),
        course_id=str(a.course_id),  # keep as string in uploads table if your Upload.course_id is String
        uploader_id=str(getattr(current, "id", "")),
        category="student_solution",
        folder_key=f"assessments/{assessment_id}/submissions",
        file_name=safe_name,
        file_path=str(dest),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    sub = (
        db.query(StudentSubmission)
        .filter(StudentSubmission.assessment_id == aid, StudentSubmission.student_id == student.user_id)
        .first()
    )

    if not sub:
        sub = StudentSubmission(
            assessment_id=aid,
            student_id=student.user_id,
            upload_id=upload.id,
            obtained_marks=None,
        )
        db.add(sub)
    else:
        sub.upload_id = upload.id  # overwrite with latest file
        sub.submitted_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "message": "Submission uploaded",
        "upload_id": upload.id,
        "bytes": total_bytes,
        "saved_path": str(dest),
    }


# ---- Legacy compatibility routes (keep frontend working if it still calls /api) ----

@router.get("/api/courses/{course_id}/assessments", response_model=List[AssessmentOut])
def list_assessments_legacy(course_id: str, db: Session = Depends(get_db), current=Depends(require_course_access)):
    return list_assessments(course_id=course_id, db=db, current=current)

@router.post("/api/courses/{course_id}/assessments", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
def create_assessment_legacy(course_id: str, payload: AssessmentCreate, db: Session = Depends(get_db), current=Depends(require_course_access)):
    return create_assessment(course_id=course_id, payload=payload, db=db, current=current)

@router.get("/api/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment_legacy(assessment_id: str, db: Session = Depends(get_db), current=Depends(require_course_access)):
    return get_assessment(assessment_id=assessment_id, db=db, current=current)

@router.put("/api/assessments/{assessment_id}", response_model=AssessmentOut)
def update_assessment_legacy(assessment_id: str, payload: AssessmentUpdate, db: Session = Depends(get_db), current=Depends(require_course_access)):
    return update_assessment(assessment_id=assessment_id, payload=payload, db=db, current=current)

@router.post("/api/assessments/{assessment_id}/submissions/bulk-upload")
async def bulk_upload_marks_legacy(assessment_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), current=Depends(require_course_access)):
    return await bulk_upload_marks(assessment_id=assessment_id, file=file, db=db, current=current)

@router.post("/api/assessments/{assessment_id}/submissions/file")
async def upload_solution_file_legacy(
    assessment_id: str,
    reg_no: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    return await upload_solution_file(assessment_id=assessment_id, reg_no=reg_no, file=file, db=db, current=current)
