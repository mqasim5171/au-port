# backend/schemas/admin.py
from pydantic import BaseModel, Field ,EmailStr
from typing import Optional

class AdminCourseCreate(BaseModel):
    course_code: str
    course_name: str
    semester: str
    year: str
    department: str
    instructor: Optional[str] = ""       # keep existing field for UI display
    clos: Optional[str] = "[]"           # JSON string (list)

class AssignStaffIn(BaseModel):
    user_id: str = Field(..., description="User UUID (string)")
    # "INSTRUCTOR" or "COURSE_LEAD"
    role: str = Field(..., description="INSTRUCTOR | COURSE_LEAD")

class CloItemIn(BaseModel):
    code: str
    description: str

class SetClosIn(BaseModel):
    clos: list[CloItemIn]

class UserMiniOut(BaseModel):
    id: str
    full_name: str
    username: str
    email: str
    role: str
    department: str

    class Config:
        from_attributes = True

class AdminCreateUserIn(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(..., description="instructor | course_lead")
    department: str | None = None