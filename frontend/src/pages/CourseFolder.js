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
import { useNavigate } from "react-router-dom";

// ---------- helper to extract error ----------
const extractErr = (e) => {
  const d = e?.response?.data;
  if (!d) return e?.message || "Request failed";
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail))
    return d.detail.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return JSON.stringify(d);
};

// simple mapping for 4 folders
const FOLDERS = [
  { key: "assignments", label: "Assignments" },
  { key: "quizzes", label: "Quizzes" },
  { key: "midterm", label: "Mid Term" },
  { key: "finalterm", label: "Final Term" },
];

// infer folder from material title if backend doesn't send one
const inferFolderFromTitle = (title = "") => {
  const t = title.toLowerCase().trim();
  if (t.startsWith("assignment")) return "assignments";
  if (t.startsWith("quiz")) return "quizzes";
  if (t.startsWith("mid")) return "midterm";
  if (t.startsWith("final")) return "finalterm";
  return "assignments"; // default bucket
};

// ✅ accept user prop
export default function CourseFolder({ user }) {
  const navigate = useNavigate();

  // ✅ role flags (normalized)
  const role = (user?.role || "").toString().toLowerCase().replace(/[_-]/g, "");
  const isAdmin = ["admin", "administrator", "superadmin"].includes(role);
  const isHod = ["hod"].includes(role);
  const isCourseLead = ["courselead"].includes(role);
  const isFaculty = ["faculty", "teacher"].includes(role);

  // ✅ permissions for this page
  const canUploadMaterials = isAdmin || isHod || isCourseLead || isFaculty;
  const canBulkUpload = isAdmin || isHod || isCourseLead;

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");

  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [pageErr, setPageErr] = useState("");

  // add-material side panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialFiles, setMaterialFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // which folder is open
  const [activeFolder, setActiveFolder] = useState(null);

  // expanded material (for file list)
  const [expandedIds, setExpandedIds] = useState(new Set());

  // --------- BULK COURSE FOLDER UPLOADS (file-explorer style) ----------
  const [bulkUploads, setBulkUploads] = useState([]);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  // ===================== PHASE-2 WORKFLOW (NEW) =====================
  const [activeTab, setActiveTab] = useState("materials"); // "materials" | "guide" | "lectures"

  // Course Guide
  const [guideFile, setGuideFile] = useState(null);
  const [guideUploading, setGuideUploading] = useState(false);

  // Weekly Lectures
  const [lectureWeek, setLectureWeek] = useState(1);
  const [lectureFile, setLectureFile] = useState(null);
  const [lectureUploading, setLectureUploading] = useState(false);

  // Execution Status
  const [executionStatus, setExecutionStatus] = useState(null);

  // ------------ load courses ------------
  useEffect(() => {
    setPageErr("");
    api
      .get("/courses/my")
      .then((res) => setCourses(res.data || []))
      .catch((e) => {
        const msg = extractErr(e);
        setPageErr(msg);
        if (e?.response?.status === 401) window.location.href = "/login";
      });
  }, []);

  // ------------ load materials ------------
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

  // ------------ load BULK course-folder uploads (from /upload router) ------------
  const loadBulkUploads = useCallback(() => {
    if (!selectedCourse) {
      setBulkUploads([]);
      return;
    }
    api
      .get(`/upload/${selectedCourse}/list`)
      .then((res) => setBulkUploads(res.data || []))
      .catch((e) => {
        console.error("Failed to load course folder uploads:", extractErr(e));
      });
  }, [selectedCourse]);

  // ------------ load execution status (NEW) ------------
  const loadExecutionStatus = useCallback(() => {
    if (!selectedCourse) {
      setExecutionStatus(null);
      return;
    }
    api
      .get(`/courses/${selectedCourse}/execution-status`)
      .then((res) => setExecutionStatus(res.data))
      .catch((e) => {
        console.warn("Execution status error:", extractErr(e));
      });
  }, [selectedCourse]);

  useEffect(() => {
    loadMaterials();
    loadBulkUploads();
    loadExecutionStatus(); // ✅ NEW
    setActiveFolder(null);
    setExpandedIds(new Set());
  }, [loadMaterials, loadBulkUploads, loadExecutionStatus]);

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);

  // ------------ side panel logic (per-material upload) ------------
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
    if (!canUploadMaterials) {
      alert("You are not allowed to upload materials for this course.");
      return;
    }

    if (activeFolder === "assignments") setMaterialTitle("Assignment ");
    else if (activeFolder === "quizzes") setMaterialTitle("Quiz ");
    else if (activeFolder === "midterm") setMaterialTitle("Mid Term ");
    else if (activeFolder === "finalterm") setMaterialTitle("Final Term ");
    else setMaterialTitle("");

    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    resetMaterialForm();
  };

  const handleSaveMaterial = async () => {
    if (!materialTitle.trim()) {
      alert("Please enter a material title.");
      return;
    }
    if (!selectedCourse) {
      alert("Please select a course first.");
      return;
    }
    if (!canUploadMaterials) {
      alert("You are not allowed to upload materials for this course.");
      return;
    }

    setIsSaving(true);
    setPageErr("");

    try {
      const fd = new FormData();
      fd.append("title", materialTitle.trim());
      if (materialDescription.trim())
        fd.append("description", materialDescription.trim());
      if (activeFolder) fd.append("folder_hint", activeFolder);
      materialFiles.forEach((f) => fd.append("files", f));

      await api.post(`/courses/${selectedCourse}/materials`, fd);
      closePanel();
      await loadMaterials();
    } catch (e) {
      const msg = extractErr(e);
      setPageErr(msg);
      alert(`Error saving material: ${msg}`);
      if (e?.response?.status === 401) window.location.href = "/login";
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

  // ------------ group materials into 4 folders (file-level) ------------
  const folderFiles = {
    assignments: [],
    quizzes: [],
    midterm: [],
    finalterm: [],
  };

  materials.forEach((m) => {
    const folder =
      m.folder || m.folder_type || inferFolderFromTitle(m.title || "");
    (m.files || []).forEach((f) => {
      folderFiles[folder]?.push({
        ...f,
        materialId: m.id,
        materialTitle: m.title,
        materialDescription: m.description,
      });
    });
  });

  // ------------ analyze file (single material file) ------------
  const analyzeFile = async (fileId) => {
    try {
      const res = await api.get(`/analysis/${fileId}`);
      alert(`CLO Alignment: ${res.data.clo}%\nPLO Alignment: ${res.data.plo}%`);
    } catch (e) {
      alert("Analysis failed: " + extractErr(e));
    }
  };

  // ------------ handlers for BULK course-folder uploads ------------
  const handleBulkFilesFromInput = (e) => {
    const files = Array.from(e.target.files || []);
    setBulkFiles(files);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
      alert("Please select a course first.");
      return;
    }
    if (!canBulkUpload) {
      alert("Only Course Lead / HOD / Admin can upload full course folders.");
      return;
    }
    if (!bulkFiles.length) {
      alert("Please choose at least one file (ZIP, PDF, DOCX…).");
      return;
    }

    setBulkUploading(true);
    try {
      const fd = new FormData();
      bulkFiles.forEach((f) => fd.append("files", f));

      await api.post(`/upload/${selectedCourse}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setBulkFiles([]);
      await loadBulkUploads();
    } catch (e) {
      const msg = extractErr(e);
      alert("Error uploading course folder: " + msg);
      if (e?.response?.status === 401) window.location.href = "/login";
    } finally {
      setBulkUploading(false);
    }
  };

  // ===================== PHASE-2 UPLOAD HANDLERS (NEW) =====================
  const handleUploadCourseGuide = async () => {
    if (!selectedCourse) return alert("Select a course first.");
    if (!canUploadMaterials)
      return alert("You are not allowed to upload course guide.");
    if (!guideFile) return alert("Choose a course guide file first.");

    setGuideUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", guideFile);

      await api.post(`/courses/${selectedCourse}/course-guide`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGuideFile(null);
      alert("Course guide uploaded successfully.");
      loadExecutionStatus();
    } catch (e) {
      alert("Course guide upload failed: " + extractErr(e));
    } finally {
      setGuideUploading(false);
    }
  };

  const handleUploadWeeklyLecture = async () => {
    if (!selectedCourse) return alert("Select a course first.");
    if (!canUploadMaterials)
      return alert("You are not allowed to upload lectures.");
    if (!lectureFile) return alert("Choose a lecture file first.");

    setLectureUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", lectureFile);

      await api.post(`/courses/${selectedCourse}/lectures?week=${lectureWeek}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setLectureFile(null);
      alert(`Lecture uploaded for Week ${lectureWeek}.`);
      loadExecutionStatus();
    } catch (e) {
      alert("Lecture upload failed: " + extractErr(e));
    } finally {
      setLectureUploading(false);
    }
  };

  // ------------ UI RENDER ------------
  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Folder</h1>
        <p className="page-subtitle">
          Choose a course, open a folder, and manage both individual materials
          and full course-folder uploads in one place.
        </p>
      </div>

      {pageErr && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {pageErr}
        </div>
      )}

      {/* ✅ Optional: small role badge */}
      <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
        Logged in as: <strong>{user?.full_name || user?.username}</strong>{" "}
        <span style={{ marginLeft: 8 }}>
          Role: <strong>{user?.role || "unknown"}</strong>
        </span>
      </div>

      {/* ===================== WORKFLOW TABS (NEW) ===================== */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          className={activeTab === "materials" ? "btn-primary" : "btn-ghost"}
          type="button"
          onClick={() => setActiveTab("materials")}
        >
          Materials & Assessments
        </button>

        <button
          className={activeTab === "guide" ? "btn-primary" : "btn-ghost"}
          type="button"
          onClick={() => setActiveTab("guide")}
          disabled={!selectedCourse}
          title={!selectedCourse ? "Select a course first" : ""}
        >
          Course Guide
        </button>

        <button
          className={activeTab === "lectures" ? "btn-primary" : "btn-ghost"}
          type="button"
          onClick={() => setActiveTab("lectures")}
          disabled={!selectedCourse}
          title={!selectedCourse ? "Select a course first" : ""}
        >
          Weekly Lectures
        </button>
      </div>

      {/* ===================== TAB: COURSE GUIDE (NEW) ===================== */}
      {activeTab === "guide" && selectedCourse && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h2 className="card-title">Course Guide</h2>
            <p className="card-subtitle">
              Upload the official course guide (drives weekly execution monitoring).
            </p>
          </div>

          <div
            className="card-content"
            style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <input
              type="file"
              onChange={(e) => setGuideFile(e.target.files?.[0] || null)}
              disabled={!canUploadMaterials || guideUploading}
            />

            <button
              type="button"
              className="btn-primary"
              onClick={handleUploadCourseGuide}
              disabled={!canUploadMaterials || guideUploading || !guideFile}
            >
              {guideUploading ? "Uploading..." : "Upload Course Guide"}
            </button>

            {!canUploadMaterials && (
              <span style={{ fontSize: 13, color: "#9a3412" }}>
                Upload disabled for your role.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB: WEEKLY LECTURES (NEW) ===================== */}
      {activeTab === "lectures" && selectedCourse && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h2 className="card-title">Weekly Lectures</h2>
            <p className="card-subtitle">
              Upload lectures week-wise and track execution status.
            </p>
          </div>

          <div className="card-content">
            {executionStatus && (
              <div
                style={{
                  background: executionStatus.is_on_track ? "#ecfdf5" : "#fff7ed",
                  border: `1px solid ${
                    executionStatus.is_on_track ? "#bbf7d0" : "#fed7aa"
                  }`,
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 12,
                  color: executionStatus.is_on_track ? "#166534" : "#9a3412",
                  fontSize: 13,
                }}
              >
                <strong>
                  {executionStatus.is_on_track ? "On Track ✅" : "Deviation Detected ⚠️"}
                </strong>
                <div style={{ marginTop: 6 }}>
                  Missing Weeks:{" "}
                  <strong>
                    {executionStatus.missing_weeks?.length
                      ? executionStatus.missing_weeks.join(", ")
                      : "None"}
                  </strong>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <label style={{ fontSize: 13, color: "#64748b" }}>Week</label>
                <select
                  className="form-input"
                  value={lectureWeek}
                  onChange={(e) => setLectureWeek(Number(e.target.value))}
                  style={{ width: 140 }}
                >
                  {Array.from({ length: 16 }).map((_, i) => (
                    <option key={i} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, color: "#64748b" }}>Lecture File</label>
                <input
                  type="file"
                  onChange={(e) => setLectureFile(e.target.files?.[0] || null)}
                  disabled={!canUploadMaterials || lectureUploading}
                />
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleUploadWeeklyLecture}
                disabled={!canUploadMaterials || lectureUploading || !lectureFile}
                style={{ height: 40, marginTop: 18 }}
              >
                {lectureUploading ? "Uploading..." : "Upload Lecture"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB: MATERIALS (YOUR EXISTING UI) ===================== */}
      {activeTab === "materials" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 2fr",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            {/* LEFT: course selection */}
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
                      borderRadius: 12,
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
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: 12, width: "100%" }}
                      onClick={() =>
                        navigate(`/courses/${selectedCourse}/assessments`)
                      }
                    >
                      Open Assessments
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: folder view (per-material files) */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Course Folders</h2>
              </div>
              <div className="card-content">
                {!selectedCourse ? (
                  <p style={{ textAlign: "center", color: "#64748b", padding: 48 }}>
                    Select a course to view its folders.
                  </p>
                ) : loadingMaterials ? (
                  <p style={{ textAlign: "center", color: "#64748b", padding: 48 }}>
                    Loading materials...
                  </p>
                ) : (
                  <>
                    {/* folder icons */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 16,
                        marginBottom: 24,
                      }}
                    >
                      {FOLDERS.map((f) => {
                        const isActive = activeFolder === f.key;
                        return (
                          <div
                            key={f.key}
                            className="folder-tile"
                            onClick={() => setActiveFolder(f.key)}
                            onDoubleClick={() => setActiveFolder(f.key)}
                            style={{
                              cursor: "pointer",
                              textAlign: "center",
                              padding: 12,
                              borderRadius: 12,
                              border: isActive
                                ? "2px solid #2563eb"
                                : "1px solid #e2e8f0",
                              background: "#f8fafc",
                            }}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 36,
                                margin: "0 auto 8px",
                                borderRadius: 6,
                                background:
                                  "linear-gradient(180deg,#facc15,#f59e0b)",
                                position: "relative",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: "15%",
                                  top: "55%",
                                  right: "15%",
                                  height: 10,
                                  borderRadius: 4,
                                  background: "#1d4ed8",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: isActive ? "#1d4ed8" : "#0f172a",
                              }}
                            >
                              {f.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* opened folder contents */}
                    {activeFolder ? (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                            {FOLDERS.find((f) => f.key === activeFolder)?.label}{" "}
                            Folder
                          </h3>

                          <button
                            type="button"
                            className="add-material-btn"
                            style={{
                              padding: "6px 12px",
                              fontSize: 13,
                              opacity: canUploadMaterials ? 1 : 0.55,
                              cursor: canUploadMaterials
                                ? "pointer"
                                : "not-allowed",
                            }}
                            onClick={openPanel}
                            disabled={!canUploadMaterials}
                            title={
                              canUploadMaterials
                                ? "Upload new material"
                                : "You don't have permission to upload materials"
                            }
                          >
                            <PlusCircleIcon className="w-4 h-4" />
                            <span style={{ marginLeft: 4 }}>Upload File</span>
                          </button>
                        </div>

                        {!canUploadMaterials && (
                          <div
                            style={{
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              color: "#9a3412",
                              padding: "10px 12px",
                              borderRadius: 10,
                              marginBottom: 10,
                              fontSize: 13,
                            }}
                          >
                            Upload is disabled for your role. You can view/download
                            files only.
                          </div>
                        )}

                        <div
                          style={{
                            borderTop: "1px solid #e2e8f0",
                            paddingTop: 8,
                          }}
                        >
                          {folderFiles[activeFolder]?.length ? (
                            folderFiles[activeFolder].map((f) => {
                              const matId = f.materialId;
                              const isExpanded = expandedIds.has(matId);

                              return (
                                <div
                                  key={f.id}
                                  className="material-card"
                                  style={{ marginBottom: 8 }}
                                >
                                  <button
                                    type="button"
                                    className="material-header"
                                    onClick={() => toggleExpanded(matId)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                                    ) : (
                                      <ChevronRightIcon className="w-5 h-5 text-slate-500" />
                                    )}
                                    <div
                                      style={{ marginLeft: 8, textAlign: "left" }}
                                    >
                                      <div className="material-title">
                                        {f.materialTitle}
                                      </div>
                                      <div className="material-description">
                                        {f.materialDescription || "File"}
                                      </div>
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="material-body">
                                      <div className="material-file-row">
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                          }}
                                        >
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
                                            type="button"
                                            className="file-action-link"
                                            onClick={() => analyzeFile(f.id)}
                                          >
                                            Analyze
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p
                              style={{
                                padding: 24,
                                textAlign: "center",
                                color: "#64748b",
                                fontSize: 14,
                              }}
                            >
                              This folder is empty.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{
                          textAlign: "center",
                          color: "#64748b",
                          fontSize: 14,
                        }}
                      >
                        Double-click a folder icon to open it.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ---------- BULK COURSE FOLDER UPLOADS SECTION ---------- */}
          {selectedCourse && (
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-header">
                <h2 className="card-title">Course Folder Uploads (Bulk)</h2>
                <p className="card-subtitle">
                  Upload full course folders (ZIP / PDF / DOCX) for automatic validation.
                </p>
              </div>

              <div className="card-content">
                {!canBulkUpload && (
                  <div
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      padding: "10px 12px",
                      borderRadius: 10,
                      color: "#334155",
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    Bulk upload is restricted to{" "}
                    <strong>Course Lead / HOD / Admin</strong>.
                  </div>
                )}

                <form
                  onSubmit={handleBulkUpload}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 16,
                    opacity: canBulkUpload ? 1 : 0.55,
                  }}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleBulkFilesFromInput}
                    disabled={bulkUploading || !canBulkUpload}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={bulkUploading || !bulkFiles.length || !canBulkUpload}
                  >
                    {bulkUploading ? "Uploading..." : "Upload Course Folder(s)"}
                  </button>
                  {bulkFiles.length > 0 && !bulkUploading && (
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {bulkFiles.length} file(s) selected
                    </span>
                  )}
                </form>

                <div style={{ marginTop: 8 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                    Previous uploads
                  </h3>

                  {!bulkUploads.length ? (
                    <p style={{ color: "#64748b", fontSize: 14 }}>
                      No course folders uploaded yet for this course.
                    </p>
                  ) : (
                    <div className="upload-list">
                      {bulkUploads.map((u) => {
                        const pct =
                          u.validation_details?.completeness_percentage ?? null;
                        const status = u.validation_status || "unknown";
                        let statusColor = "#64748b";
                        if (status === "complete") statusColor = "#16a34a";
                        else if (status === "incomplete") statusColor = "#eab308";
                        else if (status === "invalid") statusColor = "#ef4444";

                        return (
                          <div
                            key={u.id}
                            className="upload-list-item"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 0",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <DocumentIcon className="w-4 h-4 text-slate-400" />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>
                                  {u.filename}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>
                                  {u.upload_date
                                    ? new Date(u.upload_date).toLocaleString()
                                    : ""}
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: `1px solid ${statusColor}`,
                                  color: statusColor,
                                  textTransform: "capitalize",
                                }}
                              >
                                {status}
                              </span>
                              {pct !== null && (
                                <span style={{ fontSize: 11, color: "#64748b" }}>
                                  Completeness: {pct}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ------------ Add Material Side Panel ------------ */}
      {isPanelOpen && (
        <div className="material-panel-backdrop">
          <div className="material-panel">
            <div className="material-panel-header">
              <div>
                <h2>Add Material</h2>
                <p>
                  Upload file(s) for{" "}
                  {(FOLDERS.find((f) => f.key === activeFolder) || {}).label ||
                    "this course"}
                  .
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closePanel}
                disabled={isSaving}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="material-panel-body">
              <label className="field-label">
                Material Title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Assignment 1, Quiz 2"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                disabled={isSaving}
              />

              <label className="field-label" style={{ marginTop: 16 }}>
                Description <span style={{ color: "#94a3b8" }}>(optional)</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Add short instructions or notes."
                value={materialDescription}
                onChange={(e) => setMaterialDescription(e.target.value)}
                disabled={isSaving}
              />

              <label className="field-label" style={{ marginTop: 16 }}>
                Attach Files
              </label>
              <div
                className={`material-dropzone ${
                  dragActive ? "material-dropzone-active" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const files = Array.from(e.dataTransfer.files || []);
                  if (!files.length) return;
                  setMaterialFiles((prev) => [...prev, ...files]);
                }}
              >
                <CloudArrowUpIcon className="w-8 h-8 text-slate-400" />
                <p style={{ marginTop: 8, fontWeight: 500 }}>
                  Drag & drop files here
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  or click the button below to browse
                </p>
                <label className="browse-button">
                  <span>Browse files</span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setMaterialFiles((prev) => [...prev, ...files]);
                    }}
                    style={{ display: "none" }}
                    disabled={isSaving}
                  />
                </label>
              </div>

              {!!materialFiles.length && (
                <div className="material-selected-files">
                  {materialFiles.map((f, idx) => (
                    <div key={idx} className="material-selected-file-row">
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <DocumentIcon className="w-4 h-4 text-slate-400" />
                        <span style={{ marginLeft: 6, fontSize: 13 }}>
                          {f.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="file-remove-btn"
                        onClick={() =>
                          setMaterialFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        disabled={isSaving}
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
                type="button"
                className="btn-primary"
                onClick={handleSaveMaterial}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
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
