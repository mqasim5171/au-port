# backend/core/rbac.py
from fastapi import Depends, HTTPException, status
from routers.auth import get_current_user
from models.user import User

def require_roles(*roles: str):
    allowed = {r.lower() for r in roles}

    def _dep(current: User = Depends(get_current_user)) -> User:
        role = (current.role or "").lower()
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current

    return _dep

def is_admin(role: str | None) -> bool:
    return (role or "").lower() in {"admin", "administrator", "superadmin"}
