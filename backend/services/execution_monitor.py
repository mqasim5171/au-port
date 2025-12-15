# backend/services/execution_monitor.py

from collections import defaultdict

def compute_execution_status(course_guide_weeks, lecture_uploads):
    """
    course_guide_weeks: int (e.g. 16)
    lecture_uploads: list of Upload objects (category='lecture')
    """

    delivered_weeks = set()

    for upload in lecture_uploads:
        if upload.folder_key:
            # expects lectures/week-01, week-02 ...
            try:
                week = int(upload.folder_key.split("week-")[1])
                delivered_weeks.add(week)
            except Exception:
                continue

    missing_weeks = [
        week for week in range(1, course_guide_weeks + 1)
        if week not in delivered_weeks
    ]

    return {
        "total_weeks": course_guide_weeks,
        "delivered_weeks": sorted(list(delivered_weeks)),
        "missing_weeks": missing_weeks,
        "is_on_track": len(missing_weeks) == 0
    }
