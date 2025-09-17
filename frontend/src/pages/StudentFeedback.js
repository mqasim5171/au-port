import React, { useEffect, useState } from "react";
import api from "../api";
import "../App.css";

let Charts = null;
try {
  // optional; if recharts is not installed, the component still renders tables
  // npm i recharts (if you want charts)
  Charts = require("recharts");
} catch {}

function StudentFeedback() {
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState("");
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
    api.get("/feedback", { params: { batch } })
       .then(res => setData(res.data))
       .catch(e => setErr(e?.response?.data?.detail || "Failed to load feedback"));
  }, [batch]);

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

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Select Batch</h2>
        </div>
        <div className="card-content">
          <select
            className="form-input"
            value={batch || ""}
            onChange={(e) => setBatch(parseInt(e.target.value))}
            style={{ maxWidth: 260 }}
          >
            <option value="">Choose a batch...</option>
            {batches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {err && <p style={{ color: "#dc2626", marginTop: 8 }}>{err}</p>}
        </div>
      </div>

      {data && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Batch {batch} — Overview</h2>
          </div>
          <div className="card-content">
            {/* Charts if recharts available */}
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
