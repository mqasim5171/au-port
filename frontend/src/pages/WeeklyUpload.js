import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function fmtBytes(n) {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ height: 10, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
      <div style={{ width: `${v}%`, height: "100%", background: "#2563eb" }} />
    </div>
  );
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    on_track: { bg: "#dcfce7", fg: "#166534", label: "On track" },
    behind: { bg: "#fee2e2", fg: "#991b1b", label: "Behind" },
    skipped: { bg: "#e5e7eb", fg: "#111827", label: "Skipped" },
  };
  const t = map[s] || map.skipped;
  return (
    <span style={{ padding: "4px 10px", borderRadius: 999, background: t.bg, color: t.fg, fontWeight: 700, fontSize: 12 }}>
      {t.label}
    </span>
  );
}

function Collapsible({ title, right, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "#f9fafb",
          border: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontWeight: 800,
          color: "#111827",
        }}
      >
        <span>{title}</span>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          {right}
          <span style={{ opacity: 0.7 }}>{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && <div style={{ padding: 12 }}>{children}</div>}
    </div>
  );
}

export default function WeeklyUpload() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [weekNo, setWeekNo] = useState(1);

  const [zipFile, setZipFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // explorer data
  const [statusSummary, setStatusSummary] = useState(null);
  const [bundle, setBundle] = useState(null); // latest upload + execution + completeness for selected week
  const [files, setFiles] = useState([]);

  // preview blob
  const [preview, setPreview] = useState({ url: "", kind: "", name: "" });
  const previewUrlRef = useRef(""); // to revoke old blob urls

  // progress dashboard
  const [progress, setProgress] = useState(null);

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

  // revoke blob on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  // load summary whenever course changes
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      setErr("");
      try {
        const sum = await api.get(`/courses/${courseId}/weekly-status-summary`);
        setStatusSummary(sum.data);
      } catch {
        setStatusSummary(null);
      }
    })();
  }, [courseId]);

  const refreshProgress = async () => {
    if (!courseId) return;
    try {
      const res = await api.get(`/courses/${courseId}/weekly-progress`);
      setProgress(res.data);
    } catch {
      setProgress(null);
    }
  };

  // load progress whenever course changes
  useEffect(() => {
    if (!courseId) return;
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const refreshWeek = async (w = weekNo) => {
    if (!courseId) return;
    setErr("");
    setBundle(null);
    setFiles([]);

    // clear preview on week change
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreview({ url: "", kind: "", name: "" });

    try {
      const b = await api.get(`/courses/${courseId}/weeks/${w}/latest`);
      setBundle(b.data);

      const up = b.data?.upload;
      if (up?.id) {
        const f = await api.get(`/courses/uploads/${up.id}/files`);
        setFiles(f.data || []);
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load week data");
    }
  };

  useEffect(() => {
    if (!courseId) return;
    refreshWeek(weekNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, weekNo]);

  const uploadZip = async () => {
    setErr("");
    if (!courseId) return setErr("Select a course");
    if (!zipFile) return setErr("Select a ZIP file");

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", zipFile);

      await api.post(`/courses/${courseId}/weeks/${weekNo}/weekly-zip`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setZipFile(null);

      // refresh week & dashboard
      await refreshWeek(weekNo);
      try {
        const sum = await api.get(`/courses/${courseId}/weekly-status-summary`);
        setStatusSummary(sum.data);
      } catch {}
      await refreshProgress();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  // ✅ Auth-safe file preview/download (uses axios with Authorization header)
  const fetchBlobUrl = async (path) => {
    const res = await api.get(path, { responseType: "blob" }); // api includes auth header
    const url = URL.createObjectURL(res.data);
    // revoke old
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    return url;
  };

  const openFile = async (f) => {
    try {
      setErr("");
      const path = f.download_url; // like /courses/uploads/{upload_id}/files/{filename}
      const ext = (f.ext || "").toLowerCase();

      const url = await fetchBlobUrl(path);
      if (ext === "pdf") setPreview({ url, kind: "pdf", name: f.filename });
      else if (["png", "jpg", "jpeg", "webp"].includes(ext)) setPreview({ url, kind: "img", name: f.filename });
      else {
        // non-preview: open blob in new tab
        window.open(url, "_blank");
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to open file");
    }
  };

  const downloadFile = async (f) => {
    try {
      setErr("");
      const url = await fetchBlobUrl(f.download_url);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to download file");
    }
  };

  const exec = bundle?.execution;
  const comp = bundle?.completeness;
  const cov = typeof exec?.coverage_percent === "number" ? exec.coverage_percent : 0;
  const compScore = typeof comp?.score_percent === "number" ? comp.score_percent : null;

  const missingTopics = (exec?.missing_topics || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80);

  const matchedTopics = (exec?.matched_topics || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80);

  const checklistDetails = comp?.details || {};

  // Weeks list from summary, fallback 1..16
  const weeks = useMemo(() => {
    const items = statusSummary?.items || [];
    if (items.length) return items.map((x) => ({ week: x.week_number, status: x.coverage_status }));
    return Array.from({ length: 16 }, (_, i) => ({ week: i + 1, status: "skipped" }));
  }, [statusSummary]);

  // chart data
  const chartData = useMemo(() => {
    const items = progress?.weeks || [];
    return items.map((w) => ({
      week: `W${w.week_no}`,
      coverage: Number(w.coverage_percent || 0),
      completeness: w.completeness_percent === null ? null : Number(w.completeness_percent || 0),
    }));
  }, [progress]);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#111827" }}>Weekly Workspace</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            File explorer per week + course progress dashboard (coverage + completeness).
          </div>
        </div>
        <button className="ghost" onClick={refreshProgress} disabled={!courseId}>
          Refresh Progress
        </button>
      </div>

      {err && (
        <div className="card" style={{ marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2" }}>
          <div style={{ color: "#991b1b", fontWeight: 700 }}>{err}</div>
        </div>
      )}

      {/* ✅ Course Progress View */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, color: "#111827" }}>Course Progress (Weeks 1–16)</h3>
          {selectedCourse && <div className="muted">Course: <b>{selectedCourse.course_code}</b></div>}
        </div>

        {!progress ? (
          <div className="muted" style={{ marginTop: 10 }}>No progress data yet.</div>
        ) : (
          <>
            {/* 16-week grid */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: 10 }}>
              {(progress.weeks || []).map((w) => (
                <button
                  key={w.week_no}
                  type="button"
                  onClick={() => setWeekNo(w.week_no)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 12,
                    border: weekNo === w.week_no ? "2px solid #2563eb" : "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>W{w.week_no}</div>
                    <StatusPill status={w.coverage_status || "skipped"} />
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Coverage</div>
                  <ProgressBar value={w.coverage_percent || 0} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Completeness</div>
                  <ProgressBar value={w.completeness_percent || 0} />
                </button>
              ))}
            </div>

            {/* Trend chart */}
            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: 0, color: "#111827" }}>Coverage Trend</h4>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Track coverage week-to-week (and completeness if available).
              </div>
              <div style={{ width: "100%", height: 260, marginTop: 10 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="coverage" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="completeness" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weeks behind + Top missing topics */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
                <h4 style={{ margin: 0, color: "#111827" }}>Weeks Behind</h4>
                {(progress.weeks_behind || []).length === 0 ? (
                  <div className="muted" style={{ marginTop: 8 }}>None 🎉</div>
                ) : (
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {progress.weeks_behind.map((w) => (
                      <li key={w}>Week {w}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
                <h4 style={{ margin: 0, color: "#111827" }}>Top Missing Topics</h4>
                {(progress.top_missing_topics || []).length === 0 ? (
                  <div className="muted" style={{ marginTop: 8 }}>No missing topics aggregated yet.</div>
                ) : (
                  <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                    {progress.top_missing_topics.slice(0, 12).map((x, idx) => (
                      <li key={`${x.topic}-${idx}`}>
                        {x.topic} <span className="muted">({x.count})</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Explorer layout */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "260px 420px 1fr", gap: 14 }}>
        {/* LEFT: weeks explorer */}
        <div className="card">
          <h3 style={{ marginTop: 0, color: "#111827" }}>Weeks</h3>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Course</label>
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto", paddingRight: 4 }}>
            {weeks.map((w) => (
              <button
                key={w.week}
                type="button"
                onClick={() => setWeekNo(w.week)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 12,
                  border: weekNo === w.week ? "2px solid #2563eb" : "1px solid #e5e7eb",
                  background: weekNo === w.week ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800, color: "#111827" }}>Week {w.week}</div>
                <StatusPill status={w.status} />
              </button>
            ))}
          </div>
        </div>

        {/* MIDDLE: upload + file list */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, color: "#111827" }}>Week {weekNo} Files</h3>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Latest upload: {bundle?.upload?.filename_original ? <b>{bundle.upload.filename_original}</b> : "—"}
              </div>
            </div>
            <button className="ghost" onClick={() => refreshWeek(weekNo)} disabled={!courseId}>
              Refresh
            </button>
          </div>

          <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px dashed #d1d5db", background: "#f9fafb" }}>
            <div style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>Upload ZIP to this week</div>
            <input type="file" accept=".zip" onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
            <button
              className="btn-primary"
              style={{ marginTop: 10, width: "100%", height: 40, borderRadius: 12 }}
              onClick={uploadZip}
              disabled={busy || !zipFile}
            >
              {busy ? "Uploading..." : "Upload to Week"}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, color: "#111827" }}>Files</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Open uses authenticated preview (no 401).
            </div>

            {files.length === 0 ? (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }} className="muted">
                No files yet for this week. Upload a ZIP above.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflow: "auto", paddingRight: 4 }}>
                {files.map((f) => (
                  <div
                    key={f.filename}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.filename}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {f.ext?.toUpperCase()} • {fmtBytes(f.bytes)} • text chars: {f.text_chars}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="ghost" onClick={() => openFile(f)}>Open</button>
                      <button className="ghost" onClick={() => downloadFile(f)}>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: results + preview */}
        <div className="card">
          <h3 style={{ marginTop: 0, color: "#111827" }}>Week {weekNo} QA Results</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Coverage</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#111827", marginTop: 4 }}>{cov.toFixed(1)}%</div>
              <div style={{ marginTop: 8 }}><ProgressBar value={cov} /></div>
              <div style={{ marginTop: 8 }}><StatusPill status={exec?.coverage_status || "skipped"} /></div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Completeness</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#111827", marginTop: 4 }}>
                {compScore === null ? "—" : `${compScore}%`}
              </div>
              <div style={{ marginTop: 8 }}><ProgressBar value={compScore || 0} /></div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                Scope: <b>{comp?.scope || "weekly"}</b>
              </div>
            </div>
          </div>

          <Collapsible title="Missing Topics" right={<span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{missingTopics.length}</span>} defaultOpen={false}>
            {missingTopics.length === 0 ? <div className="muted">No missing topics reported.</div> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {missingTopics.map((t, idx) => <li key={`${t}-${idx}`}>{t}</li>)}
              </ul>
            )}
          </Collapsible>

          <Collapsible title="Matched Topics" right={<span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{matchedTopics.length}</span>} defaultOpen={false}>
            {matchedTopics.length === 0 ? <div className="muted">No matched topics reported.</div> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {matchedTopics.map((t, idx) => <li key={`${t}-${idx}`}>{t}</li>)}
              </ul>
            )}
          </Collapsible>

          <Collapsible title="Checklist Details" defaultOpen={true}>
            {comp?.error ? (
              <div className="alert alert-danger">{comp.error}</div>
            ) : (
              <>
                {Object.keys(checklistDetails).length === 0 ? (
                  <div className="muted">No checklist details returned.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 70px", gap: 8, alignItems: "center" }}>
                    <div className="muted" style={{ fontWeight: 900 }}>Item</div>
                    <div className="muted" style={{ fontWeight: 900 }}>Name</div>
                    <div className="muted" style={{ fontWeight: 900 }}>Text</div>
                    <div className="muted" style={{ fontWeight: 900 }}>OK</div>

                    {Object.keys(checklistDetails).map((k) => {
                      const d = checklistDetails[k];
                      return (
                        <React.Fragment key={k}>
                          <div style={{ fontWeight: 800, color: "#111827" }}>{k}</div>
                          <div style={{ fontSize: 12, color: d.by_name ? "#2563eb" : "#6b7280", fontWeight: 800 }}>
                            {d.by_name ? "Yes" : "No"}
                          </div>
                          <div style={{ fontSize: 12, color: d.by_text ? "#2563eb" : "#6b7280", fontWeight: 800 }}>
                            {d.by_text ? "Yes" : "No"}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: d.ok ? "#166534" : "#991b1b" }}>
                            {d.ok ? "PASS" : "MISS"}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Collapsible>

          <Collapsible title="Preview" defaultOpen={true}>
            {!preview.url ? (
              <div className="muted">Select a PDF/image from the file list and click Open to preview here.</div>
            ) : (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                {preview.kind === "pdf" ? (
                  <iframe title="preview" src={preview.url} style={{ width: "100%", height: 420, border: "none" }} />
                ) : (
                  <img alt={preview.name || "preview"} src={preview.url} style={{ width: "100%", display: "block" }} />
                )}
              </div>
            )}
          </Collapsible>
        </div>
      </div>

      <style>{`
        @media (max-width: 1200px) {
          .page > div[style*="grid-template-columns: 260px 420px 1fr"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1100px) {
          .page .card > div[style*="grid-template-columns: repeat(8"] { grid-template-columns: repeat(4, minmax(0,1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
