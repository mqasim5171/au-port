import React, { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function Assessments() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState("quiz");
  const [title, setTitle] = useState("");
  const [maxMarks, setMaxMarks] = useState(10);

  // ✅ NEW required fields
  const [weightage, setWeightage] = useState(10);

  // ✅ NEW required field: date (YYYY-MM-DD). Default today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);

  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // ✅ keep endpoint consistent with your other calls
        const res = await api.get("/courses");
        const list = res.data || [];
        setCourses(list);
        if (list.length) setCourseId(list[0].id);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Failed to load courses");
      }
    })();
  }, []);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      setErr("");
      try {
        const res = await api.get(`/courses/${courseId}/assessments`);
        setItems(res.data || []);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Failed to load assessments");
      }
    })();
  }, [courseId]);

  const create = async () => {
    setErr("");
    setBusy(true);

    try {
      const payload = {
        type,
        title,
        max_marks: Number(maxMarks),

        // ✅ required for your DB
        weightage: Number(weightage),

        // ✅ must be "YYYY-MM-DD"
        date,
      };

      const res = await api.post(`/courses/${courseId}/assessments`, payload);

      const created = res.data;
      setTitle("");
      setItems([created, ...items]);
    } catch (e) {
      // If FastAPI schema is fixed, missing fields will show 422 with detail array
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErr(detail.map((d) => d?.msg || "Validation error").join(", "));
      } else {
        setErr(detail || "Create failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const canCreate =
    !!courseId &&
    !!title &&
    Number.isFinite(Number(maxMarks)) &&
    Number.isFinite(Number(weightage)) &&
    !!date;

  return (
    <div className="page">
      <div className="card">
        <h2>Assessments</h2>
        {err && <div className="alert alert-danger">{err}</div>}

        <div className="row">
          <div className="field">
            <label>Course</label>
            <select
              className="select"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10, gap: 12, flexWrap: "wrap" }}>
          <div className="field">
            <label>Type</label>
            <select
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="quiz">Quiz</option>
              <option value="assignment">Assignment</option>
              <option value="mid">Mid</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div className="field">
            <label>Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz 1"
            />
          </div>

          <div className="field">
            <label>Max Marks</label>
            <input
              className="input"
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
              min="0"
            />
          </div>

          {/* ✅ NEW */}
          <div className="field">
            <label>Weightage</label>
            <input
              className="input"
              type="number"
              value={weightage}
              onChange={(e) => setWeightage(e.target.value)}
              min="0"
            />
          </div>

          {/* ✅ NEW */}
          <div className="field">
            <label>Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button className="btn-primary" onClick={create} disabled={busy || !canCreate}>
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>List</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Marks</th>
              <th>Weightage</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.type}</td>
                <td>{a.title}</td>
                <td>{a.max_marks}</td>
                <td>{a.weightage ?? "-"}</td>
                <td>
                  {a.date
                    ? String(a.date).slice(0, 10) // handles "2025-12-21" or ISO datetime
                    : "-"}
                </td>
                <td>
                  <button className="btn" onClick={() => nav(`/assessments/${a.id}`)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No assessments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
