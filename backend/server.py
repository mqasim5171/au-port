from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Float, Text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
import os
import uuid
import jwt
import json
import shutil
import zipfile

DATABASE_URL = "sqlite:///./qa_portal.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

app = FastAPI()
api_router = APIRouter(prefix="/api")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')

# SQLAlchemy Models
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    full_name = Column(String)
    role = Column(String)
    department = Column(String, nullable=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class CourseDB(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = Column(String)
    course_name = Column(String)
    semester = Column(String)
    year = Column(String)
    instructor = Column(String)
    department = Column(String)
    clos = Column(Text)  # Store as JSON string
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class FileUploadDB(Base):
    __tablename__ = "file_uploads"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String)
    user_id = Column(String)
    filename = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    validation_status = Column(String)
    validation_details = Column(Text)  # Store as JSON string
    upload_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class FeedbackDB(Base):
    __tablename__ = "feedback"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String)
    student_name = Column(String)
    feedback_text = Column(Text)
    rating = Column(Integer)
    sentiment = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class QualityScoreDB(Base):
    __tablename__ = "quality_scores"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String)
    overall_score = Column(Float)
    completeness_score = Column(Float)
    alignment_score = Column(Float)
    feedback_score = Column(Float)
    suggestions = Column(Text)  # Store as JSON string
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

