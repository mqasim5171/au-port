// src/components/CLOAlignment.js
import React, { useState, useEffect } from "react";
import api from "../api";
import "../App.css";

const CLOAlignment = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [clos, setClos] = useState([]);
  const [assessmentsText, setAssessmentsText] = useState("Quiz 1\nAssignment 1\nMidterm\nProject\nFinal");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/courses").then(res => setCourses(res.data)).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    setResult(null); setErr("");
    if (!selectedCourse) { setClos([]); return; }
    api.get(`/courses/${selectedCourse}`)
      .then(res => setClos(res.data.clos || []))
      .catch(() => setClos([]));
  }, [selectedCourse]);

  const analyze = async () => {
    setErr(""); setResult(null);
    const assessments = (assessmentsText || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name }));
    try {
      const payload = { clos, assessments };
      const { data } = await api.post("/align/clo", payload);
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Unable to run alignment");
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">CLO Alignment</h1>
        <p className="page-subtitle">Estimate CLO↔Assessment alignment using semantic similarity</p>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="card-title">Select Course</h2></div>
        <div className="card-content">
          <select
            className="form-input"
            style={{ marginBottom: 16 }}
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">Choose a course...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
            ))}
          </select>

          {!!clos.length && (
            <>
              <div style={{ marginBottom: 12 }}>
                <h3 className="card-title" style={{ fontSize: 16, marginBottom: 8 }}>Assessments (one per line)</h3>
                <textarea
                  className="form-input"
                  style={{ height: 120 }}
                  value={assessmentsText}
                  onChange={(e) => setAssessmentsText(e.target.value)}
                />
              </div>
              <button className="btn btn-success" onClick={analyze}>Analyze Alignment</button>
            </>
          )}

          {err && <p style={{ color: "#dc2626", marginTop: 12 }}>{err}</p>}
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h2 className="card-title">Results</h2></div>
          <div className="card-content">
            <div style={{ marginBottom: 8 }}>Average top similarity: <b>{result.avg_top}</b></div>
            {result.flags?.length > 0 && (
              <ul className="status-incomplete" style={{ padding: 12, borderRadius: 8 }}>
                {result.flags.map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
            )}
            <div style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr><th>CLO</th><th>Best Matching Assessment</th><th>Similarity</th></tr>
                </thead>
                <tbody>
                  {result.pairs.map((p, i) => (
                    <tr key={i}>
                      <td>{p.clo}</td>
                      <td>{p.assessment}</td>
                      <td>
                        <span className="status-badge" style={{ background: `rgba(16,185,129,${p.similarity})`, color: p.similarity>0.5?"#fff":"#111" }}>
                          {p.similarity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CLOAlignment;
