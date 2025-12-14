# backend/routers/grading_audit_router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import statistics
import json

from core.db import get_db
from models.assessment import Assessment
from models.student_submission import StudentSubmission
from models.grading_audit import GradingAudit

router = APIRouter(prefix="/api", tags=["Grading Audit"])


@router.post("/assessments/{assessment_id}/run-grading-audit")
def run_grading_audit(assessment_id: str, db: Session = Depends(get_db)):
    """
    Compute grading audit for a single assessment:
    - Marks distribution (mean, median, std)
    - Outliers (±2 * std)
    - CLO-wise average achievement (simple %)
    """
    assessment = db.query(Assessment).get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    submissions = (
        db.query(StudentSubmission)
        .filter(
            StudentSubmission.assessment_id == assessment_id,
            StudentSubmission.obtained_marks.isnot(None),
        )
        .all()
    )

    marks = [s.obtained_marks for s in submissions if s.obtained_marks is not None]

    if not marks:
        raise HTTPException(status_code=400, detail="No marks available for audit")

    mean_val = statistics.mean(marks)
    median_val = statistics.median(marks)
    std_val = statistics.pstdev(marks) if len(marks) > 1 else 0.0

    lower = mean_val - 2 * std_val
    upper = mean_val + 2 * std_val
    outliers = [m for m in marks if m < lower or m > upper]

    # Simple CLO avg: same percentage applied to all linked CLOs
    clo_avgs = {}
    if assessment.clos:
        perc_list = [m / assessment.total_marks for m in marks if assessment.total_marks]
        avg_percentage = statistics.mean(perc_list) if perc_list else 0.0
        for clo in assessment.clos:
            clo_avgs[str(clo.id)] = avg_percentage

    def store_metric(metric: str, value_obj):
        audit = GradingAudit(
            assessment_id=assessment_id,
            metric=metric,
            value=json.dumps(value_obj),
        )
        db.add(audit)

    store_metric(
        "distribution",
        {
            "marks": marks,
            "mean": mean_val,
            "median": median_val,
            "std": std_val,
        },
    )
    store_metric(
        "outliers",
        {
            "count": len(outliers),
            "values": outliers,
            "lower_bound": lower,
            "upper_bound": upper,
        },
    )
    store_metric("clo_avg", clo_avgs)

    db.commit()

    return {"status": "ok"}


@router.get("/assessments/{assessment_id}/grading-audit")
def get_grading_audit(assessment_id: str, db: Session = Depends(get_db)):
    """
    Return all grading audit entries for an assessment.
    """
    rows = (
        db.query(GradingAudit)
        .filter_by(assessment_id=assessment_id)
        .order_by(GradingAudit.created_at.desc())
        .all()
    )

    result = []
    for r in rows:
        result.append(
            {
                "id": r.id,
                "metric": r.metric,
                "value": json.loads(r.value),
                "notes": r.notes,
                "created_at": r.created_at,
            }
        )
    return result
