# backend/routers/reminders.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone

from core.db import SessionLocal, engine
from core.base import Base
from routers.auth import get_current_user

from models.reminder import ReminderRule, ReminderStep, ReminderNotification
from schemas.reminder import ReminderNotificationOut, ReminderSummaryOut
from services.reminder_engine import run_reminder_engine, ensure_default_rules

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _role(current) -> str:
    return (current.get("role") if isinstance(current, dict) else getattr(current, "role", "")) or ""


def _require_admin(current):
    if "admin" not in _role(current).lower():
        raise HTTPException(status_code=403, detail="Admin only")


@router.post("/bootstrap")
def bootstrap_tables(current=Depends(get_current_user)):
    """
    Creates ONLY reminder tables if missing.
    Does NOT alter any existing tables.
    """
    _require_admin(current)
    Base.metadata.create_all(
        bind=engine,
        tables=[
            ReminderRule.__table__,
            ReminderStep.__table__,
            ReminderNotification.__table__,
        ],
    )
    return {"ok": True}


@router.post("/init-defaults")
def init_defaults(db: Session = Depends(get_db), current=Depends(get_current_user)):
    _require_admin(current)
    out = ensure_default_rules(db)
    return {"ok": True, **out}


@router.post("/run")
def run_now(db: Session = Depends(get_db), current=Depends(get_current_user)):
    _require_admin(current)
    out = run_reminder_engine(db)
    return {"ok": True, **out}


@router.get("/summary", response_model=ReminderSummaryOut)
def summary(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    role = _role(current).lower() or "user"
    pending = db.query(ReminderNotification).filter(
        ReminderNotification.audience_role.ilike(f"%{role}%"),
        ReminderNotification.status == "pending",
    ).count()
    acked = db.query(ReminderNotification).filter(
        ReminderNotification.audience_role.ilike(f"%{role}%"),
        ReminderNotification.status == "acked",
    ).count()
    total = db.query(ReminderNotification).filter(
        ReminderNotification.audience_role.ilike(f"%{role}%"),
    ).count()
    return {"pending": pending, "acked": acked, "total": total}


@router.get("/inbox", response_model=list[ReminderNotificationOut])
def inbox(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    role = _role(current).lower() or "user"
    q = db.query(ReminderNotification).filter(ReminderNotification.audience_role.ilike(f"%{role}%"))
    if status:
        q = q.filter(ReminderNotification.status == status)
    return q.order_by(ReminderNotification.created_at.desc()).limit(limit).all()


@router.post("/ack/{notification_id}")
def ack_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    n = db.get(ReminderNotification, UUID(notification_id))
    if not n:
        raise HTTPException(status_code=404, detail="Not found")

    # allow admin or same role
    role = _role(current).lower() or "user"
    if ("admin" not in role) and (role not in (n.audience_role or "").lower()):
        raise HTTPException(status_code=403, detail="Not allowed")

    n.status = "acked"
    n.acked_at = datetime.now(timezone.utc)
    db.add(n)
    db.commit()
    return {"ok": True}
