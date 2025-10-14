# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, model_validator
from typing import Optional

from core.db import SessionLocal
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from schemas.user import UserCreate, UserOut
from schemas.auth import TokenOut
from models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

# Swagger "Authorize" shows a single token box
bearer_scheme = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email/username already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        department=payload.department,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

class LoginJSON(BaseModel):
    username: Optional[str] = None   # username OR email
    password: str

    @model_validator(mode="after")
    def _require_username(self):
        if not (self.username and self.username.strip()):
            raise ValueError("Provide username or email")
        return self

@router.post("/login", response_model=TokenOut)
def login_json(payload: LoginJSON, db: Session = Depends(get_db)):
    identifier = payload.username.strip()
    q = (User.email == identifier) if ("@" in identifier) else (User.username == identifier)
    user = db.query(User).filter(q).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    return {
        "access_token": access,
        "token_type": "bearer",
        "refresh_token": refresh,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department,
        },
    }

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, data["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current
