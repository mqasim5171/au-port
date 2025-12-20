# backend/services/grading_service.py
import json
import zipfile
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from models.uploads import Upload, UploadText
from models.assessment import Assessment, GradingRun, AssessmentExpectedAnswers
from models.student import Student
from models.student_submission import StudentSubmission

from services.upload_adapter import parse_document
from services.openrouter_client import call_openrouter_json


ALLOWED_SUB_EXTS = {".pdf", ".docx", ".txt", ".md"}
MAX_FILES = 200
MAX_TEXT = 80_000


def utcnow():
    return datetime.now(timezone.utc)


def clean_text(val: Optional[str]) -> str:
    if not val:
        return ""
    if not isinstance(val, str):
        val = str(val)
    val = val.replace("\x00", "")
    out = []
    for ch in val:
        o = ord(ch)
        if ch in ("\n", "\r", "\t"):
            out.append(ch)
        elif o >= 32:
            out.append(ch)
    return "".join(out).strip()


def _safe_extract_zip(zip_path: str, dest_dir: str) -> List[str]:
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)

    out: List[str] = []
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
            with z.open(member) as src, open(target, "wb") as f:
                f.write(src.read())
            out.append(str(target))
    return out


def _infer_reg_no(filename: str) -> str:
    base = Path(filename).stem
    m = re.search(r"([0-9]{2}[-_ ]?[A-Za-z]{2,}[-_ ]?[0-9]{2,})", base)
    if m:
        return re.sub(r"[\s_]+", "-", m.group(1)).upper()
    m2 = re.search(r"([0-9]{4,})", base)
    return (m2.group(1) if m2 else base[:40]).upper()


def upload_submissions_zip(
    db: Session,
    assessment: Assessment,
    zip_bytes: bytes,
    zip_filename: str,
    storage_root: str = "uploads/submissions",
) -> Dict[str, Any]:
    now = utcnow()

    base_dir = (
        Path(storage_root)
        / str(assessment.course_id)
        / str(assessment.id)
        / str(int(now.timestamp() * 1000))
    )
    base_dir.mkdir(parents=True, exist_ok=True)

    zip_path = base_dir / (zip_filename or "submissions.zip")
    zip_path.write_bytes(zip_bytes)

    extracted_dir = base_dir / "extracted"
    files = _safe_extract_zip(str(zip_path), str(extracted_dir))

    created = 0
    skipped = 0
    errors: list[str] = []

    for fp in files:
        ext = Path(fp).suffix.lower()
        if ext not in ALLOWED_SUB_EXTS:
            skipped += 1
            continue

        parsed = parse_document(fp) or {}
        text = clean_text(parsed.get("text") or "")[:MAX_TEXT]
        if not text.strip():
            skipped += 1
            continue

        reg_no = _infer_reg_no(Path(fp).name)

        # ✅ Student model does NOT have course_id in your file
        student = db.query(Student).filter(Student.reg_no == reg_no).first()
        if not student:
            # program/section are required in your Student model typing => set defaults
            student = Student(
                reg_no=reg_no,
                name=reg_no,
                program="N/A",
                section="N/A",
            )
            db.add(student)
            db.flush()

        # Save Upload + UploadText (Upload.course_id is String in your model => store UUID as string)
        up = Upload(
            course_id=str(assessment.course_id),
            filename_original=Path(fp).name,
            filename_stored=Path(fp).name,
            ext=ext.lstrip("."),
            file_type_guess="student_submission",
            week_no=None,
            bytes=Path(fp).stat().st_size if Path(fp).exists() else 0,
            parse_log=[],
            created_at=datetime.utcnow(),
        )
        db.add(up)
        db.flush()

        ut = UploadText(
            upload_id=up.id,
            text=text,
            text_chars=len(text),
            needs_ocr=False,
            parse_warnings=[],
        )
        db.add(ut)

        sub = StudentSubmission(
            assessment_id=assessment.id,
            student_id=student.id,
            upload_id=up.id,
            status="uploaded",
            ai_marks=None,
            ai_feedback=None,
            evidence_json={"reg_no": reg_no, "filename": Path(fp).name},
            created_at=utcnow(),
        )
        db.add(sub)
        created += 1

    db.commit()
    return {"files_seen": len(files), "created": created, "skipped": skipped, "errors": errors}


def grade_all(
    db: Session,
    assessment: Assessment,
    created_by: str,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    exp = (
        db.query(AssessmentExpectedAnswers)
        .filter(AssessmentExpectedAnswers.assessment_id == assessment.id)
        .first()
    )
    if not exp or not exp.parsed_json:
        raise ValueError("Expected answers not generated. Run generate-expected-answers first.")

    gr = GradingRun(
        assessment_id=assessment.id,
        model=model,
        prompt_version="v1",
        thresholds={"note": "strict but fair"},
        created_by=created_by,
        created_at=utcnow(),
        completed=False,
    )
    db.add(gr)
    db.commit()
    db.refresh(gr)

    system = (Path(__file__).resolve().parent / "ai_prompts" / "grading_v1.txt").read_text(encoding="utf-8")
    schema_hint = '{"total_marks":10,"feedback":"...","per_question":[{"question_no":1,"marks_awarded":2,"justification":"...","missing_points":["..."]}]}'

    subs = (
        db.query(StudentSubmission)
        .filter(StudentSubmission.assessment_id == assessment.id)
        .order_by(StudentSubmission.created_at.asc())
        .all()
    )

    graded = 0
    failed = 0

    for s in subs:
        try:
            ut = None
            if s.upload_id:
                ut = db.query(UploadText).filter(UploadText.upload_id == s.upload_id).first()

            sub_text = clean_text((ut.text if ut else "") or "")[:MAX_TEXT]

            user = (
                f"ASSESSMENT_TITLE: {assessment.title}\n"
                f"MAX_MARKS: {assessment.max_marks}\n"
                f"EXPECTED_ANSWERS_JSON:\n{json.dumps(exp.parsed_json, ensure_ascii=False)}\n\n"
                f"STUDENT_SUBMISSION_TEXT:\n{sub_text}\n"
            )

            parsed, meta = call_openrouter_json(
                system=system,
                user=user,
                schema_hint=schema_hint,
                model=model,
                temperature=0.2
            )

            total = float(parsed.get("total_marks") or 0.0)
            feedback = str(parsed.get("feedback") or "")

            s.ai_marks = total
            s.ai_feedback = feedback
            s.status = "graded"
            s.evidence_json = {
                **(s.evidence_json or {}),
                "grading_run_id": str(gr.id),
                "model": meta.get("model"),
                "prompt_version": "v1",
                "input_hash": meta.get("input_hash"),
                "raw_response": meta.get("raw_response"),
                "parsed": parsed,
            }
            db.add(s)
            graded += 1

        except Exception as e:
            s.status = "error"
            s.evidence_json = {**(s.evidence_json or {}), "error": str(e)}
            db.add(s)
            failed += 1

    gr.completed = True
    db.add(gr)
    db.commit()

    return {"graded": graded, "failed": failed, "grading_run_id": str(gr.id)}
