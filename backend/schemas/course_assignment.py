from pydantic import BaseModel

class AssignUserToCourseIn(BaseModel):
    user_id: str
    assignment_role: str = "TEACHER"  # TEACHER or COURSE_LEAD
