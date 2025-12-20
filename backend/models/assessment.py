# backend/models/assessment.py

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from core.base import Base
from .associations import assessment_clos  # ✅ ADD THIS


def utcnow():
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # DB column is uuid
    course_id = Column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type = Column(String(20), nullable=False)
    title = Column(String(255), nullable=False)

    # ✅ DB column name is total_marks
    max_marks = Column("total_marks", Integer, nullable=False)

    # DB column exists
    weightage = Column(Integer, nullable=False)

    # ✅ DB column name is date_conducted
    date = Column("date_conducted", Date, nullable=False)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    files = relationship(
        "AssessmentFile",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    expected = relationship(
        "AssessmentExpectedAnswers",
        uselist=False,
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    clo_alignment = relationship(
        "AssessmentCLOAlignment",
        uselist=False,
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    # ✅ THIS fixes: "Assessment has no property submissions"
    submissions = relationship(
        "StudentSubmission",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    # ✅ FIX for your current crash:
    # CourseCLO.assessments uses back_populates="clos" so Assessment MUST have "clos"
    clos = relationship(
        "CourseCLO",
        secondary=assessment_clos,
        back_populates="assessments",
        lazy="selectin",
    )


class AssessmentFile(Base):
    __tablename__ = "assessment_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    upload_id = Column(
        UUID(as_uuid=True),
        ForeignKey("uploads.id", ondelete="SET NULL"),
        nullable=True,
    )

    filename_original = Column(String, nullable=False)
    filename_stored = Column(String, nullable=False)
    ext = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    extracted_text = Column(Text, nullable=True)  # ✅ use Text, not String

    assessment = relationship("Assessment", back_populates="files")


class AssessmentExpectedAnswers(Base):
    __tablename__ = "assessment_expected_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    prompt_version = Column(String, default="v1")
    model = Column(String, nullable=True)
    input_hash = Column(String, index=True, nullable=True)

    raw_response = Column(Text, nullable=True)  # ✅ Text
    parsed_json = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    assessment = relationship("Assessment", back_populates="expected")


class AssessmentCLOAlignment(Base):
    __tablename__ = "assessment_clo_alignment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    coverage_percent = Column(Integer, default=0)  # keep as int (0..100)
    per_clo = Column(JSONB, nullable=True)
    per_question = Column(JSONB, nullable=True)

    model = Column(String, nullable=True)
    prompt_version = Column(String, default="v1")

    created_at = Column(DateTime(timezone=True), default=utcnow)

    assessment = relationship("Assessment", back_populates="clo_alignment")


class GradingRun(Base):
    __tablename__ = "grading_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    model = Column(String, nullable=True)
    prompt_version = Column(String, default="v1")
    thresholds = Column(JSONB, nullable=True)

    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    completed = Column(Boolean, default=False)
