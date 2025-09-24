# services/clo_extractor.py
import re

def extract_clos_and_assessments(text: str):
    """Naively extract CLOs and assessments from course text."""
    clos = []
    assessments = []

    # Example: CLOs lines start with "CLO"
    for line in text.splitlines():
        if re.match(r"(?i)CLO\s*\d+", line):
            clos.append(line.strip())

    # Assessments: look for keywords
    for match in re.finditer(r"(?i)(quiz|assignment|midterm|final|project)", text):
        assessments.append(match.group(0).capitalize())

    return list(set(clos)), list(set(assessments))
