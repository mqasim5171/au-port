from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from core.db import get_db
from routers.auth import get_current_user

from models.suggestion import Suggestion, SuggestionAction
from schemas.suggestion import (
    SuggestionCreate,
    SuggestionUpdate,
    SuggestionOut,
    SuggestionDetailOut,
    ActionCreate,
    ActionOut,
)

router = APIRouter(prefix="/api", tags=["Suggestions"])


@router.get("/courses/{course_id}/suggestions", response_model=list[SuggestionOut])
def list_suggestions(
    course_id: str,
    status: str | None = Query(None),
    priority: str | None = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(Suggestion).filter(Suggestion.course_id == course_id)
    if status:
        q = q.filter(Suggestion.status == status)
    if priority:
        q = q.filter(Suggestion.priority == priority)
    return q.order_by(Suggestion.created_at.desc()).all()


@router.post("/courses/{course_id}/suggestions", response_model=SuggestionOut, status_code=201)
def create_suggestion(
    course_id: str,
    payload: SuggestionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    s = Suggestion(
        course_id=course_id,
        owner_id=payload.owner_id,
        source=payload.source,
        text=payload.text,
        priority=payload.priority,
        status="new",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionDetailOut)
def get_suggestion_detail(
    suggestion_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    s = (
        db.query(Suggestion)
        .options(selectinload(Suggestion.actions))
        .filter(Suggestion.id == suggestion_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return s


@router.put("/suggestions/{suggestion_id}", response_model=SuggestionOut)
def update_suggestion(
    suggestion_id: str,
    payload: SuggestionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    s = db.query(Suggestion).filter(Suggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    changed = False
    if payload.status is not None:
        s.status = payload.status
        changed = True
    if payload.priority is not None:
        s.priority = payload.priority
        changed = True
    if payload.text is not None and payload.text.strip():
        s.text = payload.text
        changed = True

    if changed:
        db.add(
            SuggestionAction(
                suggestion_id=s.id,
                user_id=user.id,
                action_type="status_change",
                notes="Suggestion updated",
            )
        )

    db.commit()
    db.refresh(s)
    return s


@router.post("/suggestions/{suggestion_id}/actions", response_model=ActionOut, status_code=201)
def add_action(
    suggestion_id: str,
    payload: ActionCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    s = db.query(Suggestion).filter(Suggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    a = SuggestionAction(
        suggestion_id=suggestion_id,
        user_id=user.id,
        action_type=payload.action_type,
        notes=payload.notes or "",
        evidence_url=payload.evidence_url,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
