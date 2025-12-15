# models/clo_alignment.py
from sentence_transformers import SentenceTransformer, util
from schemas.clo_alignment import CLOAlignmentRequest, CLOAlignmentResponse, CLOPair
import numpy as np
from core.db import Base

# Load embeddings model once
_model = SentenceTransformer("all-MiniLM-L6-v2")

def run_clo_alignment(payload: CLOAlignmentRequest) -> CLOAlignmentResponse:
    # Your existing logic to generate alignment results...

    avg_top = 0.13  # example average similarity
    flags = []      # any flags if applicable

    # Build pairs from your matching logic, for example:
    pairs = []
    for clo in payload.clos:
        # Find best matching assessment and similarity for each CLO
        best_assessment = "Example Assessment"  # replace with your logic
        similarity = 0.7                        # replace with your similarity score
        pairs.append(CLOPair(clo=clo, assessment=best_assessment, similarity=similarity))

    # Build the alignment dictionary to match the schema:
    alignment = {
        p.clo: {
            "best_assessment": p.assessment,
            "similarity": p.similarity
        } for p in pairs
    }

    # Return with all required fields
    return CLOAlignmentResponse(
        avg_top=avg_top,
        flags=flags,
        pairs=pairs,
        clos=payload.clos,
        assessments=[a["name"] if isinstance(a, dict) else a for a in payload.assessments],
        alignment=alignment
    )
