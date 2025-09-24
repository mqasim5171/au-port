// src/components/CLOAlignment.js
import React, { useState, useEffect } from "react";
import api from "../api";
import "../App.css";

const CLOAlignment = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [clos, setClos] = useState([]);
  const [assessmentsText, setAssessmentsText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  // load courses
  useEffect(() => {
    api.get("/courses")
      .then(res => setCourses(res.data))
      .catch(() => setCourses([]));
  }, []);

  // when course changes, fetch parsed CLOs + assessments
  useEffect(() => {
    setResult(null);
    setErr("");

    if (!selectedCourse) {
      setClos([]);
      setAssessmentsText("");
      return;
    }

    api.get(`/align/${selectedCourse}/auto`)
      .then(res => {
        setClos(res.data.clos || []);
        setAssessmentsText((res.data.assessments || []).join("\n"));
      })
      .catch(err => {
        console.error(err);
        setClos([]);
        setAssessmentsText("");
        setErr("Could not fetch CLOs/assessments for this course. Make sure CLO file is uploaded.");
      });
  }, [selectedCourse]);

  const analyze = async () => {
    setErr("");
    setResult(null);

    const assessments = (assessmentsText || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name }));

    try {
      const payload = { clos, assessments };
      const { data } = await api.post(`/align/clo/${selectedCourse}`, payload);
      setResult(data);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.detail || "Unable to run alignment");
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">CLO Alignment</h1>
        <p className="page-subtitle">
          Estimate CLO ↔ Assessment alignment using semantic similarity
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Select Course</h2>
        </div>
        <div className="card-content">
          <select
            className="form-input"
            style={{ marginBottom: 16 }}
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">Choose a course...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.course_code} - {c.course_name}
              </option>
            ))}
          </select>

          {!!clos.length && (
            <>
              <div style={{ marginBottom: 12 }}>
                <h3
                  className="card-title"
                  style={{ fontSize: 16, marginBottom: 8 }}
                >
                  Assessments (auto-parsed, editable)
                </h3>
                <textarea
                  className="form-input"
                  style={{ height: 120 }}
                  value={assessmentsText}
                  onChange={(e) => setAssessmentsText(e.target.value)}
                />
              </div>

              <button className="btn-primary" onClick={analyze}>
                Analyze Alignment
              </button>
            </>
          )}

          {err && (
            <p style={{ color: "red", marginTop: 12 }}>
              {err}
            </p>
          )}
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h2 className="card-title">Results</h2>
          </div>
          <div className="card-content">
            {result.pairs.map((p, i) => (
              <div
                key={i}
                style={{
                  borderBottom: "1px solid #e5e7eb",
                  padding: "12px 0",
                }}
              >
                <p><strong>CLO:</strong> {p.clo}</p>
                <p><strong>Best Match:</strong> {p.assessment}</p>
                <p><strong>Similarity:</strong> {(p.similarity * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CLOAlignment;
