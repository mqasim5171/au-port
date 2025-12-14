# backend/routers/courses.py
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
    Form,
)
from sqlalchemy.orm import Session
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone
from typing import List, Optional
import os

from core.db import SessionLocal
from .auth import get_current_user

from models.course import Course
from models.file_upload import FileUpload
from models.material import CourseMaterial, CourseMaterialFile
from models.course_assignment import CourseAssignment

from schemas.course import CourseCreate, CourseOut
from schemas.course_assignment import AssignUserToCourseIn

from core.rbac import norm_role, require_course_access, require_roles

router = APIRouter(prefix="/courses", tags=["Courses"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def _save_course_upload(course_id: str, file: UploadFile, db: Session, current):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    base_dir = Path("storage") / "course_uploads" / course_id
    base_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = base_dir / f"{ts}_{file.filename}"

    total_bytes = 0
    with dest.open("wb") as f_out:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            f_out.write(chunk)

    rec = FileUpload(
        id=str(uuid4()),
        course_id=course_id,
        user_id=current.id,
        filename=file.filename,
        file_type=file.content_type,
        file_size=total_bytes,
        upload_date=datetime.now(timezone.utc),
        validation_status="pending",
        validation_details="Not validated yet",
    )

    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "id": rec.id,
        "filename": rec.filename,
        "upload_date": rec.upload_date,
        "validation_status": rec.validation_status,
    }


@router.get("", response_model=list[CourseOut])
@router.get("/", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),  # ✅ callable
):
    return (
        db.query(Course)
        .order_by(Course.created_at.desc())
        .limit(200)
        .all()
    )


@router.get("/my", response_model=list[CourseOut])
def list_my_courses(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),  # ✅ callable
):
    r = norm_role(current.role)

    if r in {"admin", "hod"}:
        return (
            db.query(Course)
            .order_by(Course.created_at.desc())
            .limit(200)
            .all()
        )

    course_ids = [
        x.course_id
        for x in db.query(CourseAssignment)
        .filter(CourseAssignment.user_id == current.id)
        .all()
    ]

    if not course_ids:
        return []

    return (
        db.query(Course)
        .filter(Course.id.in_(course_ids))
        .order_by(Course.created_at.desc())
        .all()
    )


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current=Depends(require_roles("admin", "hod")),  # ✅ callable dep factory output
):
    c = Course(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),  # ✅ callable
):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


@router.get("/{course_id}/uploads")
def list_course_uploads(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),  # ✅ callable
):
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    uploads = (
        db.query(FileUpload)
        .filter(FileUpload.course_id == course_id)
        .order_by(FileUpload.upload_date.desc())
        .all()
    )
    return [
        {
            "id": u.id,
            "filename": u.filename,
            "upload_date": u.upload_date,
            "validation_status": u.validation_status,
        }
        for u in uploads
    ]


@router.post("/{course_id}/upload")
async def upload_course_file(
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),  # ✅ callable
):
    return await _save_course_upload(course_id, file, db, current)


MATERIAL_STORAGE_ROOT = Path("storage") / "materials"
MATERIAL_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)


def _infer_folder_type(title: str) -> str:
    t = (title or "").lower().strip()
    if t.startswith("assignment"):
        return "assignments"
    if t.startswith("quiz"):
        return "quizzes"
    if t.startswith("mid"):
        return "midterm"
    if t.startswith("final"):
        return "finalterm"
    return "assignments"


@router.get("/{course_id}/materials")
def list_course_materials(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),  # ✅ callable
):
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    mats: list[CourseMaterial] = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.course_id == course_id)
        .order_by(CourseMaterial.created_at.desc())
        .all()
    )

    mat_ids = [m.id for m in mats]
    files: list[CourseMaterialFile] = []
    if mat_ids:
        files = (
            db.query(CourseMaterialFile)
            .filter(CourseMaterialFile.material_id.in_(mat_ids))
            .all()
        )

    file_map: dict[str, list[CourseMaterialFile]] = {m_id: [] for m_id in mat_ids}
    for f in files:
        file_map.setdefault(f.material_id, []).append(f)

    def file_to_dict(f: CourseMaterialFile) -> dict:
        url_path = f.stored_path.replace(os.sep, "/")
        if not url_path.startswith("storage/"):
            url_path = f"storage/{url_path}"
        return {
            "id": f.id,
            "filename": f.filename,
            "display_name": f.filename,
            "url": f"/{url_path}",
            "size_bytes": f.size_bytes,
            "content_type": f.content_type,
            "uploaded_at": f.uploaded_at,
        }

    out = []
    for m in mats:
        out.append(
            {
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "folder": m.folder_type,
                "folder_type": m.folder_type,
                "created_at": m.created_at,
                "files": [file_to_dict(f) for f in file_map.get(m.id, [])],
            }
        )
    return out


@router.post("/{course_id}/materials", status_code=status.HTTP_201_CREATED)
async def create_course_material(
    course_id: str,
    title: str = Form(...),
    description: str = Form(""),
    folder_hint: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),  # ✅ callable
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    folder_type = folder_hint or _infer_folder_type(title)

    mat = CourseMaterial(
        id=str(uuid4()),
        course_id=course_id,
        title=title,
        description=description,
        folder_type=folder_type,
        created_by=current.id,
    )
    db.add(mat)
    db.flush()

    mat_dir = MATERIAL_STORAGE_ROOT / course_id / mat.id
    mat_dir.mkdir(parents=True, exist_ok=True)

    for f in files:
        dest = mat_dir / f.filename
        total_bytes = 0
        with dest.open("wb") as out:
            while chunk := await f.read(1024 * 1024):
                total_bytes += len(chunk)
                out.write(chunk)

        rel_path = os.path.relpath(dest, ".")
        mf = CourseMaterialFile(
            material_id=mat.id,
            filename=f.filename,
            stored_path=rel_path,
            content_type=f.content_type or "application/octet-stream",
            size_bytes=total_bytes,
        )
        db.add(mf)

    db.commit()
    db.refresh(mat)

    return {"id": mat.id, "message": "Material created"}


@router.post("/{course_id}/assign")
def assign_user_to_course(
    course_id: str,
    payload: AssignUserToCourseIn,
    db: Session = Depends(get_db),
    current=Depends(require_roles("admin", "hod")),
):
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    row = CourseAssignment(
        user_id=payload.user_id,
        course_id=course_id,
        assignment_role=(payload.assignment_role or "TEACHER").upper(),
    )
    db.add(row)
    db.commit()
    return {"message": "Assigned", "course_id": course_id, "user_id": payload.user_id}