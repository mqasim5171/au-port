# models/course_clo.py
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
import uuid
import datetime

Base = declarative_base()

class CourseCLO(Base):
    __tablename__ = "course_clos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    filename = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    parsed_text = Column(String)
    clos_text = Column(String)
    file_path = Column(String)