# Pydantic Models
class User(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    created_at: datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str
    department: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Course(BaseModel):
    id: str
    course_code: str
    course_name: str
    semester: str
    year: str
    instructor: str
    department: str
    clos: List[str] = []
    created_at: datetime

class CourseCreate(BaseModel):
    course_code: str
    course_name: str
    semester: str
    year: str
    instructor: str
    department: str
    clos: List[str] = []

class FileUpload(BaseModel):
    id: str
    course_id: str
    user_id: str
    filename: str
    file_type: str
    file_size: int
    validation_status: str
    validation_details: Dict[str, Any]
    upload_date: datetime

class Feedback(BaseModel):
    id: str
    course_id: str
    student_name: str
    feedback_text: str
    rating: int
    sentiment: str
    created_at: datetime

class FeedbackCreate(BaseModel):
    course_id: str
    student_name: str
    feedback_text: str
    rating: int

class QualityScore(BaseModel):
    id: str
    course_id: str
    overall_score: float
    completeness_score: float
    alignment_score: float
    feedback_score: float
    suggestions: List[str]
    generated_at: datetime

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def analyze_sentiment(text: str) -> str:
    positive_words = ["good", "excellent", "great", "amazing", "helpful", "clear", "engaging", "love", "best"]
    negative_words = ["bad", "terrible", "confusing", "boring", "difficult", "hard", "worst", "hate", "poor"]
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    if positive_count > negative_count:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    else:
        return "neutral"

def validate_course_folder(files_info: List[Dict]) -> Dict[str, Any]:
    required_items = {
        "course_objectives": False,
        "lecture_notes": False,
        "assignments": False,
        "quizzes": False,
        "midterm": False,
        "final_exam": False,
        "attendance": False,
        "grading_rubric": False
    }
    found_items = []
    for file_info in files_info:
        filename = file_info.get("filename", "").lower()
        if "objective" in filename:
            required_items["course_objectives"] = True
        elif "lecture" in filename or "note" in filename:
            required_items["lecture_notes"] = True
        elif "assignment" in filename:
            required_items["assignments"] = True
        elif "quiz" in filename:
            required_items["quizzes"] = True
        elif "midterm" in filename:
            required_items["midterm"] = True
        elif "final" in filename:
            required_items["final_exam"] = True
        elif "attendance" in filename:
            required_items["attendance"] = True
        elif "rubric" in filename or "grading" in filename:
            required_items["grading_rubric"] = True
        found_items.append(filename)
    completed_count = sum(required_items.values())
    total_count = len(required_items)
    completeness_percentage = (completed_count / total_count) * 100
    status = "complete" if completed_count == total_count else "incomplete"
    return {
        "status": status,
        "completeness_percentage": completeness_percentage,
        "required_items": required_items,
        "found_files": found_items,
        "missing_items": [item for item, found in required_items.items() if not found]
    }

def calculate_quality_score(course_id: str, validation_result: Dict, feedback_data: List = None) -> float:
    completeness_score = validation_result.get("completeness_percentage", 0) / 100
    feedback_score = 0.5
    if feedback_data:
        positive_count = sum(1 for f in feedback_data if f.get("sentiment") == "positive")
        total_feedback = len(feedback_data)
        feedback_score = positive_count / total_feedback if total_feedback > 0 else 0.5
    overall_score = (completeness_score * 0.7 + feedback_score * 0.3) * 100
    return round(overall_score, 2)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user = db.query(UserDB).filter(UserDB.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Authentication Routes
@api_router.post("/register")
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(UserDB).filter((UserDB.username == user_data.username) | (UserDB.email == user_data.email)).first():
        raise HTTPException(status_code=400, detail="Username or email already exists")
    hashed_password = get_password_hash(user_data.password)
    user = UserDB(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        department=user_data.department,
        password_hash=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created successfully", "user_id": user.id}

@api_router.post("/login")
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department,
            "created_at": user.created_at
        }
    }

@api_router.get("/profile")
def get_profile(current_user: UserDB = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "department": current_user.department,
        "created_at": current_user.created_at
    }

# Course Management Routes
@api_router.post("/courses", response_model=Course)
def create_course(course_data: CourseCreate, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    course = CourseDB(
        course_code=course_data.course_code,
        course_name=course_data.course_name,
        semester=course_data.semester,
        year=course_data.year,
        instructor=course_data.instructor,
        department=course_data.department,
        clos=json.dumps(course_data.clos)
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return Course(
        id=course.id,
        course_code=course.course_code,
        course_name=course.course_name,
        semester=course.semester,
        year=course.year,
        instructor=course.instructor,
        department=course.department,
        clos=course_data.clos,
        created_at=course.created_at
    )

@api_router.get("/courses", response_model=List[Course])
def get_courses(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    courses = db.query(CourseDB).all()
    result = []
    for course in courses:
        clos = []
        if course.clos:
            clos = json.loads(course.clos)
        result.append(Course(
            id=course.id,
            course_code=course.course_code,
            course_name=course.course_name,
            semester=course.semester,
            year=course.year,
            instructor=course.instructor,
            department=course.department,
            clos=clos,
            created_at=course.created_at
        ))
    return result

@api_router.get("/courses/{course_id}", response_model=Course)
def get_course(course_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    course = db.query(CourseDB).filter(CourseDB.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    clos = []
    if course.clos:
        clos = json.loads(course.clos)
    return Course(
        id=course.id,
        course_code=course.course_code,
        course_name=course.course_name,
        semester=course.semester,
        year=course.year,
        instructor=course.instructor,
        department=course.department,
        clos=clos,
        created_at=course.created_at
    )

# File Upload Routes
@api_router.post("/courses/{course_id}/upload")
def upload_course_folder(
    course_id: str,
    file: UploadFile = File(...),
    file_type: str = Form("course_folder"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    course = db.query(CourseDB).filter(CourseDB.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    upload_dir = f"uploads/{course_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    files_info = []
    validation_result = {"status": "pending"}
    if file.filename.endswith('.zip'):
        try:
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                extract_dir = os.path.join(upload_dir, f"extracted_{file.filename[:-4]}")
                zip_ref.extractall(extract_dir)
                for root, dirs, files in os.walk(extract_dir):
                    for filename in files:
                        files_info.append({"filename": filename, "path": os.path.join(root, filename)})
                validation_result = validate_course_folder(files_info)
        except Exception as e:
            validation_result = {"status": "invalid", "error": str(e)}
    else:
        files_info = [{"filename": file.filename, "path": file_path}]
        validation_result = validate_course_folder(files_info)
    file_upload = FileUploadDB(
        course_id=course_id,
        user_id=current_user.id,
        filename=file.filename,
        file_type=file_type,
        file_size=file.spool_max_size if hasattr(file, "spool_max_size") else 0,
        validation_status=validation_result["status"],
        validation_details=json.dumps(validation_result)
    )
    db.add(file_upload)
    db.commit()
    db.refresh(file_upload)
    return {
        "message": "File uploaded successfully",
        "upload_id": file_upload.id,
        "validation_result": validation_result
    }

@api_router.get("/courses/{course_id}/uploads")
def get_course_uploads(course_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    uploads = db.query(FileUploadDB).filter(FileUploadDB.course_id == course_id).all()
    result = []
    for upload in uploads:
        validation_details = {}
        if upload.validation_details:
            validation_details = json.loads(upload.validation_details)
        result.append(FileUpload(
            id=upload.id,
            course_id=upload.course_id,
            user_id=upload.user_id,
            filename=upload.filename,
            file_type=upload.file_type,
            file_size=upload.file_size,
            validation_status=upload.validation_status,
            validation_details=validation_details,
            upload_date=upload.upload_date
        ))
    return result

# Feedback Routes
@api_router.post("/courses/{course_id}/feedback")
def submit_feedback(
    course_id: str,
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    sentiment = analyze_sentiment(feedback_data.feedback_text)
    feedback = FeedbackDB(
        course_id=course_id,
        student_name=feedback_data.student_name,
        feedback_text=feedback_data.feedback_text,
        rating=feedback_data.rating,
        sentiment=sentiment
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"message": "Feedback submitted successfully", "feedback_id": feedback.id, "sentiment": sentiment}

@api_router.get("/courses/{course_id}/feedback")
def get_course_feedback(course_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    feedback_list = db.query(FeedbackDB).filter(FeedbackDB.course_id == course_id).all()
    result = []
    for feedback in feedback_list:
        result.append(Feedback(
            id=feedback.id,
            course_id=feedback.course_id,
            student_name=feedback.student_name,
            feedback_text=feedback.feedback_text,
            rating=feedback.rating,
            sentiment=feedback.sentiment,
            created_at=feedback.created_at
        ))
    return result

# Quality Score and Suggestions
@api_router.get("/courses/{course_id}/quality-score")
def get_quality_score(course_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    latest_upload = db.query(FileUploadDB).filter(FileUploadDB.course_id == course_id).order_by(FileUploadDB.upload_date.desc()).first()
    feedback_list = db.query(FeedbackDB).filter(FeedbackDB.course_id == course_id).all()
    if not latest_upload:
        return {"error": "No uploads found for this course"}
    validation_result = {}
    if latest_upload.validation_details:
        validation_result = json.loads(latest_upload.validation_details)
    feedback_data = [f.__dict__ for f in feedback_list]
    overall_score = calculate_quality_score(course_id, validation_result, feedback_data)
    suggestions = []
    if validation_result.get("completeness_percentage", 0) < 100:
        missing_items = validation_result.get("missing_items", [])
        for item in missing_items:
            suggestions.append(f"Upload {item.replace('_', ' ').title()} to improve completeness")
    if feedback_list:
        negative_feedback = [f for f in feedback_list if f.sentiment == "negative"]
        if len(negative_feedback) > len(feedback_list) * 0.3:
            suggestions.append("Address negative feedback to improve student satisfaction")
    quality_score = QualityScoreDB(
        course_id=course_id,
        overall_score=overall_score,
        completeness_score=validation_result.get("completeness_percentage", 0),
        alignment_score=75.0,
        feedback_score=(len([f for f in feedback_list if f.sentiment == "positive"]) / len(feedback_list) * 100) if feedback_list else 50.0,
        suggestions=json.dumps(suggestions)
    )
    db.add(quality_score)
    db.commit()
    db.refresh(quality_score)
    return QualityScore(
        id=quality_score.id,
        course_id=quality_score.course_id,
        overall_score=quality_score.overall_score,
        completeness_score=quality_score.completeness_score,
        alignment_score=quality_score.alignment_score,
        feedback_score=quality_score.feedback_score,
        suggestions=suggestions,
        generated_at=quality_score.generated_at
    )

# Dashboard Stats
@api_router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    total_courses = db.query(CourseDB).count()
    total_uploads = db.query(FileUploadDB).count()
    total_feedback = db.query(FeedbackDB).count()
    recent_uploads = db.query(FileUploadDB).order_by(FileUploadDB.upload_date.desc()).limit(5).all()
    recent_feedback = db.query(FeedbackDB).order_by(FeedbackDB.created_at.desc()).limit(5).all()
    uploads_result = []
    for upload in recent_uploads:
        validation_details = {}
        if upload.validation_details:
            validation_details = json.loads(upload.validation_details)
        uploads_result.append(FileUpload(
            id=upload.id,
            course_id=upload.course_id,
            user_id=upload.user_id,
            filename=upload.filename,
            file_type=upload.file_type,
            file_size=upload.file_size,
            validation_status=upload.validation_status,
            validation_details=validation_details,
            upload_date=upload.upload_date
        ))
    feedback_result = []
    for feedback in recent_feedback:
        feedback_result.append(Feedback(
            id=feedback.id,
            course_id=feedback.course_id,
            student_name=feedback.student_name,
            feedback_text=feedback.feedback_text,
            rating=feedback.rating,
            sentiment=feedback.sentiment,
            created_at=feedback.created_at
        ))
    return {
        "total_courses": total_courses,
        "total_uploads": total_uploads,
        "total_feedback": total_feedback,
        "recent_uploads": uploads_result,
        "recent_feedback": feedback_result
    }

# Initialize sample data
@api_router.post("/init-sample-data")
def initialize_sample_data(db: Session = Depends(get_db)):
    sample_courses = [
        {
            "course_code": "CS-201",
            "course_name": "Object-Oriented Programming",
            "semester": "Fall",
            "year": "2024",
            "instructor": "Dr. Muhammad Bilal",
            "department": "Computer Science",
            "clos": [
                "Understand OOP concepts and principles",
                "Design and implement classes and objects",
                "Apply inheritance and polymorphism"
            ]
        },
        {
            "course_code": "CS-301",
            "course_name": "Data Structures and Algorithms",
            "semester": "Spring",
            "year": "2024",
            "instructor": "Dr. Sarah Khan",
            "department": "Computer Science",
            "clos": [
                "Implement basic data structures",
                "Analyze algorithm complexity",
                "Design efficient algorithms"
            ]
        }
    ]
    for course_data in sample_courses:
        course = CourseDB(
            course_code=course_data["course_code"],
            course_name=course_data["course_name"],
            semester=course_data["semester"],
            year=course_data["year"],
            instructor=course_data["instructor"],
            department=course_data["department"],
            clos=json.dumps(course_data["clos"])
        )
        db.add(course)
    db.commit()
    return {"message": "Sample data initialized successfully"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)