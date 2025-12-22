# backend/services/reminder_engine.py
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
from uuid import UUID

from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models.reminder import ReminderRule, ReminderStep, ReminderNotification


def utcnow():
    return datetime.now(timezone.utc)


def _table_exists(db: Session, name: str) -> bool:
    try:
        insp = inspect(db.bind)
        return name in insp.get_table_names()
    except Exception:
        return False


def _col_exists(db: Session, table: str, col: str) -> bool:
    try:
        insp = inspect(db.bind)
        cols = [c["name"] for c in insp.get_columns(table)]
        return col in cols
    except Exception:
        return False


def ensure_default_rules(db: Session) -> Dict[str, Any]:
    """
    Inserts default rules only if missing.
    Touches ONLY reminder_* tables.
    """
    defaults = [
        {
            "code": "COURSE_GUIDE_MISSING",
            "title": "Course Guide missing",
            "description": "No course guide uploaded for this course.",
            "target_type": "course",
            "audience_role": "course_lead",
            "steps": [
                {"step_no": 1, "after_hours": 0, "action": "REMIND", "message_template": "Upload Course Guide for this course."},
                {"step_no": 2, "after_hours": 24, "action": "ESCALATE", "message_template": "Course Guide still missing after 24h. Escalate to QEC."},
            ],
        },
        {
            "code": "EXPECTED_ANSWERS_MISSING",
            "title": "Expected Answers not generated",
            "description": "Assessment has questions uploaded but no expected answers generated.",
            "target_type": "assessment",
            "audience_role": "course_lead",
            "steps": [
                {"step_no": 1, "after_hours": 0, "action": "REMIND", "message_template": "Generate Expected Answers for this assessment."},
                {"step_no": 2, "after_hours": 24, "action": "ESCALATE", "message_template": "Expected Answers still missing after 24h. Escalate to QEC."},
            ],
        },
        {
            "code": "SUBMISSIONS_MISSING",
            "title": "Student submissions not uploaded",
            "description": "Assessment exists but submissions ZIP not uploaded.",
            "target_type": "assessment",
            "audience_role": "instructor",
            "steps": [
                {"step_no": 1, "after_hours": 0, "action": "REMIND", "message_template": "Upload student submissions ZIP for this assessment."},
                {"step_no": 2, "after_hours": 24, "action": "ESCALATE", "message_template": "Submissions still missing after 24h. Escalate to Course Lead."},
            ],
        },
        {
            "code": "WEEKLY_ZIP_MISSING",
            "title": "Weekly upload missing",
            "description": "Weekly ZIP/material not uploaded for planned week.",
            "target_type": "weekly",
            "audience_role": "instructor",
            "steps": [
                {"step_no": 1, "after_hours": 0, "action": "REMIND", "message_template": "Upload weekly ZIP for this week."},
                {"step_no": 2, "after_hours": 24, "action": "ESCALATE", "message_template": "Weekly upload missing after 24h. Escalate to Course Lead."},
            ],
        },
    ]

    created = 0
    for d in defaults:
        exists = db.query(ReminderRule).filter(ReminderRule.code == d["code"]).first()
        if exists:
            continue

        r = ReminderRule(
            code=d["code"],
            title=d["title"],
            description=d.get("description"),
            target_type=d.get("target_type", "course"),
            audience_role=d.get("audience_role", "admin"),
            is_enabled=True,
        )
        db.add(r)
        db.flush()

        for s in d["steps"]:
            st = ReminderStep(
                rule_id=r.id,
                step_no=s["step_no"],
                after_hours=s["after_hours"],
                action=s["action"],
                channel="in_app",
                message_template=s.get("message_template"),
            )
            db.add(st)

        created += 1

    db.commit()
    return {"created_rules": created}


# --------- Rule evaluators (DB-safe: checks schema presence) ---------

def _find_course_guide_missing(db: Session) -> List[Dict[str, Any]]:
    """
    Strategy:
    If uploads table exists and has file_type_guess + course_id,
    consider course guide uploaded if uploads.file_type_guess in ('course_guide', 'courseguide').
    """
    if not _table_exists(db, "courses"):
        return []
    if not _table_exists(db, "uploads"):
        return []
    if not (_col_exists(db, "uploads", "course_id") and _col_exists(db, "uploads", "file_type_guess")):
        return []

    q = text("""
        SELECT c.id::text AS course_id
        FROM courses c
        WHERE NOT EXISTS (
            SELECT 1 FROM uploads u
            WHERE u.course_id = c.id
              AND LOWER(COALESCE(u.file_type_guess,'')) IN ('course_guide', 'courseguide')
        )
    """)
    rows = db.execute(q).mappings().all()
    out = []
    for r in rows:
        out.append({
            "target_type": "course",
            "target_key": f"course:{r['course_id']}",
            "course_id": r["course_id"],
            "due_at": utcnow(),
            "payload": {"reason": "no course guide upload found"},
        })
    return out


