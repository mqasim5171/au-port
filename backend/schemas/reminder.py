# backend/schemas/reminder.py
from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime
from uuid import UUID


class ReminderRuleOut(BaseModel):
    id: UUID
    code: str
    title: str
    description: Optional[str] = None
    target_type: str
    audience_role: str
    is_enabled: bool

    class Config:
        from_attributes = True


class ReminderStepOut(BaseModel):
    id: UUID
    rule_id: UUID
    step_no: int
    after_hours: int
    action: str
    channel: str
    message_template: Optional[str] = None

    class Config:
        from_attributes = True


class ReminderNotificationOut(BaseModel):
    id: UUID
    rule_id: UUID
    step_id: UUID
    target_type: str
    target_key: str
    course_id: Optional[UUID] = None
    assessment_id: Optional[UUID] = None
    week_no: Optional[int] = None
    audience_role: str
    status: str
    due_at: Optional[datetime] = None
    created_at: datetime
    sent_at: Optional[datetime] = None
    acked_at: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ReminderSummaryOut(BaseModel):
    pending: int
    acked: int
    total: int
