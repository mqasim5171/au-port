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
      .then((res) => {
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
        instructor: instructor || undefined,
      },
    })
      .then((res) => setData(res.data))
      .catch((e) =>
        setErr(e?.response?.data?.detail || "Failed to load feedback")
      );
  }, [batch, course, instructor]);

  const pieData = data
    ? [
        { name: "Positive", value: data?.sentiment?.pos || 0, fill: "#10b981" },
        { name: "Neutral", value: data?.sentiment?.neu || 0, fill: "#facc15" },
        { name: "Negative", value: data?.sentiment?.neg || 0, fill: "#ef4444" },
      ]
    : [];

  const lineData = data?.trend || [
    { semester: "Semester 1", Difficulty: 30, Pace: 50, Clarity: 20 },
    { semester: "Semester 2", Difficulty: 20, Pace: 40, Clarity: 35 },
    { semester: "Semester 3", Difficulty: 15, Pace: 30, Clarity: 50 },
    { semester: "Semester 4", Difficulty: 10, Pace: 20, Clarity: 65 },
  ];

  return (
    <div className="fade-in">
      {/* 🔹 Page Header */}
      <div className="page-header">
        <h1 className="page-title">Student Feedback Analyzer</h1>
      </div>

      {/* 🔹 Filter Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: "16px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        {/* Batch Filter */}
        <div>
          <label className="form-label">Batch:</label>
          <select
            className="form-input"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          >
            {batches.map((b, i) => (
              <option key={i} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Course Filter */}
        <div>
          <label className="form-label">Course:</label>
          <select
            className="form-input"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">All</option>
            {(data?.courses || []).map((c, i) => (
              <option key={i} value={c.course}>
                {c.course}
              </option>
            ))}
          </select>
        </div>

        {/* Instructor Filter */}
        <div>
          <label className="form-label">Instructor:</label>
          <select
            className="form-input"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          >
            <option value="">All</option>
            {(data?.instructors || []).map((inst, i) => (
              <option key={i} value={inst}>
                {inst}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <p style={{ color: "#dc2626", marginBottom: 16 }}>{err}</p>}

      {/* 🔹 Two-Column Layout */}
      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {/* Sentiment Analysis */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Sentiment Analysis</h2>
            </div>
            <div
              className="card-content"
              style={{ display: "flex", justifyContent: "center" }}
            >
              {Charts && (
                <Charts.PieChart width={280} height={280}>
                  <Charts.Pie
                    dataKey="value"
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  />
                  <Charts.Tooltip />
                  <Charts.Legend />
                </Charts.PieChart>
              )}
            </div>
          </div>

          {/* Feedback Highlights */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Feedback Highlights</h2>
            </div>
            <div className="card-content">
              {data?.highlights ? (
                <>
                  {data.highlights.negative && (
                    <div style={{ marginBottom: 16 }}>
                      <span className="sentiment-negative">Negative</span>
                      <p>{data.highlights.negative}</p>
                    </div>
                  )}
                  {data.highlights.neutral && (
                    <div style={{ marginBottom: 16 }}>
                      <span className="sentiment-neutral">Neutral</span>
                      <p>{data.highlights.neutral}</p>
                    </div>
                  )}
                  {data.highlights.positive && (
                    <div>
                      <span className="sentiment-positive">Positive</span>
                      <p>{data.highlights.positive}</p>
                    </div>
                  )}
                </>
              ) : (
                <p>No highlights available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Trend Chart */}
      {Charts && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h2 className="card-title">Trend Analysis</h2>
          </div>
          <div className="card-content">
            <Charts.LineChart width={600} height={250} data={lineData}>
              <Charts.CartesianGrid strokeDasharray="3 3" />
              <Charts.XAxis dataKey="semester" />
              <Charts.YAxis />
              <Charts.Tooltip />
              <Charts.Legend />
              <Charts.Line
                type="monotone"
                dataKey="Difficulty"
                stroke="#f59e0b"
              />
              <Charts.Line type="monotone" dataKey="Pace" stroke="#6366f1" />
              <Charts.Line type="monotone" dataKey="Clarity" stroke="#0ea5e9" />
            </Charts.LineChart>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentFeedback;
