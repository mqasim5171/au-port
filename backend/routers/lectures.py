from __future__ import annotations

import json
import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from core.db import get_db
from core.rbac import require_course_access
from models.course import Course
from models.uploads import Upload, UploadText
from models.course_execution import WeeklyExecution
from services.upload_adapter import parse_document
from services.course_execution import update_deviations_for_course

router = APIRouter(prefix="/courses", tags=["Lectures"])


def _safe_filename(name: str) -> str:
    return name.replace("/", "_").replace("\\", "_")


def _append_evidence(existing_json: str | None, upload_id: str) -> str:
    try:
        arr = json.loads(existing_json) if existing_json else []
        if not isinstance(arr, list):
            arr = []
    except Exception:
        arr = []
    if upload_id not in arr:
        arr.append(upload_id)
    return json.dumps(arr)


@router.post(
    "/{course_id}/lectures",
    status_code=status.HTTP_201_CREATED,
)
async def upload_weekly_lecture(
    course_id: str,
    week: int = Query(..., ge=1, le=16),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    """
    Upload a weekly lecture file:
    - Save file
    - Create Upload + UploadText
    - Upsert WeeklyExecution
    - Recompute deviations
    """

    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # ---------- Save file ----------
    storage_dir = Path("storage") / course_id / "lectures" / f"week-{week:02d}"
    storage_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_name = _safe_filename(file.filename or f"week_{week}")
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
        category="lecture",
        folder_key=f"lectures/week-{week:02d}",
        file_name=safe_name,
        file_path=str(dest),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # ---------- Extract text ----------
    parsed = parse_document(str(dest)) or {}
    extracted_text = parsed.get("text")
    if extracted_text:
        db.add(UploadText(upload_id=upload.id, extracted_text=extracted_text))
        db.commit()

    # ---------- Upsert WeeklyExecution ----------
    exe = (
        db.query(WeeklyExecution)
        .filter(WeeklyExecution.course_id == course_id, WeeklyExecution.week_number == week)
        .first()
    )

    if not exe:
        exe = WeeklyExecution(
            course_id=course_id,
            week_number=week,
            delivered_topics=(extracted_text or None),
            delivered_assessments=None,
            coverage_status="on_track",
            evidence_links=json.dumps([upload.id]),
            last_updated_at=datetime.now(timezone.utc),
        )
        db.add(exe)
    else:
        exe.evidence_links = _append_evidence(exe.evidence_links, upload.id)
        exe.last_updated_at = datetime.now(timezone.utc)
        if extracted_text and not (exe.delivered_topics or "").strip():
            exe.delivered_topics = extracted_text

    db.commit()

    # ✅ deviations
    update_deviations_for_course(db=db, course_id=course_id, weeks=16)

    return {
        "message": f"Lecture uploaded for week {week}",
        "upload_id": upload.id,
        "saved_path": str(dest),
        "bytes": total_bytes,
        "text_extracted": bool(extracted_text),
        "weekly_execution_id": exe.id,
    }
