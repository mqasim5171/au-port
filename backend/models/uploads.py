# models/uploads.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from core.db import Base
import uuid

class Upload(Base):
    __tablename__ = "uploads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # 🔹 NEW
    category = Column(String(50), nullable=False)  
    # course_guide | lecture | assessment_file | student_solution | misc

    folder_key = Column(String(255), nullable=True)
    # e.g. lectures/week-01, assessments/quiz

    assessment_id = Column(String(36), ForeignKey("assessments.id"), nullable=True)
    submission_id = Column(String(36), ForeignKey("student_submissions.id"), nullable=True)

    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    text = relationship("UploadText", back_populates="upload", uselist=False)


class UploadText(Base):
    __tablename__ = "upload_texts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id = Column(String(36), ForeignKey("uploads.id"), unique=True)
    extracted_text = Column(Text)

    upload = relationship("Upload", back_populates="text")
