import React, { useEffect, useState } from "react";
import api from "../api";
import { CloudArrowUpIcon, DocumentIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import "../App.css";

function CourseFolder() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // quick parse
  const [parseBusy, setParseBusy] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [comp, setComp] = useState(null);
  const [parseErr, setParseErr] = useState("");

  useEffect(() => { api.get("/courses").then(res => setCourses(res.data)); }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    api.get(`/courses/${selectedCourse}/uploads`)
      .then(res => setUploads(res.data))
      .finally(() => setLoading(false));
  }, [selectedCourse]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCourse) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", "course_folder");
    try {
      await api.post(`/courses/${selectedCourse}/upload`, formData);
      api.get(`/courses/${selectedCourse}/uploads`).then(res => setUploads(res.data));
      alert("File uploaded successfully!");
    } catch {
      alert("Error uploading file.");
    } finally {
      setUploadLoading(false);
    }
  };

  const quickParse = async (file) => {
    setParseErr(""); setParseBusy(true); setParsed(null); setComp(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data: p } = await api.post("/parse", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setParsed(p);
      const { data: c } = await api.post("/check/completeness", p);
      setComp(c);
    } catch (e) {
      setParseErr(e?.response?.data?.detail || "Parse failed");
    } finally {
      setParseBusy(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "complete": return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "incomplete": return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case "invalid": return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default: return <ClockIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const selectedCourseData = courses.find(c => c.id === selectedCourse);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Folder Management</h1>
        <p className="page-subtitle">Upload and validate course folders for NCEAC compliance</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        {/* LEFT: course selection & uploads */}
        <div className="card">
          <div className="card-header"><h2 className="card-title">Select Course</h2></div>
          <div className="card-content">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
              style={{ marginBottom: 16 }}
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {selectedCourseData && (
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Course Details</h3>
                <p><strong>Instructor:</strong> {selectedCourseData.instructor}</p>
                <p><strong>Semester:</strong> {selectedCourseData.semester} {selectedCourseData.year}</p>
                <p><strong>Department:</strong> {selectedCourseData.department}</p>
              </div>
            )}

            {selectedCourse && (
              <div className="upload-area">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.zip"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  disabled={uploadLoading}
                />
                <label htmlFor="file-upload" style={{ cursor: uploadLoading ? "not-allowed" : "pointer" }}>
                  <CloudArrowUpIcon className="upload-icon" />
                  <div className="upload-text">{uploadLoading ? "Uploading..." : "Upload Course Folder"}</div>
                  <div className="upload-subtext">Drag & drop files or click to browse (PDF, ZIP)</div>
                </label>
              </div>
            )}

            <input
              type="file"
              id="clo-upload"
              accept=".pdf,.docx,.csv,.txt"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file || !selectedCourse) return;
                const formData = new FormData();
                formData.append("file", file);
                await api.post(`/courses/${selectedCourse}/upload-clo`, formData);
                alert("CLO file uploaded!");
              }}
              disabled={uploadLoading}
            />
            <label htmlFor="clo-upload" style={{ cursor: uploadLoading ? "not-allowed" : "pointer" }}>
              Upload CLO File
            </label>
          </div>
        </div>

        {/* RIGHT: history + validation */}
        <div className="card">
          <div className="card-header"><h2 className="card-title">Upload History & Validation</h2></div>
          <div className="card-content">
            {!selectedCourse ? (
              <p style={{ textAlign: "center", color: "#64748b", padding: 48 }}>Select a course to view upload history</p>
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
                <p style={{ marginTop: 16, color: "#64748b" }}>Loading uploads...</p>
              </div>
            ) : uploads.length === 0 ? (
              <p style={{ textAlign: "center", color: "#64748b", padding: 48 }}>No uploads found for this course</p>
            ) : (
              <div>
                {uploads.map((upload) => (
                  <div key={upload.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <DocumentIcon className="w-5 h-5 text-gray-400" style={{ marginRight: 8 }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{upload.filename}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            Uploaded on {new Date(upload.upload_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {getStatusIcon(upload.validation_status)}
                        <span className={`status-badge status-${upload.validation_status}`} style={{ marginLeft: 8 }}>
                          {upload.validation_status}
                        </span>
                      </div>
                    </div>

                    {upload.validation_details && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, marginRight: 8 }}>Completeness:</span>
                          <span style={{ fontSize: 14, color: "#059669" }}>
                            {upload.validation_details.completeness_percentage || 0}%
                          </span>
                        </div>

                        <div className="progress-bar" style={{ marginBottom: 12 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${upload.validation_details.completeness_percentage || 0}%`,
                              background:
                                upload.validation_details.completeness_percentage >= 80
                                  ? "#10b981"
                                  : upload.validation_details.completeness_percentage >= 60
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          ></div>
                        </div>

                        {upload.validation_details.missing_items?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Missing Items:</div>
                            <div style={{ fontSize: 12, color: "#dc2626" }}>
                              {upload.validation_details.missing_items.map((item) => item.replace("_", " ")).join(", ")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Parse & Completeness */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h2 className="card-title">Quick Parse & Completeness</h2></div>
        <div className="card-content">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => e.target.files?.[0] && quickParse(e.target.files[0])}
            disabled={parseBusy}
          />
          {parseErr && <p style={{ color: "#dc2626", marginTop: 8 }}>{parseErr}</p>}
          {parsed && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Parse Summary</h3>
              <pre className="form-input" style={{ whiteSpace: "pre-wrap", padding: 12, overflowX: "auto" }}>
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          )}
          {comp && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Completeness — {comp.score}%</h3>
              <ul style={{ fontSize: 14 }}>
                {comp.items.map((it, i) => (
                  <li key={i} className={it.ok ? "sentiment-positive" : "sentiment-neutral"} style={{ marginBottom: 6 }}>
                    • {it.key}: {it.ok ? "OK" : "Missing"} {it.note ? `(${it.note})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseFolder;
