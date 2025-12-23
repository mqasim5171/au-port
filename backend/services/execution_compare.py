from collections import Counter
from typing import List, Tuple, Dict, Any
import re

from services.semantic_compare import semantic_coverage

# (KEEP your STOPWORDS, helpers exactly as-is)

def compare_week_hybrid(
    plan_text: str,
    delivered_text: str,
    lexical_weight: float = 0.35,
    semantic_weight: float = 0.65,
    semantic_threshold: float = 0.78,
) -> Dict[str, Any]:

    lex_cov, lex_missing, lex_terms = _lexical_compare(plan_text, delivered_text)

    sem = semantic_coverage(
        plan_text=plan_text,
        delivered_text=delivered_text,
        threshold=semantic_threshold,
    )

    sem_cov = float(sem.get("coverage") or 0.0)
    final = (lexical_weight * lex_cov) + (semantic_weight * sem_cov)

    return {
        "coverage_final": round(final, 4),
        "coverage_lexical": round(lex_cov, 4),
        "coverage_semantic": round(sem_cov, 4),
        "missing_terms": sem.get("missing") or lex_missing,
        "matched_terms": sem.get("matched") or [],
        "plan_terms": sem.get("audit", {}).get("plan_phrases") or lex_terms,
        "audit": {
            "lexical_weight": lexical_weight,
            "semantic_weight": semantic_weight,
            "semantic_threshold": semantic_threshold,
            "semantic": sem.get("audit"),
        },
    }

def compare_week(plan_text: str, delivered_text: str):
    out = compare_week_hybrid(plan_text, delivered_text)
    return (
        out["coverage_final"],
        out["missing_terms"],
        out["plan_terms"],
        out["audit"],
    )
