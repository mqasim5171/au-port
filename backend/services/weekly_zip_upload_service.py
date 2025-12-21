import json
import re
import zipfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.course import Course
from models.uploads import Upload, UploadText
from models.course_execution import WeeklyPlan, WeeklyExecution, DeviationLog
from services.upload_adapter import parse_document
from services.execution_compare import compare_week

ALLOWED_EXTS = {".pdf", ".docx", ".pptx", ".txt", ".md"}
MAX_FILES = 200
MAX_TEXT_CHARS = 80_000  # keep enough signal

PLACEHOLDER_HINTS = {
    "update later",
    "topics (auto)",
    "week topics",
}

def clean_text(val: Optional[str]) -> str:
    if val is None:
        return ""
    if not isinstance(val, str):
        val = str(val)

    val = val.replace("\x00", "")  # remove NULs

    out = []
    for ch in val:
        o = ord(ch)
        if ch in ("\n", "\r", "\t"):
            out.append(ch)
        elif o >= 32:
            out.append(ch)
    return "".join(out).strip()

def _strip_placeholders(text: str) -> str:
    t = clean_text(text).lower()
    for h in PLACEHOLDER_HINTS:
        t = t.replace(h, " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _safe_extract_zip(zip_path: str, dest_dir: str) -> list[str]:
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)

    extracted_files: list[str] = []
    with zipfile.ZipFile(zip_path, "r") as z:
        names = z.namelist()
        if len(names) > MAX_FILES:
            names = names[:MAX_FILES]

        for member in names:
            if member.endswith("/"):
                continue

            target = (dest / member).resolve()
            if not str(target).startswith(str(dest.resolve())):
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(member) as src, open(target, "wb") as out:
                out.write(src.read())

            extracted_files.append(str(target))

    return extracted_files

def _extract_week_section(text: str, week_no: int) -> str:
    """
    Extracts lines like:
      1 Chapter 1: ...
      • ...
    until next week line.
    """
    t = clean_text(text)
    if not t:
        return ""

    if week_no < 16:
        pattern = rf"(?ms)^\s*{week_no}\s+(.*?)(?=^\s*{week_no+1}\s+)"
    else:
        pattern = rf"(?ms)^\s*{week_no}\s+(.*)$"

    m = re.search(pattern, t)
    return m.group(1).strip() if m else ""

def _compact_text_for_matching(text: str, max_chars: int = MAX_TEXT_CHARS) -> str:
    text = clean_text(text)
    if len(text) <= max_chars:
        return text
    half = max_chars // 2
    return (text[:half] + "\n\n---SNIP---\n\n" + text[-half:]).strip()

def _resolve_course(db: Session, course_id_or_code: str) -> Course | None:
    return (
        db.query(Course)
        .filter(or_(Course.id == course_id_or_code, Course.course_code == course_id_or_code))
        .first()
    )

