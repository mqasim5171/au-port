from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from core.db import get_db
from routers.auth import get_current_user   # this exists in your repo

from models.assessment import Assessment
from models.student import Student
from models.student_submission import StudentSubmission
from models.grading_audit import GradingAudit

router = APIRouter(prefix="/api", tags=["Assessments"])


router = APIRouter(prefix="/api", tags=["assessments"])

# ---------- Assessment Management ----------

@router.post("/courses/{course_id}/assessments")
def create_assessment(course_id: str, payload: dict, db: Session = Depends(get_db)):
    # payload: {title, type, total_marks, weightage, date_conducted, clo_ids: []}
    a = Assessment(
        course_id=course_id,
        title=payload["title"],
        type=payload["type"],
        total_marks=payload["total_marks"],
        weightage=payload["weightage"],
        date_conducted=payload["date_conducted"],
    )
    # attach CLOs
    if "clo_ids" in payload:
        clos = db.query(CLO).filter(CLO.id.in_(payload["clo_ids"])).all()
        a.clos = clos

    db.add(a)
    db.commit()
    db.refresh(a)
    return a

@router.get("/courses/{course_id}/assessments")
def list_assessments(course_id: str, db: Session = Depends(get_db)):
    return db.query(Assessment).filter_by(course_id=course_id).all()

@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: str, db: Session = Depends(get_db)):
    a = db.query(Assessment).get(assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a

@router.put("/assessments/{assessment_id}")
def update_assessment(assessment_id: str, payload: dict, db: Session = Depends(get_db)):
    a = db.query(Assessment).get(assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    for field in ["title", "type", "total_marks", "weightage", "date_conducted"]:
        if field in payload:
            setattr(a, field, payload[field])

    if "clo_ids" in payload:
        clos = db.query(CLO).filter(CLO.id.in_(payload["clo_ids"])).all()
        a.clos = clos

    db.commit()
    db.refresh(a)
    return a
@router.post("/assessments/{assessment_id}/submissions/bulk-upload")
async def bulk_upload_marks(
    assessment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ...
@router.post("/assessments/{assessment_id}/submissions/file")
async def upload_solution_file(
    assessment_id: str,
    reg_no: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ...
