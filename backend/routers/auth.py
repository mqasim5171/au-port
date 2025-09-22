# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.db import SessionLocal
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from schemas.user import UserCreate, UserOut
from schemas.auth import TokenOut  # keep using your existing TokenOut schema
from models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])

# Works with Swagger "Authorize" button
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # prevent duplicate email or username
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


@router.post("/login", response_model=TokenOut)
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Accepts BOTH:
      - JSON: { "username":"...", "password":"..." } OR { "email":"...", "password":"..." }
      - form:  username=...&password=...  (Swagger uses this)
    And allows login with username OR email.
    """
    ct = request.headers.get("content-type", "")
    identifier = None
    password = None

    if ct.startswith("application/json"):
        body = await request.json()
        identifier = (body or {}).get("username") or (body or {}).get("email")
        password = (body or {}).get("password")
    else:
        form = await request.form()
        identifier = form.get("username") or form.get("email")
        password = form.get("password")

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username/email and password are required",
        )

    # Decide whether identifier is email or username
    q = (User.email == identifier) if ("@" in identifier) else (User.username == identifier)
    user = db.query(User).filter(q).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(user.id)       # your helpers already use "sub"
    refresh = create_refresh_token(user.id)

    # Return standard token payload; extra "user" is fine (response_model will filter if needed)
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
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, data["sub"])
    # Your User model doesn't define is_active; just check existence
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current
