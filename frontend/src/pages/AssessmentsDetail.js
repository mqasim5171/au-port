// frontend/src/pages/AssessmentDetail.js
import React, { useEffect, useState } from "react";
import api from "../api";
import { useParams } from "react-router-dom";

export default function AssessmentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [qFile, setQFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ key to force submissions refresh
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

      alert(`ZIP uploaded ✅\nCreated: ${res?.data?.created ?? 0}\nUpdated: ${res?.data?.updated ?? 0}\nSkipped: ${res?.data?.skipped ?? 0}`);

      // ✅ refresh table immediately
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

      // ✅ refresh table immediately
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Grade failed");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="page"><div className="card">Loading...</div></div>;

  const { assessment, files, expected, clo_alignment } = data;

  return (
    <div className="page">
      <div className="card">
        <h2>{assessment.title}</h2>
        <p className="muted">
          Type: {assessment.type} | Max marks: {assessment.max_marks} | Weightage: {assessment.weightage} | Date: {String(assessment.date).slice(0, 10)}
        </p>

        {err && <div className="alert alert-danger">{err}</div>}

        <div className="row" style={{ marginTop: 10 }}>
          <input type="file" accept=".pdf,.docx" onChange={(e) => setQFile(e.target.files?.[0] || null)} />
          <button className="btn-primary" onClick={uploadQuestions} disabled={busy}>
            Upload Questions
          </button>

          <button className="btn" onClick={generate} disabled={busy}>
            Generate Expected Answers + CLO Alignment
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <b>Questions Files:</b>
          <ul>
            {(files || []).map((f) => (
              <li key={f.id}>{f.filename_original} (ext: {f.ext})</li>
            ))}
          </ul>
        </div>

        <hr />

        <div>
          <b>Expected Answers:</b>{" "}
          {expected?.parsed_json ? "✅ Generated" : "❌ Not generated"}
          {expected?.model && <span className="muted"> (model: {expected.model})</span>}
          {expected?.parsed_json && (
            <pre style={{ marginTop: 10, maxHeight: 300, overflow: "auto" }}>
              {JSON.stringify(expected.parsed_json, null, 2)}
            </pre>
          )}
        </div>

        <hr />

        <div>
          <b>CLO Alignment:</b>{" "}
          {clo_alignment ? `${Number(clo_alignment.coverage_percent || 0).toFixed(1)}%` : "—"}
          {clo_alignment?.per_clo && (
            <pre style={{ marginTop: 10, maxHeight: 240, overflow: "auto" }}>
              {JSON.stringify(clo_alignment.per_clo, null, 2)}
            </pre>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Student Submissions</h3>
        <div className="row">
          <input type="file" accept=".zip" onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
          <button className="btn-primary" onClick={uploadSubs} disabled={busy}>Upload ZIP</button>
          <button className="btn" onClick={grade} disabled={busy}>Grade All</button>
        </div>

        <SubmissionsTable assessmentId={assessment.id} refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function SubmissionsTable({ assessmentId, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await api.get(`/assessments/${assessmentId}/submissions`);
      setRows(res.data || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load submissions");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [assessmentId, refreshKey]); // ✅ reload after upload/grade

  return (
    <div style={{ marginTop: 12 }}>
      {err && <div className="alert alert-danger">{err}</div>}
      <button className="btn" onClick={load}>Refresh</button>

      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Marks</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fb = r.ai_feedback || "";
            return (
              <tr key={r.id}>
                <td>{r.status}</td>
                <td>{r.ai_marks ?? "-"}</td>
                <td title={fb} style={{ maxWidth: 500 }}>
                  {fb.slice(0, 180)}{fb.length > 180 ? "..." : ""}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={3} className="muted">No submissions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
