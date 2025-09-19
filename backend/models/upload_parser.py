# backend/modules/upload_parser.py
import os, re, io, zipfile, hashlib
from typing import Tuple, Optional, Dict, Any, List
from datetime import datetime

import fitz  # PyMuPDF
from docx import Document as DocxDocument  # python-docx
from sqlalchemy.orm import Session

from models.uploads import Upload, UploadText

# Safe storage directory
SAFE_DIR = os.getenv("UPLOAD_ROOT", "data/uploads")

# Regex patterns for filename classification
TYPE_PATTERNS = [
    ("COURSE_GUIDE", re.compile(r"(course[_\s]?guide|obe|outline)", re.I)),
    ("LECTURE",      re.compile(r"(lecture|lec|week)\s*(\d{1,2})", re.I)),
    ("QUIZ",         re.compile(r"quiz\s*(\d{1,2})?", re.I)),
    ("ASSIGNMENT",   re.compile(r"(assignment|assg)\s*(\d{1,2})?", re.I)),
    ("MIDTERM",      re.compile(r"mid(\s|-)?term|mid\s?exam", re.I)),
    ("FINAL",        re.compile(r"final(\s?exam)?", re.I)),
    ("MODEL_SOLUTION", re.compile(r"(model[_\s]?solution|solutions?)", re.I)),
    ("GRADED_SAMPLE",  re.compile(r"(graded|marked)\s?(sample|paper)", re.I)),
    ("ATTENDANCE",     re.compile(r"attendance", re.I)),
    ("LAB_MANUAL",     re.compile(r"lab(\s?manual)?", re.I)),
    ("WEEK_PLAN",      re.compile(r"(weekly|week\s*plan|schedule)", re.I)),
]

# ----------------- Utility helpers -----------------
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def safe_name(name: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9._-]+", "_", name)
    return base.strip("._")

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

# ----------------- Content-backed classification -----------------
def classify_by_content(text: str) -> tuple[Optional[str], Optional[int]]:
    """Peek at first page text if filename didn’t match."""
    t = text.lower()
    if "final exam" in t or "final examination" in t:
        return "FINAL", None
    if "midterm" in t or "mid term" in t or "mid exam" in t:
        return "MIDTERM", None
    if "model solution" in t or "answer key" in t or "marking scheme" in t:
        return "MODEL_SOLUTION", None
    if "quiz" in t and ("question" in t or "total marks" in t):
        return "QUIZ", None
    if "course guide" in t or "course outline" in t or "learning outcomes" in t or "clos" in t:
        return "COURSE_GUIDE", None
    if "lecture" in t or "slides" in t or "week" in t:
        m = re.search(r"week[ _-]?(\d{1,2})", t)
        return "LECTURE", int(m.group(1)) if m else None
    return None, None

def guess_type_and_week(filename: str, text: Optional[str] = None) -> Tuple[Optional[str], Optional[int]]:
    """Try filename regex first, then content text fallback."""
    f = filename.lower()
    week_no = None

    # 1. Filename regex check
    for kind, pat in TYPE_PATTERNS:
        m = pat.search(f)
        if m:
            if kind == "LECTURE" and m.lastindex and m.group(m.lastindex):
                try:
                    week_no = int(m.group(m.lastindex))
                except: 
                    pass
            if week_no is None:
                wm = re.search(r"week[_\s-]?(\d{1,2})", f)
                if wm: week_no = int(wm.group(1))
            return kind, week_no

    # 2. Fallback: content peek
    if text:
        kind, week_no = classify_by_content(text)
        if kind:
            return kind, week_no

    return None, week_no

# ----------------- File storage & parsing -----------------
def store_file(course_id: str, filename: str, data: bytes) -> Tuple[str, str]:
    ensure_dir(os.path.join(SAFE_DIR, course_id))
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
    stored_name = f"{ts}_{safe_name(filename)}"
    stored_path = os.path.join(SAFE_DIR, course_id, stored_name)
    with open(stored_path, "wb") as f:
        f.write(data)
    return stored_path, stored_name

def parse_pdf(content: bytes) -> Tuple[Optional[str], Optional[int], List[Dict[str, Any]]]:
    log = []
    try:
        with fitz.open(stream=content, filetype="pdf") as doc:
            pages = doc.page_count
            txt_chunks = []
            for i in range(pages):
                try:
                    txt_chunks.append(doc.load_page(i).get_text("text"))
                except Exception as e:
                    log.append({"level":"WARN","code":"PAGE_PARSE_FAIL","message":str(e),"page":i})
            text = "\n".join(txt_chunks).strip()
            return text if text else None, pages, log
    except Exception as e:
        log.append({"level":"ERROR","code":"PDF_OPEN_FAIL","message":str(e)})
        return None, None, log

