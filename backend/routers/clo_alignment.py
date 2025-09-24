# routers/clo_alignment.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from core.db import SessionLocal
from models.uploads import UploadText, Upload
from models.course_clo import CourseCLO
from services.clo_extractor import extract_clos_and_assessments
from services.clo_parser import extract_clos_from_text
from services.text_processing import extract_text_from_path_or_bytes, parse_bytes
from services.alignment import align_clos_to_assessments
from schemas.clo_alignment import (
    CLOAlignmentResponse,
    CLOAlignmentRequest,
    CLOAlignmentAutoResponse,
    AssessmentItem,
)
import tempfile, zipfile, os, shutil

router = APIRouter(prefix="/align", tags=["CLO Alignment"])


# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------- AUTO ALIGN --------------------
@router.get("/{course_id}/auto", response_model=CLOAlignmentAutoResponse)
def auto_align_course(course_id: str, db: Session = Depends(get_db)):
    """Automatically align the latest CLOs with the latest uploaded course material."""
    # Step 1: Get latest CLOs
    latest_clo = (
        db.query(CourseCLO)
        .filter(CourseCLO.course_id == course_id)
        .order_by(CourseCLO.upload_date.desc())
        .first()
    )
    if not latest_clo or not latest_clo.clos_text:
        raise HTTPException(
            status_code=404, detail="No CLOs found for this course. Please upload a CLO file."
        )

    clos = [line.strip() for line in latest_clo.clos_text.splitlines() if line.strip()]
    if not clos:
        raise HTTPException(status_code=400, detail="No valid CLOs found in CLO upload.")

    # Step 2: Get latest upload text
    latest_upload = (
        db.query(Upload)
        .filter(Upload.course_id == course_id)
        .order_by(Upload.created_at.desc())
        .first()
    )
    if not latest_upload:
        raise HTTPException(status_code=404, detail="No course material uploads found.")

    text_obj = db.query(UploadText).filter(UploadText.upload_id == latest_upload.id).first()
    if not text_obj or not text_obj.text:
        raise HTTPException(status_code=404, detail="No extracted text found from course upload.")

    # Step 3: Extract assessments
    _, assessments = extract_clos_and_assessments(text_obj.text)
    if not assessments:
        raise HTTPException(status_code=400, detail="No assessments found in course upload.")

    return CLOAlignmentAutoResponse(
        clos=clos,
        assessments=assessments,
        alignment={},  # alignment can be populated in manual step
    )


# -------------------- MANUAL ALIGN --------------------
@router.post("/clo/{course_id}", response_model=CLOAlignmentResponse)
def manual_align_course(course_id: str, payload: CLOAlignmentRequest, db: Session = Depends(get_db)):
    """Manually align CLOs with provided assessments (frontend controlled)."""
    if not payload.clos or not payload.assessments:
        raise HTTPException(status_code=400, detail="CLOs and assessments are required")

    # Convert payload assessments into dicts for service
    assessments = [{"name": a.name} for a in payload.assessments]

    result = align_clos_to_assessments(payload.clos, assessments)

    return CLOAlignmentResponse(
        avg_top=result["avg_top"],
        flags=result["flags"],
        clos=result["clos"],
        assessments=[AssessmentItem(name=a["name"]) for a in result["assessments"]],
        alignment=result["alignment"],
        pairs=result["pairs"],  # Pydantic will coerce dicts → CLOPair objects
    )


# -------------------- ZIP UPLOAD ALIGN --------------------
@router.post("/zip/{course_id}", response_model=CLOAlignmentResponse)
async def align_from_zip(
    course_id: str,
    clos_file: UploadFile = File(...),
    materials_zip: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload both a CLO file (.docx/.pdf) and a ZIP of course materials.
    - Extracts CLOs and assessments
    - Saves CLOs into CourseCLO table
    - Saves materials into Upload + UploadText tables
    - Runs semantic alignment
    """

    # Step 1: Parse CLO file
    clo_bytes = await clos_file.read()
    clo_text = extract_text_from_path_or_bytes(clo_bytes, clos_file.filename)

    clos = extract_clos_from_text(clo_text) if clo_text else []
    if not clos:
        clos_fallback, _ = extract_clos_and_assessments(clo_text or "")
        clos = clos_fallback
    if not clos:
        raise HTTPException(status_code=400, detail="No CLOs found in provided CLO file")

    # Save CLOs to DB
    clo_entry = CourseCLO(course_id=course_id, clos_text="\n".join(clos))
    db.add(clo_entry)
    db.commit()

    # Step 2: Extract ZIP contents
    tmp_dir = tempfile.mkdtemp()
    try:
        zip_bytes = await materials_zip.read()
        zip_path = os.path.join(tmp_dir, "upload.zip")
        with open(zip_path, "wb") as fh:
            fh.write(zip_bytes)

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(tmp_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Uploaded materials file is not a valid ZIP archive")

        aggregated_text = ""
        for root, _, files in os.walk(tmp_dir):
            for fname in files:
                fpath = os.path.join(root, fname)
                if fpath == zip_path:
                    continue

                parsed = {}
                try:
                    # Try adapter-based parsing first
                    from services import adapter
                    parsed = adapter.parse_document(fpath)
                except Exception:
                    try:
                        with open(fpath, "rb") as fh:
                            parsed = parse_bytes(fh.read(), fname)
                    except Exception:
                        parsed = {}

                text = (parsed.get("text") or "").strip()
                if text:
                    aggregated_text += text + "\n\n"

        if not aggregated_text.strip():
            raise HTTPException(status_code=400, detail="No text extracted from uploaded ZIP contents")

        # Save Upload + UploadText to DB
        upload_entry = Upload(course_id=course_id, filename=materials_zip.filename)
        db.add(upload_entry)
        db.commit()

        text_entry = UploadText(upload_id=upload_entry.id, text=aggregated_text)
        db.add(text_entry)
        db.commit()

        # Step 3: Extract assessments
        _, assessments = extract_clos_and_assessments(aggregated_text)
        if not assessments:
            raise HTTPException(status_code=400, detail="No assessments were detected in the uploaded materials")

        assessment_items = [{"name": a} for a in assessments]

        # Step 4: Run alignment
        result = align_clos_to_assessments(clos, assessment_items)

        return CLOAlignmentResponse(
            avg_top=result["avg_top"],
            flags=result["flags"],
            clos=result["clos"],
            assessments=[AssessmentItem(name=a["name"]) for a in result["assessments"]],
            alignment=result["alignment"],
            pairs=result["pairs"],
        )

    finally:
        try:
            shutil.rmtree(tmp_dir)
        except Exception:
            pass
