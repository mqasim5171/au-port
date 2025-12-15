# backend/services/folder_structure.py

REQUIRED_STRUCTURE = {
    "course_guide": ["course_guide"],
    "lectures": [f"lectures/week-{i:02d}" for i in range(1, 17)],
    "assessments": [
        "assessments/quiz",
        "assessments/assignment",
        "assessments/mid",
        "assessments/final"
    ]
}

def validate_structure(uploads):
    """
    uploads: list of Upload ORM objects
    """
    uploaded_keys = {u.folder_key for u in uploads if u.folder_key}

    missing = []

    for group, required_keys in REQUIRED_STRUCTURE.items():
        for key in required_keys:
            if key not in uploaded_keys:
                missing.append(key)

    return {
        "is_complete": len(missing) == 0,
        "missing_items": missing
    }
