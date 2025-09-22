import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# ----------------------------
# 1. Load environment variables
# ----------------------------
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL not set in .env")

# ----------------------------
# 2. Load processed CSV
# ----------------------------
csv_file = "../public/feedback/cleaned_student_feedback.csv"
df = pd.read_csv(csv_file)

print(f"📂 Loaded {len(df)} rows from {csv_file}")

# ----------------------------
# 3. Connect to AWS PostgreSQL
# ----------------------------
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# ----------------------------
# 4. Create table if not exists
# ----------------------------
create_table_sql = """
CREATE TABLE IF NOT EXISTS student_feedback (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50),
    name TEXT,
    form_type TEXT,
    mcq_number INT,
    answer TEXT,
    instructor_name TEXT,
    course_name TEXT,
    comments TEXT,
    sentiment VARCHAR(20),
    emotion VARCHAR(50),
    topic INT
);
"""

with engine.begin() as conn:
    conn.execute(text(create_table_sql))

print("✅ Table student_feedback ready.")

# ----------------------------
# 5. Insert DataFrame into PostgreSQL
# ----------------------------
df.to_sql("student_feedback", engine, if_exists="append", index=False)

print("🎉 Migration complete! Data inserted into AWS PostgreSQL.")