def parse_docx(content: bytes) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    log = []
    try:
        bio = io.BytesIO(content)
        doc = DocxDocument(bio)
        text = "\n".join([p.text for p in doc.paragraphs]).strip()
        return (text if text else None), log
    except Exception as e:
        log.append({"level":"ERROR","code":"DOCX_OPEN_FAIL","message":str(e)})
        return None, log

def text_quality(text: Optional[str], pages: Optional[int]) -> Tuple[Optional[int], bool, List[Dict[str, Any]]]:
    log = []
    if text is None or pages in (None, 0):
        return None, True, [{"level":"WARN","code":"NO_TEXT","message":"No extractable text; likely scanned or empty."}]
    chars = len(text)
    density = round(chars / max(pages, 1))
    needs_ocr = density < 400  # heuristic threshold
    if needs_ocr:
        log.append({"level":"WARN","code":"LOW_TEXT_DENSITY","message":f"Density {density} chars/page; consider OCR."})
    return density, needs_ocr, log

# ----------------- Versioning -----------------
def upsert_version(db: Session, course_id: str, filename_original: str, sha: str) -> int:
    existing = db.query(Upload).filter(
        Upload.course_id == course_id,
        Upload.filename_original == filename_original
    ).order_by(Upload.version.desc()).first()
    if not existing:
        return 1
    if existing.sha256 == sha:
        return existing.version
    return existing.version + 1

# ----------------- Index into DB -----------------
def index_file(db: Session, course_id: str, filename: str, stored_name: str, ext: str,
               size: int, sha: str, text: Optional[str], pages: Optional[int],
               parse_log: List[Dict[str, Any]]) -> Upload:
    file_type, week_no = guess_type_and_week(filename, text)
    version = upsert_version(db, course_id, filename, sha)

    upload = Upload(
        course_id=course_id,
        filename_original=filename,
        filename_stored=stored_name,
        ext=ext,
        file_type_guess=file_type,
        week_no=week_no,
        bytes=size,
        pages=pages,
        sha256=sha,
        version=version,
    )
    db.add(upload)
    db.flush()  # get id

    density, needs_ocr, qlog = text_quality(text, pages)
    ut = UploadText(
        upload_id=upload.id,
        text=text,
        text_chars=(len(text) if text else None),
        text_density=density,
        needs_ocr=needs_ocr,
        parse_warnings=(parse_log + qlog)
    )
    db.add(ut)
    return upload

# ----------------- File handler -----------------
ALLOWED_EXTS = {".pdf", ".zip", ".docx"}

def handle_bytes(db: Session, course_id: str, filename: str, data: bytes,
                 global_log: List[Dict[str, Any]]) -> List[Upload]:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        global_log.append({"level":"WARN","code":"SKIP_EXT","message":f"Unsupported extension: {ext}","file":filename})
        return []

    uploads: List[Upload] = []
    if ext == ".zip":
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
            names = zf.namelist()
            global_log.append({"level":"INFO","code":"ZIP_EXTRACTED","message":f"Found {len(names)} entries in ZIP","file":filename})
            for n in names:
                if n.endswith("/") or n.startswith("__MACOSX/"):
                    continue
                content = zf.read(n)
                uploads += handle_bytes(db, course_id, n, content, global_log)
            return uploads
        except Exception as e:
            global_log.append({"level":"ERROR","code":"ZIP_OPEN_FAIL","message":str(e),"file":filename})
            return []

    # Single file (pdf/docx)
    stored_path, stored_name = store_file(course_id, filename, data)
    sha = sha256_bytes(data)

    parse_log: List[Dict[str, Any]] = [{"level":"INFO","code":"SAVE_OK","message":"Stored","path":stored_path}]
    pages, text = None, None
    if ext == ".pdf":
        text, pages, pl = parse_pdf(data)
        parse_log += pl
    elif ext == ".docx":
        text, pl = parse_docx(data)
        parse_log += pl

    up = index_file(db, course_id, filename, stored_name, ext, len(data), sha, text, pages, parse_log)
    uploads.append(up)
    return uploads
