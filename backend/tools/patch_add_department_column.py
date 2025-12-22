import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv()  # reads backend/.env if you run from backend folder

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found. Run from backend folder.")

    engine = create_engine(db_url, pool_pre_ping=True)

    with engine.begin() as conn:
        conn.execute(text("""
            ALTER TABLE public.student_feedback
            ADD COLUMN IF NOT EXISTS department VARCHAR(20);
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_student_feedback_department
            ON public.student_feedback (department);
        """))

    print("✅ department column added (or already existed).")

if __name__ == "__main__":
    main()
