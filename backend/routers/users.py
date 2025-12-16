from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.db import SessionLocal
from models.user import User
from schemas.user import UserOut
from .auth import get_current_user
from core.rbac import norm_role

router = APIRouter(prefix="/users", tags=["Users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=list[UserOut])
def list_users(
    role: str | None = Query(default=None),  # ✅ /users?role=faculty
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    # ✅ only Admin/HOD can list users (recommended)
    r = norm_role(getattr(current, "role", ""))
    if r not in {"admin", "hod"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    q = db.query(User)

    if role:
        want = norm_role(role)
        # normalize teacher/faculty aliases
        if want in {"teacher", "faculty"}:
            q = q.filter(User.role.in_(["teacher", "Teacher", "faculty", "Faculty"]))
        elif want in {"courselead", "course_lead", "course-lead"}:
            q = q.filter(User.role.in_(["courselead", "CourseLead", "COURSE_LEAD"]))
        elif want in {"admin"}:
            q = q.filter(User.role.in_(["admin", "Admin", "administrator", "Administrator"]))
        elif want in {"hod"}:
            q = q.filter(User.role.in_(["hod", "HOD"]))
        else:
            q = q.filter(User.role == role)

    return q.order_by(User.full_name.asc()).limit(200).all()
