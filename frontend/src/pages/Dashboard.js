import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "../App.css";

const pill = (bg, fg) => ({
  display: "inline-flex",
  padding: "4px 10px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontWeight: 800,
  fontSize: 12,
});

export default function Dashboard({ user }) {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");

  const [uploads, setUploads] = useState([]);
  const [progress, setProgress] = useState(null);
  const [quality, setQuality] = useState(null);

  const [batches, setBatches] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  const loadBase = async () => {
    setErr("");
    setLoading(true);
    try {
      const cRes = await api.get("/courses");
      const list = cRes.data || [];
      setCourses(list);
      if (!courseId && list.length) setCourseId(list[0].id);

      // feedback batches
      try {
        const bRes = await api.get("/feedback/batches");
        const b = bRes.data || [];
        setBatches(b);
      } catch {
        setBatches([]);
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadCourseData = async (id) => {
    if (!id) return;
    setErr("");

    // load in parallel, but each is optional (don’t break dashboard)
    const tasks = [
      api.get(`/upload/${id}/list`).then((r) => setUploads(r.data || [])).catch(() => setUploads([])),
      api.get(`/courses/${id}/weekly-progress`).then((r) => setProgress(r.data || null)).catch(() => setProgress(null)),
      api.get(`/courses/${id}/quality-score`).then((r) => setQuality(r.data || null)).catch(() => setQuality(null)),
    ];

    await Promise.all(tasks);

    // feedback (latest batch) — optional
    try {
      const latest = (batches && batches.length) ? batches[0] : "";
      if (!latest || !selectedCourse?.course_code) {
        setFeedback(null);
        return;
      }
      const fRes = await api.get("/feedback", {
        params: { batch: latest, course: selectedCourse.course_code },
      });
      setFeedback(fRes.data || null);
    } catch {
      setFeedback(null);
    }
  };

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!courseId) return;
    loadCourseData(courseId);
    // eslint-disable-next-line
  }, [courseId]);

  // when batches arrive, refresh feedback once
  useEffect(() => {
    if (!courseId) return;
    loadCourseData(courseId);
    // eslint-disable-next-line
  }, [batches]);

  const welcomeName = user?.full_name || user?.username || "User";

  const recentUploads = (uploads || []).slice(0, 6);
  const weeksBehind = progress?.weeks_behind || [];
  const overall = quality?.overall_score ?? null;

  if (loading) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading your QA overview…</p>
        </div>
        <div className="card" style={{ padding: 18 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Welcome back, {welcomeName}!</h1>
          <p className="page-subtitle">Live QA overview from uploads, weekly progress, quality score and feedback.</p>
        </div>

        <div style={{ minWidth: 280 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 800 }}>Course</div>
          <select
            className="form-input"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && (
        <div className="card" style={{ border: "1px solid #fecaca", background: "#fff1f2", padding: 14, marginBottom: 16 }}>
          <div style={{ color: "#991b1b", fontWeight: 800 }}>{err}</div>
        </div>
      )}

      {/* Top Stats */}
      <div className="dashboard-grid">
        <div className="stats-card">
          <div className="stats-number">{courses.length}</div>
          <div className="stats-label">Total Courses</div>
        </div>

        <div className="stats-card">
          <div className="stats-number">{uploads?.length || 0}</div>
          <div className="stats-label">Course Folder Uploads</div>
        </div>

        <div className="stats-card">
          <div className="stats-number">{weeksBehind.length}</div>
          <div className="stats-label">Weeks Behind</div>
        </div>

        <div className="stats-card">
          <div className="stats-number">{overall === null ? "—" : `${overall}%`}</div>
          <div className="stats-label">Quality Score</div>
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Uploads */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Course Folder Uploads</h2>
          </div>
          <div className="card-content">
            {!courseId ? (
              <div style={{ color: "#64748b" }}>Select a course.</div>
            ) : recentUploads.length === 0 ? (
              <div style={{ color: "#64748b" }}>No uploads yet for this course.</div>
            ) : (
              recentUploads.map((u, idx) => {
                const status = (u.validation_status || "unknown").toLowerCase();
                const badge =
                  status === "complete" ? pill("#dcfce7", "#166534")
                  : status === "incomplete" ? pill("#fef9c3", "#854d0e")
                  : status === "invalid" ? pill("#fee2e2", "#991b1b")
                  : pill("#e5e7eb", "#111827");

                return (
                  <div key={u.id || idx} style={{ padding: "12px 0", borderBottom: idx < recentUploads.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.filename}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {u.upload_date ? new Date(u.upload_date).toLocaleString() : ""}
                          {typeof u.validation_details?.completeness_percentage === "number"
                            ? ` · Completeness: ${u.validation_details.completeness_percentage}%`
                            : ""}
                        </div>
                      </div>
                      <span style={badge}>{status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Weekly progress + feedback */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course Health</h2>
          </div>
          <div className="card-content">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900 }}>Weekly Progress</div>
              {!progress ? (
                <div style={{ color: "#64748b", marginTop: 6 }}>No weekly progress yet.</div>
              ) : (
                <>
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                    Course: <b>{selectedCourse?.course_code}</b> · Weeks behind: <b>{weeksBehind.length}</b>
                  </div>
                  {weeksBehind.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#991b1b" }}>Behind weeks</div>
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {weeksBehind.slice(0, 16).map((w) => (
                          <span key={w} style={pill("#fee2e2", "#991b1b")}>W{w}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, color: "#166534", fontWeight: 800 }}>On track 🎉</div>
                  )}
                </>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <div style={{ fontWeight: 900 }}>Latest Feedback Snapshot</div>
              {!feedback ? (
                <div style={{ color: "#64748b", marginTop: 6 }}>
                  No feedback loaded (or feedback endpoint not available for this course).
                </div>
              ) : (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={pill("#dcfce7", "#166534")}>Pos: {feedback?.sentiment?.pos ?? 0}</span>
                    <span style={pill("#fef9c3", "#854d0e")}>Neu: {feedback?.sentiment?.neu ?? 0}</span>
                    <span style={pill("#fee2e2", "#991b1b")}>Neg: {feedback?.sentiment?.neg ?? 0}</span>
                  </div>

                  {feedback?.highlights?.negative && (
                    <div style={{ padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2" }}>
                      <div style={{ fontWeight: 900, color: "#991b1b", marginBottom: 4 }}>Key negative highlight</div>
                      <div style={{ color: "#7f1d1d", fontSize: 13 }}>{feedback.highlights.negative}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
