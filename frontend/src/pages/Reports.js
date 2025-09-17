import React, { useEffect, useState } from "react";
import api from "../api";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import "../App.css";

function Reports() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");

  // optional scratch pads
  const [parsed, setParsed] = useState("");
  const [comp, setComp] = useState("");
  const [align, setAlign] = useState("");
  const [feed, setFeed] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.get("/courses").then(res => setCourses(res.data)); }, []);

  const downloadReport = async () => {
    setError("");
    try {
      const payload = {
        parsed: parsed ? JSON.parse(parsed) : {},
        completeness: comp ? JSON.parse(comp) : {},
        alignment: align ? JSON.parse(align) : {},
        feedback: feed ? JSON.parse(feed) : {},
      };
      const res = await api.post("/report", payload, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `${selectedCourse || "qa"}_report.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.detail || "Report generation failed");
    }
  };

  const Area = ({ label, value, onChange }) => (
    <div>
      <div className="page-subtitle" style={{ marginBottom: 6 }}>{label}</div>
      <textarea className="form-input" style={{ height: 120 }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">QA Reports</h1>
        <p className="page-subtitle">Generate comprehensive QA reports as PDF</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Compose Report</h2>
        </div>
        <div className="card-content">
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
              style={{ maxWidth: 400 }}
            >
              <option value="">Choose a course (optional)...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name}
                </option>
              ))}
            </select>

            <button onClick={downloadReport} className="btn btn-success">
              <ArrowDownTrayIcon className="w-4 h-4" style={{ marginRight: 8 }} />
              Download PDF
            </button>
          </div>

          {error && <p style={{ color: "#dc2626" }}>{error}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Area label="Parsed JSON" value={parsed} onChange={setParsed} />
            <Area label="Completeness JSON" value={comp} onChange={setComp} />
            <Area label="Alignment JSON" value={align} onChange={setAlign} />
            <Area label="Feedback JSON" value={feed} onChange={setFeed} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
