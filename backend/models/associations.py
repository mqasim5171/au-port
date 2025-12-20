# backend/models/associations.py
from sqlalchemy import Table, Column, ForeignKey, Float, String
from sqlalchemy.dialects.postgresql import UUID

from core.base import Base

assessment_clos = Table(
    "assessment_clos",
    Base.metadata,
    Column("assessment_id", UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True),
    Column("course_clo_id", String(36), ForeignKey("course_clos.id", ondelete="CASCADE"), primary_key=True),
    Column("confidence", Float, nullable=True),
    Column("method", String(32), nullable=True),
)
