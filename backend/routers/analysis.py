# backend/routers/analysis.py
from fastapi import APIRouter, Depends
from core.rbac import _get_current_user_safe

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.get("/{file_id}")
def analyze_file(file_id: str, current=Depends(_get_current_user_safe)):
    # placeholder response so UI works
    return {"file_id": file_id, "clo": 0, "plo": 0}
