import React, { useEffect, useState } from "react";
import api from "../api";

export default function WeeklyUpload() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [weekNo, setWeekNo] = useState(1);
  const [zipFile, setZipFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/courses");
        const list = res.data || [];
        setCourses(list);
        if (list.length) setCourseId(list[0].id);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Failed to load courses");
      }
    })();
  }, []);

  const upload = async () => {
    setErr("");
    setResult(null);

    if (!courseId) return setErr("Select a course");
    if (!zipFile) return setErr("Select a ZIP file");

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", zipFile);

      const res = await api.post(
        `/execution/courses/${courseId}/weeks/${weekNo}/weekly-zip`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setResult(res.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  // ✅ helper: normalize backend keys (supports old & new responses)
  const getArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      // if backend ever sends newline-separated strings
      return val
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const coveragePercent =
    typeof result?.coverage_percent === "number"
      ? result.coverage_percent
      : typeof result?.coverage_score === "number"
      ? result.coverage_score * 100
      : 0;

  const missingTopics = getArray(
    result?.missing_terms ?? result?.missing_topics ?? result?.missing
  );

  const matchedTopics = getArray(
    result?.matched_terms ?? result?.matched_topics ?? result?.matched
  );

  return (
    <div className="page">
      <div className="card">
        <h2>Weekly Upload (Instructor)</h2>
        <p className="muted">
          Upload a ZIP containing slides/notes for a week. System compares it with
          Course Lead plan and flags deviation.
        </p>

        {err && <div className="alert alert-danger">{err}</div>}

        <div className="row">
          <div className="field">
            <label>Course</label>
            <select
              className="select"
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

          <div className="field">
            <label>Week</label>
            <select
              className="select"
              value={weekNo}
              onChange={(e) => setWeekNo(Number(e.target.value))}
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Week {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] || null)}
          />
          <button className="btn-primary" onClick={upload} disabled={busy}>
            {busy ? "Uploading..." : "Upload ZIP & Compare"}
          </button>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <p>
            <b>Coverage:</b> {Number(coveragePercent || 0).toFixed(1)}%
          </p>
          <p>
            <b>Status:</b> {result.coverage_status || "—"}
          </p>
          <p>
            <b>Files used:</b> {result.files_used} (seen: {result.files_seen})
          </p>

          <div style={{ marginTop: 10 }}>
            <b>Missing Topics:</b>
            {missingTopics.length === 0 ? (
              <div className="muted" style={{ marginTop: 6 }}>
                No missing topics detected (or plan terms matched).
              </div>
            ) : (
              <ul>
                {missingTopics.slice(0, 25).map((t, idx) => (
                  <li key={`${t}-${idx}`}>{t}</li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <b>Matched Topics:</b>
            {matchedTopics.length === 0 ? (
              <div className="muted" style={{ marginTop: 6 }}>
                No matched topics returned.
              </div>
            ) : (
              <ul>
                {matchedTopics.slice(0, 25).map((t, idx) => (
                  <li key={`${t}-${idx}`}>{t}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Optional debug block - remove if you don't want it */}
          {result.plan_source && (
            <div style={{ marginTop: 12 }} className="muted">
              <div>
                <b>Plan Source:</b> {result.plan_source}
              </div>
              <div>
                <b>Plan Text Len:</b> {result.plan_text_len} | <b>Delivered Len:</b>{" "}
                {result.delivered_text_len}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
