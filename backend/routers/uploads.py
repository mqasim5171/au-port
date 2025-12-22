from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, timezone
import os, zipfile, tempfile
from typing import Optional, Tuple

from core.db import SessionLocal
from .auth import get_current_user
from models.course import Course
from models.uploads import Upload, UploadText, UploadFileItem
from schemas.upload import UploadItem, UploadResponse
from services.upload_adapter import parse_document
from services.storage import save_bytes


router = APIRouter(prefix="/upload", tags=["Uploads"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ext_of(filename: str) -> str:
    return os.path.splitext(filename)[1].lower().lstrip(".") or "bin"


# --- validation spec (simple heuristic you can tune)
REQUIRED_SECTIONS = [
    ("course objectives", "course_objectives"),
    ("clo", "clos"),
    ("lecture", "lecture_notes"),
    ("quiz", "quizzes"),
    ("assignment", "assignments"),
    ("midterm", "midterm"),
    ("final exam", "final_exam"),
    ("attendance", "attendance"),
    ("grading", "grading_rubric"),
]


def _sanitize_text(s: str | None) -> str | None:
    if s is None:
        return None
    return s.replace("\x00", "")


def _compute_validation(texts: list[str]) -> tuple[str, dict]:
    big = "\n".join(t or "" for t in texts)[:2_000_000].lower()
    present = {key: False for _, key in REQUIRED_SECTIONS}
    for needle, key in REQUIRED_SECTIONS:
        present[key] = (needle in big)

    total = len(present)
    found = sum(1 for v in present.values() if v)
    pct = round(found / total * 100) if total else 0
    missing = [k for k, v in present.items() if not v]
    status_str = "complete" if pct >= 80 else ("incomplete" if found else "invalid")

    return status_str, {
        "completeness_percentage": pct,
        "missing_items": missing,
        "found": [k for k, v in present.items() if v],
    }


def _parse_path_to_text(path: Path) -> Tuple[Optional[str], Optional[int]]:
    out = parse_document(str(path)) or {}
    text = _sanitize_text(out.get("text"))
    pages = out.get("pages")
    try:
        pages = int(pages) if pages is not None else None
    except Exception:
        pages = None
    return text, pages


def _parse_bytes_temp(filename: str, data: bytes) -> Tuple[Optional[str], Optional[int]]:
    suffix = Path(filename).suffix.lower() or ".bin"
    with tempfile.NamedTemporaryFile(delete=True, suffix=suffix) as tf:
        tf.write(data)
        tf.flush()
        return _parse_path_to_text(Path(tf.name))


@router.post("/{course_id}", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_course_folder(
    course_id: str,
    files: list[UploadFile] = File(...),  # field name MUST be 'files'
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    # Ensure course exists
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    items: list[dict] = []
    log: list[dict] = []

    for f in files:
        raw_bytes = await f.read()
        if not raw_bytes:
            log.append({"file": f.filename, "stored": False, "error": "empty file"})
            continue

        ext = _ext_of(f.filename)

        # Save the top-level file (local by default; can be switched to gdrive)
        saved = save_bytes(namespace=f"uploads/{course_id}", filename=f.filename, data=raw_bytes)

        now = datetime.utcnow()
        up = Upload(
            course_id=course_id,
            filename_original=f.filename,
            filename_stored=saved["key"],
            ext=ext,
            file_type_guess="course_folder",
            week_no=None,
            bytes=len(raw_bytes),
            created_at=now,
            parse_log=[],
            storage_backend=saved["backend"],
            storage_key=saved["key"],
            storage_url=saved.get("url"),
        )
        db.add(up)
        db.flush()

        texts: list[str] = []
        pages_total = 0

        def add_file_item(name: str, ext_: str, b: int, pages: Optional[int], text_chars: Optional[int]):
            db.add(
                UploadFileItem(
                    upload_id=up.id,
                    filename=name,
                    ext=ext_,
                    bytes=b,
                    pages=pages,
                    text_chars=text_chars,
                )
            )

        if ext == "zip":
            # Expand in memory; parse each supported member
            try:
                with tempfile.NamedTemporaryFile(delete=True, suffix=".zip") as ztf:
                    ztf.write(raw_bytes)
                    ztf.flush()
                    with zipfile.ZipFile(ztf.name, "r") as zf:
                        for zi in zf.infolist():
                            if zi.is_dir():
                                continue
                            name = zi.filename
                            low = name.lower()
                            if not low.endswith((".pdf", ".docx", ".doc", ".txt")):
                                continue

                            member_bytes = zf.read(zi)
                            mem_ext = _ext_of(name)
                            t, p = _parse_bytes_temp(name, member_bytes)
                            if t:
                                texts.append(t)
                            if p:
                                pages_total += p

                            add_file_item(
                                name=Path(name).name,
                                ext_=mem_ext,
                                b=len(member_bytes),
                                pages=p,
                                text_chars=(len(t) if t else None),
                            )
            except Exception as e:
                up.parse_log = [{"zip_error": str(e)}]
        else:
            t, p = _parse_bytes_temp(f.filename, raw_bytes)
            if t:
                texts.append(t)
            if p:
                pages_total = p

            add_file_item(
                name=f.filename,
                ext_=ext,
                b=len(raw_bytes),
                pages=p,
                text_chars=(len(t) if t else None),
            )

        status_str, details = _compute_validation(texts)

        joined = _sanitize_text("\n\n".join(texts) if texts else None)
        ut = UploadText(
            upload_id=up.id,
            text=joined,
            text_chars=(len(joined) if joined else None),
            text_density=None,
            needs_ocr=False,
            parse_warnings=[{"note": "zip-expanded"}] if ext == "zip" else [],
        )
        db.add(ut)
        db.commit()
        db.refresh(up)

        items.append(
            UploadItem(
                id=str(up.id),
                filename_original=up.filename_original,
                filename_stored=up.filename_stored,
                ext=up.ext,
                file_type_guess=up.file_type_guess,
                week_no=up.week_no,
                bytes=up.bytes,
                pages=pages_total or None,
                version=1,
            ).model_dump()
            | {
                "upload_date": up.created_at,
                "validation_status": status_str,
                "validation_details": details,
                "storage_backend": up.storage_backend,
                "storage_url": up.storage_url,
            }
        )

        log.append({"file": f.filename, "stored": True, "bytes": len(raw_bytes), "backend": saved["backend"]})

    return {"files": items, "log": log}


@router.get("/{course_id}/list")
def list_uploads(course_id: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if not db.get(Course, course_id):
        raise HTTPException(status_code=404, detail="Course not found")

    rows = (
        db.query(Upload)
        .filter(Upload.course_id == course_id)
        .order_by(Upload.created_at.desc())
        .all()
    )
    if not rows:
        return []

    text_map = {
        t.upload_id: t
        for t in db.query(UploadText).filter(UploadText.upload_id.in_([r.id for r in rows])).all()
    }

    out = []
    for r in rows:
        txt = text_map.get(r.id)
        texts = [txt.text] if (txt and txt.text) else []
        status_str, details = _compute_validation(texts)
        out.append(
            {
                "id": str(r.id),
                "filename": r.filename_original,
                "upload_date": r.created_at,
                "validation_status": status_str,
                "validation_details": details,
                "ext": r.ext,
                "bytes": r.bytes,
                "storage_backend": getattr(r, "storage_backend", "local"),
                "storage_url": getattr(r, "storage_url", None),
            }
        )
    return out