def handle_weekly_zip_upload(
    db: Session,
    course_id: str,
    week_no: int,
    user_id: str,
    zip_file_bytes: bytes,
    zip_filename: str,
    storage_root: str = "uploads/weekly",
):
    now = datetime.now(timezone.utc)

    # ✅ accept UUID or course_code
    course = _resolve_course(db, course_id)
    if not course:
        raise ValueError(f"Course not found for '{course_id}'. Use UUID or valid course_code.")

    real_course_id = str(course.id)

    upload_id = str(int(now.timestamp() * 1000))
    base_dir = Path(storage_root) / real_course_id / f"week_{week_no}" / upload_id
    base_dir.mkdir(parents=True, exist_ok=True)

    zip_path = base_dir / (zip_filename or f"week_{week_no}.zip")
    zip_path.write_bytes(zip_file_bytes)

    extracted_dir = base_dir / "extracted"
    files = _safe_extract_zip(str(zip_path), str(extracted_dir))

    texts: List[str] = []
    manifest = []

    for fp in files:
        ext = Path(fp).suffix.lower()
        if ext not in ALLOWED_EXTS:
            continue

        try:
            parsed = parse_document(fp) or {}
            raw_text = parsed.get("text") or ""
            t = clean_text(raw_text)
            err = parsed.get("error")
        except Exception as e:
            t = ""
            err = f"parse failed: {e}"

        if t:
            texts.append(t)

        manifest.append({"path": fp, "ext": ext, "chars": len(t), "error": err})

    delivered_full = "\n\n".join(texts)
    delivered_text = _compact_text_for_matching(delivered_full)

    if not delivered_text.strip():
        raise ValueError(
            "No text extracted from ZIP. Your PDFs might be scanned images (need OCR) or parser failed. "
            f"Errors: {[m for m in manifest if m.get('error')][:5]}"
        )

    # ✅ Fetch weekly plan
    plan = (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.course_id == real_course_id, WeeklyPlan.week_number == week_no)
        .first()
    )

    plan_source = "weekly_plans.planned_topics"
    plan_text_raw = clean_text(plan.planned_topics if plan else "")

    # ✅ IMPORTANT: extract the week section so we don’t compare the whole guide header
    week_section = _extract_week_section(plan_text_raw, week_no)
    if week_section:
        plan_text = week_section
        plan_source = "weekly_plans.planned_topics (week section extracted)"
    else:
        plan_text = _strip_placeholders(plan_text_raw)

    # fallback: try course.course_guide_text
    if not plan_text.strip():
        guide_text = clean_text(getattr(course, "course_guide_text", "") or "")
        week_section2 = _extract_week_section(guide_text, week_no)
        if week_section2:
            plan_text = week_section2
            plan_source = "courses.course_guide_text (week section extracted)"
        else:
            plan_text = _strip_placeholders(guide_text)
            plan_source = "courses.course_guide_text"

    if not plan_text.strip():
        raise ValueError(
            f"No weekly plan text found for course={course.course_code} ({real_course_id}), week={week_no}. "
            "Generate weekly plan first or store course_guide_text."
        )

    coverage_score, missing_terms, plan_terms = compare_week(plan_text, delivered_text)
    coverage_score = float(coverage_score)
    coverage_percent = coverage_score * 100.0

    missing_terms = missing_terms or []
    plan_terms = plan_terms or []
    matched_terms = [t for t in plan_terms if t not in set(missing_terms)]

    coverage_status = "on_track" if coverage_percent >= 80.0 else "behind"

    # ✅ Save Upload (matches your model exactly)
    up = Upload(
        course_id=real_course_id,
        filename_original=zip_filename or f"week_{week_no}.zip",
        filename_stored=str(zip_path.name),
        ext="zip",
        file_type_guess="weekly_zip",
        week_no=week_no,
        bytes=len(zip_file_bytes),
        parse_log=manifest,
        created_at=now.replace(tzinfo=None),
    )
    db.add(up)
    db.flush()

    txt = UploadText(
        upload_id=up.id,
        text=delivered_text,
        text_chars=len(delivered_text),
        needs_ocr=False,
        parse_warnings=manifest,
    )
    db.add(txt)

    # Upsert WeeklyExecution
    ex = (
        db.query(WeeklyExecution)
        .filter(WeeklyExecution.course_id == real_course_id, WeeklyExecution.week_number == week_no)
        .first()
    )
    if not ex:
        ex = WeeklyExecution(course_id=real_course_id, week_number=week_no)
        db.add(ex)

    ex.coverage_percent = coverage_percent
    ex.coverage_status = coverage_status
    ex.delivered_topics = delivered_text
    ex.missing_topics = clean_text("\n".join(missing_terms))[:20000]
    ex.matched_topics = clean_text("\n".join(matched_terms))[:20000]
    ex.last_updated_at = now

    if coverage_percent < 80.0:
        dev = DeviationLog(
            course_id=real_course_id,
            week_number=week_no,
            type="coverage_low",
            details=clean_text(json.dumps({
                "coverage_percent": coverage_percent,
                "missing_terms": missing_terms[:200],
                "note": "Weekly upload coverage below threshold.",
            }, ensure_ascii=False)),
        )
        db.add(dev)

    db.commit()
    db.refresh(ex)

    return {
        "course_id": real_course_id,
        "course_code": course.course_code,
        "week_no": week_no,
        "coverage_score": coverage_score,
        "coverage_percent": coverage_percent,
        "coverage_status": coverage_status,
        "missing_terms": missing_terms[:200],
        "matched_terms": matched_terms[:200],
        "upload_id": str(up.id),
        "files_seen": len(files),
        "files_used": len([m for m in manifest if m["ext"] in ALLOWED_EXTS]),
        # debug (so you can SEE why it’s low)
        "plan_source": plan_source,
        "plan_text_len": len(plan_text),
        "delivered_text_len": len(delivered_text),
        "manifest_errors": [m for m in manifest if m.get("error")][:5],
    }
