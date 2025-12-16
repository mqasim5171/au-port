// src/pages/CourseFolder.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserPlusIcon,
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
  return "assignments";
};

const Pill = ({ color = "#334155", bg = "#f1f5f9", border = "#e2e8f0", children }) => (
  <span
    style={{
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: bg,
      color,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const SectionTitle = ({ title, subtitle }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</div>
    {subtitle ? (
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{subtitle}</div>
    ) : null}
  </div>
);

export default function CourseFolder({ user }) {
  const navigate = useNavigate();

  // ✅ role flags (normalized)
  const role = (user?.role || "").toString().toLowerCase().replace(/[_-]/g, "");
  const isAdmin = ["admin", "administrator", "superadmin"].includes(role);
  const isHod = ["hod"].includes(role);
  const isCourseLead = ["courselead"].includes(role);
  const isFaculty = ["faculty", "teacher"].includes(role);

  const canUploadMaterials = isAdmin || isHod || isCourseLead || isFaculty;
  const canBulkUpload = isAdmin || isHod || isCourseLead;

  // ✅ admin/hod can assign course
  const canAssignCourse = isAdmin || isHod;

  const [activeTab, setActiveTab] = useState("materials"); // materials | guide | lectures | bulk | assign

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
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

  const [activeFolder, setActiveFolder] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // BULK
  const [bulkUploads, setBulkUploads] = useState([]);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  // COURSE GUIDE
  const [guideFile, setGuideFile] = useState(null);
  const [guideUploading, setGuideUploading] = useState(false);

  // LECTURES
  const [lectureWeek, setLectureWeek] = useState(1);
  const [lectureFile, setLectureFile] = useState(null);
  const [lectureUploading, setLectureUploading] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);

  // ASSIGN
  const [instructors, setInstructors] = useState([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ===================== LOADERS =====================

  const loadCourses = useCallback(() => {
    setCoursesLoading(true);
    setPageErr("");
    api
      .get("/courses/my")
      .then((res) => setCourses(res.data || []))
      .catch((e) => {
        const msg = extractErr(e);
        setPageErr(msg);
        if (e?.response?.status === 401) window.location.href = "/login";
      })
      .finally(() => setCoursesLoading(false));
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

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

  const loadInstructors = useCallback(() => {
    if (!canAssignCourse) {
      setInstructors([]);
      return;
    }
    setInstructorsLoading(true);
    api
      .get("/users?role=faculty")
      .then((res) => setInstructors(res.data || []))
      .catch((e) => {
        console.error("Failed to load instructors:", extractErr(e));
        setInstructors([]);
      })
      .finally(() => setInstructorsLoading(false));
  }, [canAssignCourse]);

  useEffect(() => {
    loadMaterials();
    loadBulkUploads();
    loadExecutionStatus();
    setActiveFolder(null);
    setExpandedIds(new Set());
  }, [loadMaterials, loadBulkUploads, loadExecutionStatus]);

  useEffect(() => {
    if (activeTab === "assign") loadInstructors();
  }, [activeTab, loadInstructors]);

  const selectedCourseData = useMemo(
    () => courses.find((c) => c.id === selectedCourse),
    [courses, selectedCourse]
  );

  // ===================== MATERIAL PANEL =====================

  const resetMaterialForm = () => {
    setMaterialTitle("");
    setMaterialDescription("");
    setMaterialFiles([]);
    setDragActive(false);
  };

  const openPanel = () => {
    if (!selectedCourse) return alert("Please select a course first.");
    if (!canUploadMaterials) return alert("You are not allowed to upload materials.");

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
    if (!materialTitle.trim()) return alert("Please enter a material title.");
    if (!selectedCourse) return alert("Please select a course first.");
    if (!canUploadMaterials) return alert("You are not allowed to upload materials.");
    if (!materialFiles.length) return alert("Please attach at least one file.");

    setIsSaving(true);
    setPageErr("");

    try {
      const fd = new FormData();
      fd.append("title", materialTitle.trim());
      if (materialDescription.trim()) fd.append("description", materialDescription.trim());
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

  // group materials into 4 folders (file-level)
  const folderFiles = useMemo(() => {
    const out = { assignments: [], quizzes: [], midterm: [], finalterm: [] };
    (materials || []).forEach((m) => {
      const folder = m.folder || m.folder_type || inferFolderFromTitle(m.title || "");
      (m.files || []).forEach((f) => {
        out[folder]?.push({
          ...f,
          materialId: m.id,
          materialTitle: m.title,
          materialDescription: m.description,
        });
      });
    });
    return out;
  }, [materials]);

  const analyzeFile = async (fileId) => {
    try {
      const res = await api.get(`/analysis/${fileId}`);
      alert(`CLO Alignment: ${res.data.clo}%\nPLO Alignment: ${res.data.plo}%`);
    } catch (e) {
      alert("Analysis failed: " + extractErr(e));
    }
  };

  // ===================== BULK =====================
  const handleBulkFilesFromInput = (e) => {
    const files = Array.from(e.target.files || []);
    setBulkFiles(files);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return alert("Select a course first.");
    if (!canBulkUpload) return alert("Only Course Lead / HOD / Admin can bulk upload.");
    if (!bulkFiles.length) return alert("Choose at least one file.");

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
      alert("Error uploading course folder: " + extractErr(e));
      if (e?.response?.status === 401) window.location.href = "/login";
    } finally {
      setBulkUploading(false);
    }
  };

  // ===================== GUIDE / LECTURES =====================
  const handleUploadCourseGuide = async () => {
    if (!selectedCourse) return alert("Select a course first.");
    if (!canUploadMaterials) return alert("You are not allowed to upload course guide.");
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
    if (!canUploadMaterials) return alert("You are not allowed to upload lectures.");
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

  // ===================== ASSIGN =====================
  const filteredInstructors = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return instructors;
    return (instructors || []).filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || uname.includes(q) || email.includes(q);
    });
  }, [instructors, teacherSearch]);

  const handleAssignTeacher = async () => {
    if (!selectedCourse) return alert("Select a course first.");
    if (!canAssignCourse) return alert("Only Admin/HOD can assign courses.");
    if (!selectedTeacherId) return alert("Select an instructor.");

    setAssigning(true);
    try {
      await api.post(`/courses/${selectedCourse}/assign`, {
        user_id: selectedTeacherId,
        assignment_role: "TEACHER",
      });
      alert("✅ Instructor assigned successfully.");
      loadCourses();
    } catch (e) {
      alert("Assign failed: " + extractErr(e));
    } finally {
      setAssigning(false);
    }
  };

  // ===================== UI =====================

  const RoleBadge = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Pill>
        Logged in: <strong>{user?.full_name || user?.username || "Unknown"}</strong>
      </Pill>
      <Pill bg="#eef2ff" border="#c7d2fe" color="#3730a3">
        Role: <strong>{user?.role || "unknown"}</strong>
      </Pill>
      {isAdmin && <Pill bg="#ecfeff" border="#a5f3fc" color="#155e75">Admin</Pill>}
      {isHod && <Pill bg="#f0fdf4" border="#bbf7d0" color="#166534">HOD</Pill>}
      {isCourseLead && <Pill bg="#fff7ed" border="#fed7aa" color="#9a3412">Course Lead</Pill>}
      {isFaculty && <Pill bg="#f8fafc" border="#e2e8f0" color="#334155">Faculty</Pill>}
    </div>
  );

  const Tabs = () => {
    const TabBtn = ({ id, label, disabled }) => (
      <button
        type="button"
        className={activeTab === id ? "btn-tab active" : "btn-tab"}
        onClick={() => setActiveTab(id)}
        disabled={disabled}
        title={disabled ? "Select a course first" : ""}
      >
        {label}
      </button>
    );

    return (
      <div className="tabs-row">
        <TabBtn id="materials" label="Materials" />
        <TabBtn id="bulk" label="Bulk Uploads" disabled={!selectedCourse} />
        <TabBtn id="guide" label="Course Guide" disabled={!selectedCourse} />
        <TabBtn id="lectures" label="Weekly Lectures" disabled={!selectedCourse} />
        {canAssignCourse && <TabBtn id="assign" label="Assign Instructor" />}
      </div>
    );
  };

  // ---------- MAIN RENDER ----------
  return (
    <div className="fade-in course-folder-page">
      <div className="page-header">
        <h1 className="page-title">Course Folder</h1>
        <p className="page-subtitle">
          Select a course and manage materials, bulk uploads, course guide, and weekly lectures.
        </p>
      </div>

      {pageErr && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {pageErr}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <RoleBadge />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Tabs />
      </div>

      <div className="course-folder-grid">
        {/* LEFT COLUMN */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course</h2>
            <p className="card-subtitle">Your assigned courses appear here.</p>
          </div>

          <div className="card-content">
            <div className="row" style={{ gap: 10 }}>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="form-input"
                style={{ flex: 1 }}
                disabled={coursesLoading || !courses.length}
              >
                <option value="">
                  {coursesLoading
                    ? "Loading..."
                    : courses.length
                      ? "Choose a course..."
                      : "No courses available"}
                </option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code} - {course.course_name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-ghost icon-btn"
                onClick={loadCourses}
                title="Refresh courses"
              >
                <ArrowPathIcon />
                Refresh
              </button>
            </div>

            {!coursesLoading && !courses.length && (
              <div className="warn-box" style={{ marginTop: 12 }}>
                <strong>No courses found for your account.</strong>
                <div style={{ marginTop: 6 }}>
                  If you are a teacher, ask Admin/HOD to assign you a course from the{" "}
                  <strong>Assign Instructor</strong> tab.
                </div>
              </div>
            )}

            {selectedCourseData && (
              <div className="course-details">
                <SectionTitle title="Course Details" />
                <p><strong>Code:</strong> {selectedCourseData.course_code}</p>
                <p><strong>Name:</strong> {selectedCourseData.course_name}</p>
                <p><strong>Semester:</strong> {selectedCourseData.semester} {selectedCourseData.year}</p>
                <p><strong>Department:</strong> {selectedCourseData.department}</p>

                <button
                  type="button"
                  className="btn-primary full"
                  onClick={() => navigate(`/courses/${selectedCourse}/assessments`)}
                  disabled={!selectedCourse}
                >
                  Open Assessments
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {activeTab === "materials"
                ? "Materials"
                : activeTab === "bulk"
                  ? "Bulk Uploads"
                  : activeTab === "guide"
                    ? "Course Guide"
                    : activeTab === "lectures"
                      ? "Weekly Lectures"
                      : "Assign Instructor"}
            </h2>
            <p className="card-subtitle">
              {activeTab === "materials"
                ? "Assignments, quizzes, mid-term and final-term files."
                : activeTab === "bulk"
                  ? "Upload complete course folders (ZIP/PDF/DOCX)."
                  : activeTab === "guide"
                    ? "Upload the official course guide document."
                    : activeTab === "lectures"
                      ? "Upload weekly lectures and check execution status."
                      : "Assign course to a teacher/instructor."}
            </p>
          </div>

          <div className="card-content">
            {!selectedCourse && activeTab !== "assign" ? (
              <div className="empty-state">
                Select a course from the left to continue.
              </div>
            ) : null}

            {/* ===================== TAB: ASSIGN ===================== */}
            {activeTab === "assign" && (
              <div className="assign-card">
                {!canAssignCourse ? (
                  <div style={{ color: "#9a3412" }}>You do not have permission.</div>
                ) : (
                  <>
                    <SectionTitle
                      title="Assign Instructor to Selected Course"
                      subtitle="Choose a course on the left, then assign a teacher."
                    />

                    {!selectedCourse ? (
                      <div className="warn-box">Select a course first.</div>
                    ) : (
                      <>
                        <div className="assign-row">
                          <div className="assign-search">
                            <MagnifyingGlassIcon />
                            <input
                              className="assign-input"
                              placeholder="Search by name / username / email"
                              value={teacherSearch}
                              onChange={(e) => setTeacherSearch(e.target.value)}
                            />
                          </div>

                          <button
                            type="button"
                            className="btn-ghost icon-btn"
                            onClick={loadInstructors}
                          >
                            <ArrowPathIcon />
                            Refresh
                          </button>
                        </div>

                        <select
                          className="form-input"
                          value={selectedTeacherId}
                          onChange={(e) => setSelectedTeacherId(e.target.value)}
                          disabled={instructorsLoading}
                        >
                          <option value="">
                            {instructorsLoading ? "Loading teachers..." : "Choose instructor..."}
                          </option>
                          {(filteredInstructors || []).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name || t.username} {t.email ? `(${t.email})` : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="btn-primary full assign-btn"
                          onClick={handleAssignTeacher}
                          disabled={!selectedCourse || !selectedTeacherId || assigning}
                          style={{ marginTop: 12 }}
                        >
                          <UserPlusIcon />
                          {assigning ? "Assigning..." : "Assign Instructor"}
                        </button>

                        <div className="hint">
                          After assigning, the teacher will see this course in <strong>Courses → My Courses</strong>.
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ===================== TAB: MATERIALS ===================== */}
            {activeTab === "materials" && selectedCourse && (
              <>
                <div className="folders-grid">
                  {FOLDERS.map((f) => {
                    const isActive = activeFolder === f.key;
                    const count = folderFiles[f.key]?.length || 0;
                    return (
                      <div
                        key={f.key}
                        className={`folder-tile2 ${isActive ? "active" : ""}`}
                        onClick={() => setActiveFolder(f.key)}
                      >
                        <div className="folder-top">
                          <div>
                            <div className="folder-title">{f.label}</div>
                            <div className="folder-sub">{count} file(s)</div>
                          </div>
                          <div className="folder-icon" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="folder-header">
                  <div>
                    <div className="folder-h1">
                      {activeFolder
                        ? `${FOLDERS.find((x) => x.key === activeFolder)?.label} Folder`
                        : "Open a folder"}
                    </div>
                    <div className="folder-h2">
                      {activeFolder ? "Click a card to expand and open a file." : "Select any folder tile above."}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="add-material-btn"
                    onClick={openPanel}
                    disabled={!canUploadMaterials || !activeFolder}
                    title={
                      !activeFolder
                        ? "Open a folder first"
                        : canUploadMaterials
                          ? "Upload new material"
                          : "No upload permission"
                    }
                  >
                    <PlusCircleIcon />
                    Upload
                  </button>
                </div>

                {!activeFolder ? (
                  <div className="empty-state">Choose a folder to view files.</div>
                ) : loadingMaterials ? (
                  <div className="empty-state">Loading materials...</div>
                ) : (
                  <div className="materials-list">
                    {(folderFiles[activeFolder] || []).length ? (
                      (folderFiles[activeFolder] || []).map((f) => {
                        const matId = f.materialId;
                        const isExpanded = expandedIds.has(matId);

                        return (
                          <div key={f.id} className="material-card2">
                            <button
                              type="button"
                              className="material-header2"
                              onClick={() => toggleExpanded(matId)}
                            >
                              {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                              <div className="material-text">
                                <div className="material-title2">{f.materialTitle}</div>
                                <div className="material-desc2">{f.materialDescription || "No description"}</div>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="material-body2">
                                <div className="file-row">
                                  <div className="file-left">
                                    <DocumentIcon />
                                    <span>{f.display_name || f.filename}</span>
                                  </div>

                                  <div className="file-actions">
                                    {f.url && (
                                      <a href={f.url} target="_blank" rel="noreferrer" className="file-action-link">
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
                      <div className="empty-state">This folder is empty.</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ===================== TAB: BULK ===================== */}
            {activeTab === "bulk" && selectedCourse && (
              <>
                {!canBulkUpload && (
                  <div className="info-box">
                    Bulk upload is restricted to <strong>Course Lead / HOD / Admin</strong>.
                  </div>
                )}

                <form onSubmit={handleBulkUpload} className="bulk-row" style={{ opacity: canBulkUpload ? 1 : 0.55 }}>
                  <input type="file" multiple onChange={handleBulkFilesFromInput} disabled={bulkUploading || !canBulkUpload} />
                  <button type="submit" className="btn-primary" disabled={bulkUploading || !bulkFiles.length || !canBulkUpload}>
                    {bulkUploading ? "Uploading..." : "Upload Course Folder(s)"}
                  </button>
                  {bulkFiles.length > 0 && !bulkUploading && (
                    <span className="tiny">{bulkFiles.length} file(s) selected</span>
                  )}
                </form>

                <SectionTitle title="Previous uploads" />
                {!bulkUploads.length ? (
                  <p className="muted">No course folders uploaded yet for this course.</p>
                ) : (
                  <div className="upload-list">
                    {bulkUploads.map((u) => {
                      const pct = u.validation_details?.completeness_percentage ?? null;
                      const status = u.validation_status || "unknown";

                      return (
                        <div key={u.id} className="upload-item">
                          <div className="upload-left">
                            <DocumentIcon />
                            <div>
                              <div className="upload-name">{u.filename}</div>
                              <div className="upload-date">
                                {u.upload_date ? new Date(u.upload_date).toLocaleString() : ""}
                              </div>
                            </div>
                          </div>

                          <div className="upload-right">
                            <span className={`status-badge2 ${status}`}>{status}</span>
                            {pct !== null && <span className="tiny">Completeness: {pct}%</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ===================== TAB: GUIDE ===================== */}
            {activeTab === "guide" && selectedCourse && (
              <>
                <SectionTitle title="Upload Course Guide" subtitle="Upload the official course guide (drives weekly execution monitoring)." />
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
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
                    <span style={{ fontSize: 13, color: "#9a3412" }}>Upload disabled for your role.</span>
                  )}
                </div>
              </>
            )}

            {/* ===================== TAB: LECTURES ===================== */}
            {activeTab === "lectures" && selectedCourse && (
              <>
                {executionStatus && (
                  <div
                    style={{
                      background: executionStatus.is_on_track ? "#ecfdf5" : "#fff7ed",
                      border: `1px solid ${executionStatus.is_on_track ? "#bbf7d0" : "#fed7aa"}`,
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 12,
                      color: executionStatus.is_on_track ? "#166534" : "#9a3412",
                      fontSize: 13,
                    }}
                  >
                    <strong>{executionStatus.is_on_track ? "On Track ✅" : "Deviation Detected ⚠️"}</strong>
                    <div style={{ marginTop: 6 }}>
                      Missing Weeks:{" "}
                      <strong>
                        {executionStatus.missing_weeks?.length ? executionStatus.missing_weeks.join(", ") : "None"}
                      </strong>
                    </div>
                  </div>
                )}

                <SectionTitle title="Upload Weekly Lecture" subtitle="Upload lectures week-wise and track execution status." />

                <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                  <div>
                    <label className="small-label">Week</label>
                    <select
                      className="form-input"
                      value={lectureWeek}
                      onChange={(e) => setLectureWeek(Number(e.target.value))}
                      style={{ width: 160 }}
                    >
                      {Array.from({ length: 16 }).map((_, i) => (
                        <option key={i} value={i + 1}>
                          Week {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="small-label">Lecture File</label>
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
                  >
                    {lectureUploading ? "Uploading..." : "Upload Lecture"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------ Add Material Side Panel ------------ */}
      {isPanelOpen && (
        <div className="material-panel-backdrop">
          <div className="material-panel">
            <div className="material-panel-header">
              <div>
                <h2>Add Material</h2>
                <p>
                  Upload file(s) for{" "}
                  {(FOLDERS.find((f) => f.key === activeFolder) || {}).label || "this course"}.
                </p>
              </div>
              <button type="button" className="icon-button" onClick={closePanel} disabled={isSaving}>
                <XMarkIcon />
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
                className={`material-dropzone ${dragActive ? "material-dropzone-active" : ""}`}
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
                <CloudArrowUpIcon />
                <p style={{ marginTop: 8, fontWeight: 800 }}>Drag & drop files here</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 8 }}>
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
                      <div className="row" style={{ gap: 8 }}>
                        <DocumentIcon />
                        <span style={{ fontSize: 13 }}>{f.name}</span>
                      </div>
                      <button
                        type="button"
                        className="file-remove-btn"
                        onClick={() => setMaterialFiles((prev) => prev.filter((_, i) => i !== idx))}
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
              <button type="button" className="btn-primary" onClick={handleSaveMaterial} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-ghost" onClick={closePanel} disabled={isSaving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
