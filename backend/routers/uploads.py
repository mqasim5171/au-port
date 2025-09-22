from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, timezone
import os, zipfile

from core.db import SessionLocal
from .auth import get_current_user
from models.course import Course
from models.uploads import Upload, UploadText
from schemas.upload import UploadItem, UploadResponse
from services.upload_adapter import parse_document

router = APIRouter(prefix="/upload", tags=["Uploads"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

STORAGE_DIR = Path("storage") / "uploads"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

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
    # Remove NULs and other control chars that break Postgres TEXT
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
    status = "complete" if pct >= 80 else ("incomplete" if found else "invalid")
    details = {
        "completeness_percentage": pct,
        "missing_items": missing,
        "found": [k for k, v in present.items() if v],
    }
    return status, details

def _parse_file_to_text(path: Path) -> tuple[str | None, int | None]:
    """Use adapter for one file; return (text, pages)."""
    out = parse_document(str(path)) or {}
    text = _sanitize_text(out.get("text"))
    pages = out.get("pages")
    try:
        pages = int(pages) if pages is not None else None
    except Exception:
        pages = None
    return text, pages

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

    course_dir = STORAGE_DIR / course_id
    course_dir.mkdir(parents=True, exist_ok=True)

    items: list[dict] = []
    log: list[dict] = []

    for f in files:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        stored_name = f"{ts}_{f.filename}"
        dest = course_dir / stored_name

        # stream to disk
        total_bytes = 0
        with dest.open("wb") as out:
            while chunk := await f.read(1024 * 1024):
                total_bytes += len(chunk)
                out.write(chunk)

        ext = _ext_of(f.filename)

        texts: list[str] = []
        pages_total = 0

        if ext == "zip":
            try:
                with zipfile.ZipFile(dest, "r") as zf:
                    for zi in zf.infolist():
                        name = zi.filename
                        low = name.lower()
                        if zi.is_dir():
                            continue
                        if not low.endswith((".pdf", ".docx", ".doc", ".txt")):
                            continue
                        member_path = course_dir / f"{ts}_{Path(name).name}"
                        with zf.open(zi) as zobj, member_path.open("wb") as mf:
                            mf.write(zobj.read())
                        t, p = _parse_file_to_text(member_path)
                        if t:
                            texts.append(t)
                        if p:
                            pages_total += p
            except Exception as e:
                log.append({"file": f.filename, "zip_error": str(e)})
        else:
            t, p = _parse_file_to_text(dest)
            if t:
                texts.append(t)
            if p:
                pages_total = p

        status_str, details = _compute_validation(texts)

        # DB rows
        up = Upload(
            course_id=course_id,
            filename_original=f.filename,
            filename_stored=stored_name,
            ext=ext,
            file_type_guess=None,
            week_no=None,
            bytes=total_bytes,
            created_at=datetime.utcnow(),
            parse_log=[],
        )
        db.add(up)
        db.flush()

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
            ).model_dump() | {
                "upload_date": up.created_at,
                "validation_status": status_str,
                "validation_details": details,
            }
        )
        log.append({"file": f.filename, "stored": True, "bytes": total_bytes})

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
    text_map = {
        t.upload_id: t
        for t in db.query(UploadText).filter(UploadText.upload_id.in_([r.id for r in rows])).all()
    }

    out = []
    for r in rows:
        txt = text_map.get(r.id)
        texts = [txt.text] if (txt and txt.text) else []
        status_str, details = _compute_validation(texts)
        out.append({
            "id": str(r.id),
            "filename": r.filename_original,
            "upload_date": r.created_at,
            "validation_status": status_str,
            "validation_details": details,
            "ext": r.ext,
            "bytes": r.bytes,
        })
    return out
