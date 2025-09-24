// src/pages/CourseFolder.js
import React, { useEffect, useState } from "react";
import api from "../api";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import "../App.css";

const extractErr = (e) => {
  const d = e?.response?.data;
  if (!d) return e?.message || "Request failed";
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail))
    return d.detail.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return JSON.stringify(d);
};

export default function CourseFolder() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [pageErr, setPageErr] = useState("");

  // load courses
  useEffect(() => {
    setPageErr("");
    api
      .get("/courses")
      .then((res) => setCourses(res.data || []))
      .catch((e) => {
        const msg = extractErr(e);
        setPageErr(msg);
        if (e?.response?.status === 401) window.location.href = "/login";
      });
  }, []);

  const loadUploads = () => {
    if (!selectedCourse) return;
    setLoading(true);
    setPageErr("");
    api
      // ✅ now points to validator history endpoint
      .get(`/upload/${selectedCourse}/list`)
      .then((res) => setUploads(res.data || []))
      .catch((e) => {
        const msg = extractErr(e);
        setPageErr(msg);
        if (e?.response?.status === 401) window.location.href = "/login";
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedCourse) loadUploads();
    else setUploads([]);
  }, [selectedCourse]);

  const handleCourseUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedCourse) return alert("Please select a course first.");
    setUploadLoading(true);
    setPageErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // ✅ now points to validator upload endpoint
      await api.post(`/upload/${selectedCourse}`, fd);
      await loadUploads();
    } catch (e) {
      const msg = extractErr(e);
      setPageErr(msg);
      alert(`Error uploading course folder: ${msg}`);
      if (e?.response?.status === 401) window.location.href = "/login";
    } finally {
      setUploadLoading(false);
      event.target.value = "";
    }
  };

  const handleCLOUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedCourse) return alert("Please select a course first.");
    setUploadLoading(true);
    setPageErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // CLO uploads stay under /courses
      await api.post(`/courses/${selectedCourse}/upload-clo`, fd);
      alert("CLO file uploaded successfully!");
    } catch (e) {
      const msg = extractErr(e);
      setPageErr(msg);
      alert(`Error uploading CLO: ${msg}`);
    } finally {
      setUploadLoading(false);
      event.target.value = "";
    }
  };

  const getStatusIcon = (status) => {
    switch ((status || "").toLowerCase()) {
      case "complete":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "incomplete":
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case "invalid":
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Folder Management</h1>
        <p className="page-subtitle">
          Upload and validate course folders & CLO files for NCEAC compliance
        </p>
      </div>

      {pageErr ? (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {pageErr}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        {/* LEFT */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Select Course</h2>
          </div>
          <div className="card-content">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
              style={{ marginBottom: 16 }}
              disabled={!courses.length}
            >
              <option value="">
                {courses.length ? "Choose a course..." : "No courses available"}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {selectedCourseData && (
              <div
                style={{
                  background: "#f8fafc",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <h3 style={{ fontWeight: 600, marginBottom: 8 }}>
                  Course Details
                </h3>
                <p>
                  <strong>Instructor:</strong> {selectedCourseData.instructor}
                </p>
                <p>
                  <strong>Semester:</strong>{" "}
                  {selectedCourseData.semester} {selectedCourseData.year}
                </p>
                <p>
                  <strong>Department:</strong> {selectedCourseData.department}
                </p>
              </div>
            )}

            {selectedCourse && (
              <>
                {/* Upload Course Folder */}
                <div className="upload-area">
                  <input
                    type="file"
                    id="course-upload"
                    accept="*/*"
                    onChange={handleCourseUpload}
                    style={{ display: "none" }}
                    disabled={uploadLoading}
                  />
                  <label
                    htmlFor="course-upload"
                    style={{ cursor: uploadLoading ? "not-allowed" : "pointer" }}
                  >
                    <CloudArrowUpIcon className="upload-icon" />
                    <div className="upload-text">
                      {uploadLoading ? "Uploading..." : "Upload Course Folder"}
                    </div>
                    <div className="upload-subtext">
                      Drag & drop files or click to browse (PDF, DOCX, TXT, ZIP)
                    </div>
                  </label>
                </div>

                {/* Upload CLO File */}
                <div className="upload-area" style={{ marginTop: 12 }}>
                  <input
                    type="file"
                    id="clo-upload"
                    accept="*/*"
                    onChange={handleCLOUpload}
                    style={{ display: "none" }}
                    disabled={uploadLoading}
                  />
                  <label
                    htmlFor="clo-upload"
                    style={{ cursor: uploadLoading ? "not-allowed" : "pointer" }}
                  >
                    <CloudArrowUpIcon className="upload-icon" />
                    <div className="upload-text">
                      {uploadLoading ? "Uploading..." : "Upload CLO File"}
                    </div>
                    <div className="upload-subtext">
                      Upload CLO requirements separately
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Upload History & Validation</h2>
          </div>
          <div className="card-content">
            {!selectedCourse ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  padding: 48,
                }}
              >
                Select a course to view upload history
              </p>
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
                <p style={{ marginTop: 16, color: "#64748b" }}>
                  Loading uploads...
                </p>
              </div>
            ) : uploads.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  padding: 48,
                }}
              >
                No uploads found for this course
              </p>
            ) : (
              <div>
                {uploads.map((u) => {
                  const pct = u?.validation_details?.completeness_percentage ?? 0;
                  return (
                    <div
                      key={u.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <DocumentIcon
                            className="w-5 h-5 text-gray-400"
                            style={{ marginRight: 8 }}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.filename}</div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              Uploaded on{" "}
                              {new Date(u.upload_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {getStatusIcon(u.validation_status)}
                          <span
                            className={`status-badge status-${u.validation_status}`}
                            style={{ marginLeft: 8 }}
                          >
                            {u.validation_status}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{ fontSize: 14, fontWeight: 500, marginRight: 8 }}
                        >
                          Completeness:
                        </span>
                        <span style={{ fontSize: 14 }}>{pct}%</span>
                      </div>

                      <div className="progress-bar" style={{ marginBottom: 12 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 80
                                ? "#10b981"
                                : pct >= 60
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        />
                      </div>

                      {!!u?.validation_details?.missing_items?.length && (
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              marginBottom: 8,
                            }}
                          >
                            Missing Items:
                          </div>
                          <div style={{ fontSize: 12, color: "#dc2626" }}>
                            {u.validation_details.missing_items
                              .map((item) => item.replaceAll("_", " "))
                              .join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
