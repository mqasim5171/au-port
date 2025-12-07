// src/pages/CourseFolder.js
import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import "../App.css";

// ---------- Helper: Extract Error Message ----------
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
  // -------- STATES --------
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [pageErr, setPageErr] = useState("");

  // Add Material Panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialFiles, setMaterialFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Expand/collapse cards
  const [expandedIds, setExpandedIds] = useState(new Set());

  // ---------------- LOAD COURSES ----------------
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

  // ---------------- LOAD MATERIALS ----------------
  const loadMaterials = useCallback(() => {
    if (!selectedCourse) {
      setMaterials([]);
      return;
    }
    setLoadingMaterials(true);
    setPageErr("");
    api
      .get(`/courses/${selectedCourse}/materials`)
      .then((res) => setMaterials(res.data || []))
      .catch((e) => {
        const msg = extractErr(e);
        setPageErr(msg);
        if (e?.response?.status === 401) window.location.href = "/login";
      })
      .finally(() => setLoadingMaterials(false));
  }, [selectedCourse]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);

  // ---------------- PANEL FUNCTIONS ----------------
  const resetMaterialForm = () => {
    setMaterialTitle("");
    setMaterialDescription("");
    setMaterialFiles([]);
    setDragActive(false);
  };

  const openPanel = () => {
    if (!selectedCourse) {
      alert("Please select a course first.");
      return;
    }
    resetMaterialForm();
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    resetMaterialForm();
  };

  const handleFilesFromInput = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setMaterialFiles((prev) => [...prev, ...files]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    setMaterialFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (idx) => {
    setMaterialFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---------------- SAVE MATERIAL ----------------
  const handleSaveMaterial = async () => {
    if (!materialTitle.trim()) {
      alert("Please enter a material title.");
      return;
    }

    setIsSaving(true);
    setPageErr("");

    try {
      const fd = new FormData();
      fd.append("title", materialTitle.trim());
      if (materialDescription.trim())
        fd.append("description", materialDescription.trim());

      materialFiles.forEach((f) => fd.append("files", f));

      await api.post(`/courses/${selectedCourse}/materials`, fd);

      closePanel();
      await loadMaterials();
    } catch (e) {
      const msg = extractErr(e);
      alert(`Error saving material: ${msg}`);
      setPageErr(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---------------- GROUP MATERIALS ----------------
  const groupedMaterials = {
    quiz: [],
    assignment: [],
    mid: [],
    final: [],
    other: [],
  };

  materials.forEach((m) => {
    const t = m.title.toLowerCase().trim();

    if (t.startsWith("quiz")) groupedMaterials.quiz.push(m);
    else if (t.startsWith("assignment")) groupedMaterials.assignment.push(m);
    else if (t.startsWith("mid")) groupedMaterials.mid.push(m);
    else if (t.startsWith("final")) groupedMaterials.final.push(m);
    else groupedMaterials.other.push(m);
  });

  // ---------------- ANALYZE FILE ----------------
  const analyzeFile = async (fileId) => {
    try {
      const res = await api.get(`/analysis/${fileId}`);
      alert(
        `CLO Alignment: ${res.data.clo}%\nPLO Alignment: ${res.data.plo}%`
      );
    } catch (e) {
      alert("Analysis failed: " + extractErr(e));
    }
  };

  // ---------------- RENDER MATERIAL SECTION ----------------
  const MaterialSection = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="material-section">
        <h3 className="material-section-title">{title}</h3>

        {items.map((m) => {
          const isExpanded = expandedIds.has(m.id);
          const fileCount = m.files.length;

          return (
            <div key={m.id} className="material-card">
              <button
                className="material-header"
                onClick={() => toggleExpanded(m.id)}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-slate-500" />
                )}
                <div style={{ marginLeft: 8 }}>
                  <div className="material-title">{m.title}</div>
                  {m.description && (
                    <div className="material-description">{m.description}</div>
                  )}
                  <div className="material-meta">
                    {fileCount} file{fileCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="material-body">
                  {m.files.map((f) => (
                    <div key={f.id} className="material-file-row">
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <DocumentIcon className="w-5 h-5 text-slate-400" />
                        <span style={{ marginLeft: 8 }}>
                          {f.display_name || f.filename}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        {f.url && (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="file-action-link"
                          >
                            Open
                          </a>
                        )}

                        <button
                          className="file-action-link"
                          onClick={() => analyzeFile(f.id)}
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // -----------------------------------------------------------
  // ----------------------- MAIN UI ----------------------------
  // -----------------------------------------------------------
  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Folder</h1>
        <p className="page-subtitle">
          Upload quizzes, assignments & course materials — Google Classroom
          style.
        </p>
      </div>

      {pageErr && <div className="error-message">{pageErr}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 2fr",
          gap: 24,
        }}
      >
        {/* ===================================================== */}
        {/* LEFT COLUMN - COURSE SELECTION */}
        {/* ===================================================== */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Select Course</h2>
          </div>
          <div className="card-content">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
            >
              <option value="">
                {courses.length ? "Choose a course..." : "Loading..."}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {selectedCourseData && (
              <div className="course-details-card">
                <h3>Course Details</h3>
                <p>
                  <strong>Instructor:</strong>{" "}
                  {selectedCourseData.instructor}
                </p>
                <p>
                  <strong>Semester:</strong>{" "}
                  {selectedCourseData.semester} {selectedCourseData.year}
                </p>
                <p>
                  <strong>Department:</strong>{" "}
                  {selectedCourseData.department}
                </p>
              </div>
            )}

            <button
              className="add-material-btn"
              onClick={openPanel}
              disabled={!selectedCourse}
            >
              <PlusCircleIcon className="w-5 h-5" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* RIGHT COLUMN - MATERIAL DISPLAY */}
        {/* ===================================================== */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course Materials</h2>
          </div>

          <div className="card-content">
            {!selectedCourse ? (
              <p className="empty-message">Select a course to begin.</p>
            ) : loadingMaterials ? (
              <p className="empty-message">Loading materials...</p>
            ) : (
              <>
                <MaterialSection
                  title="Quizzes"
                  items={groupedMaterials.quiz}
                />
                <MaterialSection
                  title="Assignments"
                  items={groupedMaterials.assignment}
                />
                <MaterialSection
                  title="Midterm"
                  items={groupedMaterials.mid}
                />
                <MaterialSection
                  title="Final"
                  items={groupedMaterials.final}
                />
                <MaterialSection
                  title="Other Materials"
                  items={groupedMaterials.other}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================== */}
      {/* ADD MATERIAL SIDE PANEL */}
      {/* ===================================================== */}
      {isPanelOpen && (
        <div className="material-panel-backdrop">
          <div className="material-panel">
            <div className="material-panel-header">
              <div>
                <h2>Add Material</h2>
                <p>Add a title, optional description, and files.</p>
              </div>
              <button
                className="icon-button"
                onClick={closePanel}
                disabled={isSaving}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="material-panel-body">
              <label className="field-label">
                Material Title <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Quiz 1, Assignment 2, Midterm"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                disabled={isSaving}
              />

              <label className="field-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Optional details"
                value={materialDescription}
                onChange={(e) => setMaterialDescription(e.target.value)}
                disabled={isSaving}
              />

              <label className="field-label">Attach Files</label>
              <div
                className={`material-dropzone ${
                  dragActive ? "material-dropzone-active" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <CloudArrowUpIcon className="w-8 h-8 text-slate-400" />
                <p>Drag & drop files</p>
                <label className="browse-button">
                  Browse
                  <input
                    type="file"
                    multiple
                    onChange={handleFilesFromInput}
                    style={{ display: "none" }}
                    disabled={isSaving}
                  />
                </label>
              </div>

              {!!materialFiles.length && (
                <div className="material-selected-files">
                  {materialFiles.map((f, idx) => (
                    <div key={idx} className="material-selected-file-row">
                      <DocumentIcon className="w-4 h-4 text-slate-400" />
                      <span>{f.name}</span>
                      <button
                        className="file-remove-btn"
                        onClick={() => handleRemoveFile(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="material-panel-footer">
              <button
                className="btn-primary"
                onClick={handleSaveMaterial}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn-ghost"
                onClick={closePanel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
