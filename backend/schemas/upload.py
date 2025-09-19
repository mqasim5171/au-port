# schemas/uploads.py
#pendamic responce....


from pydantic import BaseModel
from typing import List, Optional, Literal, Any, Dict

class UploadItem(BaseModel):
    id: str
    filename_original: str
    filename_stored: str
    ext: str
    file_type_guess: Optional[str]
    week_no: Optional[int]
    bytes: int
    pages: Optional[int]
    version: int

class UploadResponse(BaseModel):
    files: List[UploadItem]
    log: List[Dict[str, Any]]
