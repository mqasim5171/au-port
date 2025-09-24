import json
from typing import List, Dict
from sqlalchemy.orm import Session
from models.quality import QualityScore
from datetime import datetime
from sentence_transformers import SentenceTransformer, util

# Load model globally
model = SentenceTransformer("all-MiniLM-L6-v2")

def compute_quality_scores(course_id: str, clos: List[str], assessments: List[str], feedback: List[str], db: Session) -> Dict:
    """
    Compute completeness, alignment, feedback, and overall quality scores for a course.
    Returns a dict with all scores and suggestions.
    """

    # ---------- Completeness ----------
    completeness = 0.0
    if clos:
        matched_clos = 0
        for clo in clos:
            if any(a.lower() in clo.lower() for a in assessments):
                matched_clos += 1
        completeness = matched_clos / len(clos)

    # ---------- Alignment ----------
    alignment = 0.0
    if clos and assessments:
        clo_embeddings = model.encode(clos, convert_to_tensor=True)
        assessment_embeddings = model.encode(assessments, convert_to_tensor=True)
        sim_matrix = util.cos_sim(clo_embeddings, assessment_embeddings)
        best_scores = [float(sim_matrix[i].max()) for i in range(len(clos))]
        alignment = sum(best_scores) / len(best_scores)

    # ---------- Feedback ----------
    feedback_score = 0.5
    if feedback:
        positives = sum(1 for f in feedback if "good" in f.lower() or "excellent" in f.lower())
        negatives = sum(1 for f in feedback if "bad" in f.lower() or "poor" in f.lower())
        total = len(feedback)
        feedback_score = (positives - negatives) / total
        feedback_score = max(0.0, min(1.0, (feedback_score + 1) / 2))

    # ---------- Overall ----------
    overall = round(100 * (0.4 * completeness + 0.4 * alignment + 0.2 * feedback_score), 2)

    # ---------- Suggestions ----------
    suggestions = []
    if completeness < 0.8:
        suggestions.append("Add missing assessments for some CLOs.")
    if alignment < 0.6:
        suggestions.append("Improve wording of CLOs or assessments for better alignment.")
    if feedback_score < 0.5:
        suggestions.append("Address negative feedback and revise content.")
    if not suggestions:
        suggestions.append("Course quality is strong overall.")

    return {
        "overall_score": overall,
        "completeness_score": round(completeness * 100, 2),
        "alignment_score": round(alignment * 100, 2),
        "feedback_score": round(feedback_score * 100, 2),
        "suggestions": suggestions
    }