def _find_expected_answers_missing(db: Session) -> List[Dict[str, Any]]:
    """
    If assessment_files exists (questions uploaded) and expected answers missing.
    """
    if not _table_exists(db, "assessments"):
        return []
    if not _table_exists(db, "assessment_files"):
        return []
    if not _table_exists(db, "assessment_expected_answers"):
        return []

    q = text("""
        SELECT a.id::text AS assessment_id, a.course_id::text AS course_id
        FROM assessments a
        WHERE EXISTS (
            SELECT 1 FROM assessment_files f
            WHERE f.assessment_id = a.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM assessment_expected_answers e
            WHERE e.assessment_id = a.id
        )
    """)
    rows = db.execute(q).mappings().all()
    out = []
    for r in rows:
        out.append({
            "target_type": "assessment",
            "target_key": f"assessment:{r['assessment_id']}",
            "course_id": r["course_id"],
            "assessment_id": r["assessment_id"],
            "due_at": utcnow(),
            "payload": {"reason": "questions uploaded but expected answers missing"},
        })
    return out


def _find_submissions_missing(db: Session) -> List[Dict[str, Any]]:
    if not _table_exists(db, "assessments"):
        return []
    if not _table_exists(db, "student_submissions"):
        return []

    q = text("""
        SELECT a.id::text AS assessment_id, a.course_id::text AS course_id
        FROM assessments a
        WHERE NOT EXISTS (
            SELECT 1 FROM student_submissions s
            WHERE s.assessment_id = a.id
        )
    """)
    rows = db.execute(q).mappings().all()
    out = []
    for r in rows:
        out.append({
            "target_type": "assessment",
            "target_key": f"assessment:{r['assessment_id']}",
            "course_id": r["course_id"],
            "assessment_id": r["assessment_id"],
            "due_at": utcnow(),
            "payload": {"reason": "no submissions found"},
        })
    return out


def _find_weekly_zip_missing(db: Session) -> List[Dict[str, Any]]:
    """
    Requires:
      weekly_plans table with course_id + week_no
      uploads table with course_id + week_no + file_type_guess
    If your weekly plan table name differs, tell me and I’ll adjust in one line.
    """
    if not _table_exists(db, "weekly_plans"):
        return []
    if not _table_exists(db, "uploads"):
        return []
    if not (_col_exists(db, "weekly_plans", "course_id") and _col_exists(db, "weekly_plans", "week_no")):
        return []
    if not (_col_exists(db, "uploads", "course_id") and _col_exists(db, "uploads", "week_no") and _col_exists(db, "uploads", "file_type_guess")):
        return []

    q = text("""
        SELECT wp.course_id::text AS course_id, wp.week_no AS week_no
        FROM weekly_plans wp
        WHERE NOT EXISTS (
            SELECT 1 FROM uploads u
            WHERE u.course_id = wp.course_id
              AND u.week_no = wp.week_no
              AND LOWER(COALESCE(u.file_type_guess,'')) IN ('weekly_zip','weekly_upload','weekly_materials')
        )
    """)
    rows = db.execute(q).mappings().all()
    out = []
    for r in rows:
        out.append({
            "target_type": "weekly",
            "target_key": f"weekly:{r['course_id']}:{int(r['week_no'])}",
            "course_id": r["course_id"],
            "week_no": int(r["week_no"]),
            "due_at": utcnow(),
            "payload": {"reason": "weekly plan exists but upload missing"},
        })
    return out


def run_reminder_engine(db: Session) -> Dict[str, Any]:
    """
    Generates reminder_notifications for missing items.
    Writes ONLY into reminder_notifications.
    """
    rules = db.query(ReminderRule).filter(ReminderRule.is_enabled == True).all()

    fired = 0
    skipped_rules = []
    errors = []

    for rule in rules:
        try:
            steps = sorted(rule.steps or [], key=lambda s: s.step_no)
            if not steps:
                continue

            # Evaluate targets for each rule
            targets: List[Dict[str, Any]] = []
            if rule.code == "COURSE_GUIDE_MISSING":
                targets = _find_course_guide_missing(db)
            elif rule.code == "EXPECTED_ANSWERS_MISSING":
                targets = _find_expected_answers_missing(db)
            elif rule.code == "SUBMISSIONS_MISSING":
                targets = _find_submissions_missing(db)
            elif rule.code == "WEEKLY_ZIP_MISSING":
                targets = _find_weekly_zip_missing(db)
            else:
                skipped_rules.append(rule.code)
                continue

            for t in targets:
                # Create notifications for each step (deduped by unique constraint)
                for st in steps:
                    n = ReminderNotification(
                        rule_id=rule.id,
                        step_id=st.id,
                        target_type=t["target_type"],
                        target_key=t["target_key"],
                        course_id=UUID(t["course_id"]) if t.get("course_id") else None,
                        assessment_id=UUID(t["assessment_id"]) if t.get("assessment_id") else None,
                        week_no=t.get("week_no"),
                        audience_role=rule.audience_role,
                        status="pending",
                        due_at=t.get("due_at"),
                        payload={
                            **(t.get("payload") or {}),
                            "rule_code": rule.code,
                            "step_no": st.step_no,
                            "action": st.action,
                            "message": (st.message_template or ""),
                        },
                    )
                    db.add(n)
                    try:
                        db.flush()
                        fired += 1
                    except IntegrityError:
                        db.rollback()  # already exists due to unique constraint
        except Exception as e:
            errors.append({"rule": rule.code, "error": str(e)})

    db.commit()
    return {"created_notifications": fired, "skipped_rules": skipped_rules, "errors": errors}
