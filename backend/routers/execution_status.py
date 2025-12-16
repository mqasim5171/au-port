# backend/routers/execution_status.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.db import get_db
from core.rbac import require_course_access
from models.course import Course
from models.course_execution import WeeklyPlan
from models.uploads import Upload

router = APIRouter(prefix="/courses", tags=["Execution Monitor"])

@router.get("/{course_id}/execution-status")
def get_execution_status(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(require_course_access),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 1) Determine expected weeks:
    # Prefer WeeklyPlan (generated from course guide)
    planned_weeks = (
        db.query(WeeklyPlan.week_number)
        .filter(WeeklyPlan.course_id == course_id)
        .all()
    )
    planned_weeks = sorted({w[0] for w in planned_weeks if w and w[0]})

    # fallback (if no plan exists yet)
    expected_weeks = planned_weeks if planned_weeks else list(range(1, 17))

    # 2) Determine uploaded lecture weeks (ONLY weekly lectures count)
    # NOTE: This assumes your Upload table stores week_number OR metadata with week.
    lectures = (
        db.query(Upload)
        .filter(
            Upload.course_id == course_id,
            Upload.category == "lecture",
        )
        .all()
    )

    uploaded_weeks = set()

    for lec in lectures:
        # ✅ if you have a column week_number:
        if hasattr(lec, "week_number") and lec.week_number:
            uploaded_weeks.add(int(lec.week_number))
            continue

        # ✅ fallback: if your upload stores week in folder_key like "week_3" etc
        fk = (getattr(lec, "folder_key", "") or "").lower()
        if "week" in fk:
            digits = "".join([c for c in fk if c.isdigit()])
            if digits:
                uploaded_weeks.add(int(digits))

    missing_weeks = [w for w in expected_weeks if w not in uploaded_weeks]

    # 3) If no guide/plan and no lectures uploaded -> show warning (not "on track")
    has_plan = bool(planned_weeks)
    has_any_lecture = bool(uploaded_weeks)

    if not has_plan and not has_any_lecture:
        return {
            "course_id": course_id,
            "is_on_track": False,
            "missing_weeks": expected_weeks,
            "message": "Upload Course Guide (or generate weekly plan) + upload weekly lectures to enable monitoring.",
        }

    return {
        "course_id": course_id,
        "is_on_track": len(missing_weeks) == 0,
        "missing_weeks": missing_weeks,
        "uploaded_weeks": sorted(uploaded_weeks),
        "expected_weeks": expected_weeks,
        "has_plan": has_plan,
    }
