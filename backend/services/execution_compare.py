import re
from collections import Counter
from typing import List, Tuple

STOPWORDS = {
    "the","a","an","and","or","to","of","in","on","for","with","at","by","from","as",
    "is","are","was","were","be","been","it","this","that","these","those","we","you",
    "your","our","they","their","i","he","she","them","not","can","will","may","also",
    "into","about","over","under","between","within","during","after","before",
    # extra “noise” words common in course guides
    "department","faculty","university","islamabad","air","course","guide","schedule","week",
    "chapter","topics","covered","plan","lecture","lectures"
}

ALLOWED_2LETTER = {"ai","ml","dl","rl","nn","kr","nlp","cv","ga"}

PLACEHOLDER_HINTS = {
    "update later",
    "topics (auto)",
    "week 1 topics",
    "week topics",
}

def _normalize(text: str) -> str:
    text = (text or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def _remove_placeholders(text: str) -> str:
    t = _normalize(text)
    # remove placeholder phrases but DO NOT return 0% just because they exist
    for h in PLACEHOLDER_HINTS:
        t = t.replace(h, " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _tokens(text: str) -> List[str]:
    text = _remove_placeholders(text)

    words = re.findall(r"[a-z0-9_]{2,}", text)

    out = []
    for w in words:
        if w in STOPWORDS:
            continue
        if len(w) == 2 and w not in ALLOWED_2LETTER:
            continue
        if w.isdigit():
            continue

        # very light stemming
        if len(w) >= 5:
            w = re.sub(r"(ing|ed|es|s)$", "", w)

        if w and w not in STOPWORDS:
            out.append(w)

    return out

def _bigrams(tokens: List[str]) -> List[str]:
    return [f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens) - 1)]

def compare_week(plan_text: str, delivered_text: str, top_n_terms: int = 25) -> Tuple[float, List[str], List[str]]:
    """
    Returns:
      coverage_score: 0..1
      missing_terms: list[str]
      plan_terms: list[str]
    """
    plan_text_n = _remove_placeholders(plan_text)
    delivered_text_n = _normalize(delivered_text)

    plan_tokens = _tokens(plan_text_n)
    delivered_tokens = _tokens(delivered_text_n)

    if not plan_tokens:
        return 0.0, [], []

    delivered_set = set(delivered_tokens)

    # add bigrams to capture phrases like "artificial intelligence"
    plan_phrases = plan_tokens + _bigrams(plan_tokens)
    delivered_phrases = delivered_set.union(set(_bigrams(delivered_tokens)))

    counts = Counter(plan_phrases)
    plan_terms = [w for w, _ in counts.most_common(top_n_terms) if len(w) >= 2]

    if not plan_terms:
        return 0.0, [], []

    missing = []
    for t in plan_terms:
        if t in delivered_phrases:
            continue
        # substring fallback (helps OCR spacing issues)
        if " " in t and t in delivered_text_n:
            continue
        missing.append(t)

    covered = len(plan_terms) - len(missing)
    coverage = covered / max(1, len(plan_terms))
    return coverage, missing, plan_terms
