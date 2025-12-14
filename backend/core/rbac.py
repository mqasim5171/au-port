# backend/core/rbac.py
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.db import SessionLocal
from models.course_assignment import CourseAssignment


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def norm_role(r: str) -> str:
    x = (r or "").strip().lower()
    x = x.replace("_", "").replace("-", "")
    if x == "teacher":
        x = "faculty"
    if x == "administrator":
        x = "admin"
    return x


# ✅ SAFE wrapper: MUST return the actual user, not Depends(...)
def _get_current_user_safe():
    from routers.auth import get_current_user  # local import avoids circular import
    return get_current_user()                  # ✅ call it, return user object


def require_roles(*allowed_roles: str):
    allowed = {norm_role(x) for x in allowed_roles}

    def dep(current=Depends(_get_current_user_safe)):
        if norm_role(getattr(current, "role", "")) not in allowed:
            raise HTTPException(status_code=403, detail="Not authorized for this action")
        return current

    return dep


# ✅ course_id comes from the route automatically
def require_course_access(
    course_id: str,
    current=Depends(_get_current_user_safe),   # ✅ NOTE: no () here
    db: Session = Depends(get_db),
):
    r = norm_role(getattr(current, "role", ""))

    if r in {"admin", "hod"}:
        return current

    rows = (
        db.query(CourseAssignment)
        .filter(
            CourseAssignment.course_id == course_id,
            CourseAssignment.user_id == current.id,
        )
        .all()
    )

    if not rows:
        raise HTTPException(status_code=403, detail="You don't have access to this course")

    # Course lead must have COURSE_LEAD assignment_role
    if r == "courselead":
        ok = any((x.assignment_role or "").upper() == "COURSE_LEAD" for x in rows)
        if not ok:
            raise HTTPException(status_code=403, detail="Course lead access required")
        return current

    # Faculty must have TEACHER
    ok = any((x.assignment_role or "").upper() == "TEACHER" for x in rows)
    if not ok:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current


def require_course_lead_or_higher(
    course_id: str,
    current=Depends(_get_current_user_safe),   # ✅ no ()
    db: Session = Depends(get_db),
):
    r = norm_role(getattr(current, "role", ""))

    if r in {"admin", "hod"}:
        return current

    rows = (
        db.query(CourseAssignment)
        .filter(
            CourseAssignment.course_id == course_id,
            CourseAssignment.user_id == current.id,
            CourseAssignment.assignment_role == "COURSE_LEAD",
        )
        .all()
    )

    if not rows:
        raise HTTPException(status_code=403, detail="Course lead (or higher) required")

    return current