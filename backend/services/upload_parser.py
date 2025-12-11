"""Module for parsing uploaded document files (PDF, DOCX)."""
import io
import os
from typing import Dict, Any, Optional, Tuple, List

import fitz  # PyMuPDF
from docx import Document as DocxDocument

def _parse_pdf(path: str) -> Tuple[Optional[str], Optional[int]]:
    with open(path, "rb") as fh:
        data = fh.read()
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = doc.page_count
        out = []
        for i in range(pages):
            out.append(doc.load_page(i).get_text("text"))
        txt = "\n".join(out).strip()
        return (txt if txt else None), pages

def _parse_docx(path: str) -> Tuple[Optional[str], Optional[int]]:
    with open(path, "rb") as fh:
        bio = io.BytesIO(fh.read())
    doc = DocxDocument(bio)
    txt = "\n".join([p.text for p in doc.paragraphs]).strip()
    return (txt if txt else None), None

def parse_document(path: str) -> Dict[str, Any]:
    ext = os.path.splitext(path)[1].lower()
    out: Dict[str, Any] = {"ext": ext.lstrip(".")}
    try:
        if ext == ".pdf":
            text, pages = _parse_pdf(path)
            out["text"] = text
            out["pages"] = pages
        elif ext == ".docx":
            text, _ = _parse_docx(path)
            out["text"] = text
        else:
            # not handled here; router may still store it
            pass
    except Exception as e:
        out["error"] = str(e)
    return out
