// frontend/src/pages/AssessmentDetail.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useParams } from "react-router-dom";

function Badge({ children, tone = "gray" }) {
  const bg =
    tone === "green" ? "#0f5132" :
    tone === "red" ? "#842029" :
    tone === "blue" ? "#084298" :
    "#343a40";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      color: "white",
      background: bg,
      marginLeft: 8,
      whiteSpace: "nowrap"
    }}>
      {children}
    </span>
  );
}

function Card({ title, right, children, style }) {
  return (
    <div className="card" style={{ padding: 18, borderRadius: 14, ...style }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 10
      }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: 14,
      padding: 14,
      background: "rgba(255,255,255,0.65)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap"
      }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function getRollNo(row) {
  // ✅ 1) If backend already sends it
  const direct =
    row.roll_no ||
    row.rollNo ||
    row.student_roll_no ||
    row.studentRollNo ||
    row.student?.roll_no ||
    row.student?.rollNo ||
    row.student?.roll_number ||
    row.student?.rollNumber;

  if (direct) return String(direct);

  // ✅ 2) fallback: parse from filename
  const name =
    row.filename_original ||
    row.filename ||
    row.file_name ||
    row.submission_filename ||
    "";

  if (!name) return "-";

  // common patterns: 21-CS-500_Q_1.pdf, 21CS500_Q_1.docx, 21-CS-500 (anything)
  const m1 = name.match(/(\d{2}[-_ ]?[A-Za-z]{1,4}[-_ ]?\d{2,4})/); // e.g. 21-CS-500
  if (m1) return m1[1].replace(/[_ ]/g, "-");

  const m2 = name.match(/(\d{6,12})/); // numeric roll no
  if (m2) return m2[1];

  return "-";
}

function shortFileName(row) {
  const name =
    row.filename_original ||
    row.filename ||
    row.file_name ||
    row.submission_filename ||
    "";
  if (!name) return "-";
  const base = name.split("/").pop();
  return base.length > 34 ? base.slice(0, 34) + "…" : base;
}

export default function AssessmentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [qFile, setQFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    setErr("");
    const res = await api.get(`/assessments/${id}`);
    setData(res.data);
  };

  useEffect(() => {
    load().catch((e) => setErr(e?.response?.data?.detail || "Load failed"));
    // eslint-disable-next-line
  }, [id]);

  const uploadQuestions = async () => {
    setErr("");
    if (!qFile) return setErr("Select questions PDF/DOCX");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", qFile);
      await api.post(`/assessments/${id}/questions/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload questions failed");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setErr("");
    setBusy(true);
    try {
      await api.post(`/assessments/${id}/generate-expected-answers`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadSubs = async () => {
    setErr("");
    if (!zipFile) return setErr("Select submissions ZIP");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", zipFile);

      const res = await api.post(`/assessments/${id}/submissions/upload-zip`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(
        `ZIP uploaded ✅\nCreated: ${res?.data?.created ?? 0}\nUpdated: ${res?.data?.updated ?? 0}\nSkipped: ${res?.data?.skipped ?? 0}`
      );

      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload ZIP failed");
    } finally {
      setBusy(false);
    }
  };

  const grade = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await api.post(`/assessments/${id}/grade-all`);
      alert(`Grading done ✅\nGraded: ${res?.data?.graded ?? 0}\nFailed: ${res?.data?.failed ?? 0}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Grade failed");
    } finally {
      setBusy(false);
    }
  };

  const meta = useMemo(() => {
    if (!data) return null;
    const { assessment, expected, clo_alignment } = data;
    return { assessment, expected, clo_alignment };
  }, [data]);

  if (!data || !meta) {
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );
  }

  const { assessment, files, expected, clo_alignment } = data;
  const expectedOk = !!expected?.parsed_json;
  const coverPct = Number(clo_alignment?.coverage_percent || 0);

  return (
    <div className="page" style={{ maxWidth: 1150, margin: "0 auto" }}>
      <Card
        title={assessment.title}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={expectedOk ? "green" : "red"}>{expectedOk ? "Expected: Ready" : "Expected: Missing"}</Badge>
            <Badge tone={coverPct >= 70 ? "green" : coverPct >= 40 ? "blue" : "red"}>CLO: {coverPct.toFixed(1)}%</Badge>
          </div>
        }
      >
        <div className="muted" style={{ marginTop: 6 }}>
          Type: <b>{assessment.type}</b> · Max: <b>{assessment.max_marks}</b> · Weight:{" "}
          <b>{assessment.weightage}</b> · Date: <b>{String(assessment.date).slice(0, 10)}</b>
        </div>

        {err && <div className="alert alert-danger" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Panel title="Questions & AI">
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept=".pdf,.docx" onChange={(e) => setQFile(e.target.files?.[0] || null)} />
              <button className="btn-primary" onClick={uploadQuestions} disabled={busy}>
                Upload Questions
              </button>
              <button className="btn" onClick={generate} disabled={busy}>
                Generate Expected + CLO Align
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Uploaded files</div>
              {!!(files || []).length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(files || []).map((f) => (
                    <li key={f.id}>
                      {f.filename_original} <span className="muted">(ext: {f.ext})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No questions file uploaded yet.</div>
              )}
            </div>
          </Panel>

          <Panel title="Results" right={expected?.model ? <span className="muted" style={{ fontSize: 12 }}>model: {expected.model}</span> : null}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>Expected Answers</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{expectedOk ? "Generated ✅" : "Not generated ❌"}</div>
              </div>
              <div style={{ border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>CLO Coverage</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{coverPct.toFixed(1)}%</div>
              </div>
            </div>

            {clo_alignment?.per_clo ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>View CLO breakdown</summary>
                <pre style={{ marginTop: 10, maxHeight: 240, overflow: "auto" }}>
                  {JSON.stringify(clo_alignment.per_clo, null, 2)}
                </pre>
              </details>
            ) : null}

            {expectedOk ? (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>View expected answers JSON</summary>
                <pre style={{ marginTop: 10, maxHeight: 260, overflow: "auto" }}>
                  {JSON.stringify(expected.parsed_json, null, 2)}
                </pre>
              </details>
            ) : null}
          </Panel>
        </div>
      </Card>

      <Card
        title="Student Submissions"
        right={<span className="muted" style={{ fontSize: 12 }}>Upload ZIP → Grade All → See results</span>}
        style={{ marginTop: 16 }}
      >
        <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: 12,
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.65)"
        }}>
          <div style={{ minWidth: 260 }}>
            <div className="muted" style={{ fontSize: 12 }}>Submissions ZIP</div>
            <input type="file" accept=".zip" onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={uploadSubs} disabled={busy}>Upload ZIP</button>
            <button className="btn" onClick={grade} disabled={busy}>Grade All</button>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn" onClick={() => setRefreshKey((k) => k + 1)} disabled={busy}>
              Refresh
            </button>
          </div>
        </div>

        <SubmissionsTable assessmentId={assessment.id} refreshKey={refreshKey} />
      </Card>
    </div>
  );
}

function SubmissionsTable({ assessmentId, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get(`/assessments/${assessmentId}/submissions`);
      setRows(res.data || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [assessmentId, refreshKey]);

  return (
    <div style={{ marginTop: 14 }}>
      {err && <div className="alert alert-danger">{err}</div>}

      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Total: <b>{rows.length}</b> {loading ? " · Loading..." : ""}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Roll No</th>
              <th style={{ width: 170 }}>File</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 90 }}>Marks</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fb = r.ai_feedback || "";
              const marks = r.ai_marks ?? "-";
              const roll = getRollNo(r);
              const file = shortFileName(r);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{roll}</td>
                  <td className="muted" title={r.filename_original || r.filename || ""}>{file}</td>
                  <td>{r.status}</td>
                  <td><b>{marks}</b></td>
                  <td title={fb} style={{ maxWidth: 720 }}>
                    {fb.slice(0, 220)}{fb.length > 220 ? "..." : ""}
                  </td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 16 }}>
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
