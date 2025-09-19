# models/uploads.py
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(String, index=True, nullable=False)
    filename_original = Column(String, nullable=False)
    filename_stored = Column(String, nullable=False)
    ext = Column(String, nullable=False)
    file_type_guess = Column(String, index=True)         # e.g., LECTURE, QUIZ, COURSE_GUIDE
    week_no = Column(Integer, nullable=True)             # inferred from filename
    bytes = Column(Integer, nullable=False)
    pages = Column(Integer, nullable=True)
    sha256 = Column(String, index=True, nullable=False)  # for versioning/dedup
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    text = relationship("UploadText", uselist=False, back_populates="upload", cascade="all, delete")

class UploadText(Base):
    __tablename__ = "upload_texts"
    upload_id = Column(UUID(as_uuid=True), ForeignKey("uploads.id", ondelete="CASCADE"), primary_key=True)
    text = Column(Text, nullable=True)
    text_chars = Column(Integer, nullable=True)
    text_density = Column(Integer, nullable=True)   # chars per page (rounded)
    needs_ocr = Column(Boolean, default=False)
    parse_warnings = Column(JSONB, default=list)

    upload = relationship("Upload", back_populates="text")
