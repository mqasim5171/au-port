import React, { useEffect, useState } from "react";
import api from "../api";
import "../App.css";

let Charts = null;
try {
  Charts = require("recharts");
} catch {}

function StudentFeedback() {
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState("");
  const [course, setCourse] = useState("");
  const [instructor, setInstructor] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/feedback/batches")
      .then(res => {
        setBatches(res.data || []);
        if ((res.data || []).length) setBatch(res.data[0]);
      })
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    if (!batch) return;
    setErr("");
    api.get("/feedback", {
      params: {
        batch,
        course: course || undefined,
        instructor: instructor || undefined
      }
    })
      .then(res => setData(res.data))
      .catch(e => setErr(e?.response?.data?.detail || "Failed to load feedback"));
  }, [batch, course, instructor]);

  const pieData = data ? [
    { name: "Positive", value: data?.sentiment?.pos || 0 },
    { name: "Neutral",  value: data?.sentiment?.neu || 0 },
    { name: "Negative", value: data?.sentiment?.neg || 0 },
  ] : [];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Student Feedback</h1>
        <p className="page-subtitle">Batch-wise sentiment and themes</p>
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
        </div>
        <div className="card-content" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Batch filter */}
          <div>
            <label className="form-label">Batch</label>
            <select
              className="form-input"
              value={batch || ""}
              onChange={(e) => setBatch(parseInt(e.target.value))}
              style={{ minWidth: 160 }}
            >
              <option value="">Choose a batch...</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Course filter */}
          <div>
            <label className="form-label">Course</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter course code/name"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>

          {/* Instructor filter */}
          <div>
            <label className="form-label">Instructor</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter instructor name"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>
        </div>
        {err && <p style={{ color: "#dc2626", marginTop: 8 }}>{err}</p>}
      </div>

      {/* Feedback Results */}
      {data && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              Batch {batch} — Overview
              {course && <> | Course: <b>{course}</b></>}
              {instructor && <> | Instructor: <b>{instructor}</b></>}
            </h2>
          </div>
          <div className="card-content">
            {Charts ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <h3 style={{ marginBottom: 8 }}>Sentiment split</h3>
                  <Charts.PieChart width={360} height={260}>
                    <Charts.Pie dataKey="value" data={pieData} cx={180} cy={120} outerRadius={90}>
                      {pieData.map((_, i) => <Charts.Cell key={i} />)}
                    </Charts.Pie>
                    <Charts.Tooltip /><Charts.Legend />
                  </Charts.PieChart>
                </div>
                <div className="overflow-auto">
                  <h3 style={{ marginBottom: 8 }}>Per-course breakdown</h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Course</th><th>Positive</th><th>Neutral</th><th>Negative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.courses || []).map((c, i) => (
                        <tr key={i}>
                          <td>{c.course}</td>
                          <td>{c.pos}</td>
                          <td>{c.neu}</td>
                          <td>{c.neg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <span className="sentiment-positive" style={{ marginRight: 8 }}>Positive: {data?.sentiment?.pos || 0}</span>
                  <span className="sentiment-neutral" style={{ marginRight: 8 }}>Neutral: {data?.sentiment?.neu || 0}</span>
                  <span className="sentiment-negative">Negative: {data?.sentiment?.neg || 0}</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Course</th><th>Positive</th><th>Neutral</th><th>Negative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.courses || []).map((c, i) => (
                      <tr key={i}>
                        <td>{c.course}</td>
                        <td>{c.pos}</td>
                        <td>{c.neu}</td>
                        <td>{c.neg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "12px 0" }}>Top themes</h3>
              <div className="flex" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(data.themes || []).map((t, i) => (
                  <span key={i} className="btn-secondary" style={{ padding: "6px 10px" }}>#{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentFeedback;
