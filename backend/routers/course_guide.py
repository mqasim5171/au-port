from __future__ import annotations

import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.db import get_db
from core.rbac import require_course_access
from models.course import Course
from models.uploads import Upload, UploadText
from services.upload_adapter import parse_document
from services.course_execution import generate_weekly_plan_from_guide

router = APIRouter(prefix="/courses", tags=["Course Guide"])


def _safe_filename(name: str) -> str:
    return name.replace("/", "_").replace("\\", "_")


@router.post(
    "/{course_id}/course-guide",
    status_code=status.HTTP_201_CREATED,
)
async def upload_course_guide(
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    """
    Upload the official course guide, store it on disk, extract text, and
    generate the weekly plan (1..16) used by the Execution Monitor.
    """

    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # ---------- Save file ----------
    storage_dir = Path("storage") / course_id / "course_guide"
    storage_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_name = _safe_filename(file.filename or "course_guide")
    dest = storage_dir / f"{ts}_{safe_name}"

    total_bytes = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_bytes += len(chunk)
            out.write(chunk)

    # ---------- Upload record ----------
    upload = Upload(
        id=str(uuid.uuid4()),
        course_id=course_id,
        uploader_id=str(getattr(current, "id", "")),
        category="course_guide",
        folder_key="course_guide",
        file_name=safe_name,
        file_path=str(dest),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # ---------- Extract text ----------
    parsed = parse_document(str(dest)) or {}
    extracted_text = parsed.get("text")

    plans_created = 0
    if extracted_text:
        db.add(UploadText(upload_id=upload.id, extracted_text=extracted_text))
        db.commit()

        # ✅ Generate weekly plan
        plans = generate_weekly_plan_from_guide(
            db=db,
            course=course,
            guide_text=extracted_text,
            weeks=16
        )
        plans_created = len(plans)

    return {
        "message": "Course guide uploaded",
        "upload_id": upload.id,
        "saved_path": str(dest),
        "bytes": total_bytes,
        "text_extracted": bool(extracted_text),
        "weekly_plans_created": plans_created,
    }
