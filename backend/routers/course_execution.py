# backend/routers/course_execution.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.db import SessionLocal
from .auth import get_current_user
from models.course import Course
from models.course_execution import WeeklyPlan, WeeklyExecution, DeviationLog
from schemas.course_execution import (
    WeeklyPlanOut,
    WeeklyPlanUpdate,
    WeeklyExecutionCreate,
    WeeklyExecutionOut,
    WeeklyStatusSummary,
    WeeklyStatusItem,
    DeviationOut,
    DeviationResolve,
)
from services.course_execution import generate_weekly_plan_from_guide, update_deviations_for_course


router = APIRouter(prefix="/courses", tags=["Course Execution"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- COURSE PLAN SETUP ----------

@router.post("/{course_id}/weekly-plan/generate-from-guide", response_model=List[WeeklyPlanOut])
def generate_weekly_plan(
    course_id: str,
    guide_text: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    plans = generate_weekly_plan_from_guide(db, course, guide_text)
    # recompute deviations (empty execution at this stage)
    update_deviations_for_course(db, course_id)
    return plans


@router.get("/{course_id}/weekly-plan", response_model=List[WeeklyPlanOut])
def list_weekly_plan(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    return (
        db.query(WeeklyPlan)
        .filter(WeeklyPlan.course_id == course_id)
        .order_by(WeeklyPlan.week_number)
        .all()
    )


@router.put("/weekly-plan/{week_id}", response_model=WeeklyPlanOut)
def update_weekly_plan(
    week_id: str,
    payload: WeeklyPlanUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    plan = db.get(WeeklyPlan, week_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Weekly plan not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)

    db.add(plan)
    db.commit()
    db.refresh(plan)

    update_deviations_for_course(db, plan.course_id)
    return plan


# ---------- EXECUTION TRACKING ----------

@router.post("/{course_id}/weekly-execution/{week_number}", response_model=WeeklyExecutionOut)
def upsert_weekly_execution(
    course_id: str,
    week_number: int,
    payload: WeeklyExecutionCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    exec_obj = (
        db.query(WeeklyExecution)
        .filter(
            WeeklyExecution.course_id == course_id,
            WeeklyExecution.week_number == week_number,
        )
        .first()
    )

    if exec_obj is None:
        exec_obj = WeeklyExecution(
            course_id=course_id,
            week_number=week_number,
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exec_obj, field, value)

    db.add(exec_obj)
    db.commit()
    db.refresh(exec_obj)

    update_deviations_for_course(db, course_id)
    return exec_obj


@router.get("/{course_id}/weekly-execution", response_model=List[WeeklyExecutionOut])
def list_weekly_execution(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    return (
        db.query(WeeklyExecution)
        .filter(WeeklyExecution.course_id == course_id)
        .order_by(WeeklyExecution.week_number)
        .all()
    )


@router.get("/{course_id}/weekly-status-summary", response_model=WeeklyStatusSummary)
def weekly_status_summary(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    plans = {
        p.week_number: p
        for p in db.query(WeeklyPlan)
        .filter(WeeklyPlan.course_id == course_id)
        .all()
    }
    execs = {
        e.week_number: e
        for e in db.query(WeeklyExecution)
        .filter(WeeklyExecution.course_id == course_id)
        .all()
    }

    max_week = max(plans.keys() | execs.keys() | {16})

    items: list[WeeklyStatusItem] = []
    for w in range(1, max_week + 1):
        plan = plans.get(w)
        exe = execs.get(w)

        # decide status (simple)
        if exe:
            status_val = exe.coverage_status
        elif plan:
            status_val = "behind" if plan.planned_end_date else "on_track"
        else:
            status_val = "skipped"

        items.append(
            WeeklyStatusItem(
                week_number=w,
                planned_topics=plan.planned_topics if plan else None,
                delivered_topics=exe.delivered_topics if exe else None,
                planned_assessments=plan.planned_assessments if plan else None,
                delivered_assessments=exe.delivered_assessments if exe else None,
                coverage_status=status_val,
            )
        )

    return WeeklyStatusSummary(course_id=course_id, items=items)


# ---------- DEVIATION HANDLING ----------

@router.get("/{course_id}/deviations", response_model=List[DeviationOut])
def list_deviations(
    course_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    return (
        db.query(DeviationLog)
        .filter(DeviationLog.course_id == course_id)
        .order_by(DeviationLog.week_number, DeviationLog.created_at)
        .all()
    )


@router.put("/deviations/{deviation_id}/resolve", response_model=DeviationOut)
def resolve_deviation(
    deviation_id: str,
    payload: DeviationResolve,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    dev = db.get(DeviationLog, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")

    dev.resolved = payload.resolved
    if payload.resolved:
        dev.resolved_at = dev.resolved_at or dev.created_at
        dev.resolved_by = current["id"] if isinstance(current, dict) else str(current.id)
    else:
        dev.resolved_at = None
        dev.resolved_by = None

    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev
