# backend/services/completeness_service.py
from __future__ import annotations
from sqlalchemy.orm import Session
from models.uploads import UploadText, Upload, UploadFileItem
from models.completeness import RequiredArtifact, CompletenessRun
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)

DEFAULT_RULES = [
    {"scope":"course_folder","name":"course_objectives","patterns":["objective","objectives"],"keywords":["course objectives"],"weight":1},
    {"scope":"course_folder","name":"clos","patterns":["clo","clos"],"keywords":["clo"],"weight":1},
    {"scope":"course_folder","name":"lecture_notes","patterns":["week","lecture","slides","ppt"],"keywords":["lecture"],"weight":2},
    {"scope":"course_folder","name":"quizzes","patterns":["quiz","q_"],"keywords":["quiz"],"weight":1},
    {"scope":"course_folder","name":"assignments","patterns":["assignment","a_"],"keywords":["assignment"],"weight":1},
    {"scope":"course_folder","name":"midterm","patterns":["mid"],"keywords":["midterm"],"weight":1},
    {"scope":"course_folder","name":"final_exam","patterns":["final"],"keywords":["final"],"weight":1},
    {"scope":"course_folder","name":"grading_rubric","patterns":["rubric","grading"],"keywords":["grading"],"weight":1},
]

def ensure_default_rules(db: Session):
    exists = db.query(RequiredArtifact).count()
    if exists:
        return
    for r in DEFAULT_RULES:
        db.add(RequiredArtifact(
            scope=r["scope"],
            name=r["name"],
            patterns=r["patterns"],
            keywords=r["keywords"],
            weight=r["weight"],
        ))
    db.commit()

def run_completeness(db: Session, course_id: str, upload_id, week_no: int | None):
    ensure_default_rules(db)

    upload = db.get(Upload, upload_id) if upload_id else None
    if not upload:
        raise ValueError("upload_id not found")

    # filenames (best signal for completeness in real QA)
    files = db.query(UploadFileItem).filter(UploadFileItem.upload_id == upload.id).all()
    filenames = [f.filename.lower() for f in files] if files else [upload.filename_original.lower()]

    txt = db.query(UploadText).filter(UploadText.upload_id == upload.id).first()
    big = (txt.text or "").lower() if txt else ""

    rules = db.query(RequiredArtifact).filter(RequiredArtifact.scope == "course_folder").all()

    total_w = sum(float(r.weight) for r in rules) or 1.0
    found = {}
    missing = []
    score_w = 0.0

    for r in rules:
        pats = [p.lower() for p in (r.patterns or [])]
        keys = [k.lower() for k in (r.keywords or [])]

        by_name = any(p in fn for fn in filenames for p in pats) if pats else False
        by_text = any(k in big for k in keys) if keys else False
        ok = by_name or by_text

        found[r.name] = {"ok": ok, "by_name": by_name, "by_text": by_text, "weight": float(r.weight)}
        if ok:
            score_w += float(r.weight)
        else:
            missing.append(r.name)

    pct = round((score_w / total_w) * 100.0, 2)

    result = {
        "course_id": course_id,
        "upload_id": str(upload.id),
        "week_no": week_no,
        "completeness_percent": pct,
        "missing": missing,
        "details": found,
    }

    run = CompletenessRun(
        course_id=course_id,
        upload_id=upload.id,
        week_no=week_no,
        result_json=result,
        created_at=utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return result
