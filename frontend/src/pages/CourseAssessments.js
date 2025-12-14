import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../App.css";

const extractErr = (e) => {
  const d = e?.response?.data;
  if (!d) return e?.message || "Request failed";
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) return d.detail.map((x) => x?.msg || "").join(", ");
  return JSON.stringify(d);
};

export default function CourseAssessments() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageErr, setPageErr] = useState("");

  // create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "quiz",
    total_marks: 10,
    weightage: 5,
    date_conducted: "",
    clo_ids: [],
  });

  const load = async () => {
    setLoading(true);
    setPageErr("");
    try {
      const res = await api.get(`/courses/${courseId}/assessments`);
      setAssessments(res.data || []);
    } catch (e) {
      setPageErr(extractErr(e));
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [courseId]);

  const createAssessment = async () => {
    if (!form.title.trim()) return alert("Enter title");
    if (!form.date_conducted) return alert("Select date");
    setSaving(true);
    setPageErr("");
    try {
      await api.post(`/courses/${courseId}/assessments`, {
        ...form,
        title: form.title.trim(),
        total_marks: Number(form.total_marks),
        weightage: Number(form.weightage),
      });
      setOpenCreate(false);
      setForm({ title: "", type: "quiz", total_marks: 10, weightage: 5, date_conducted: "", clo_ids: [] });
      await load();
    } catch (e) {
      setPageErr(extractErr(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">
            Create quizzes/assignments, upload marks & solutions, then run grading audit for consistency.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <button className="btn-ghost" onClick={() => navigate("/course-folder")}>
            Back
          </button>
          <button className="btn-primary" onClick={() => setOpenCreate(true)}>
            + Add Assessment
          </button>
        </div>
      </div>

      {pageErr && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {pageErr}
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="card-title">All Assessments</h2>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="card-content">
          {loading ? (
            <p style={{ color: "#64748b", padding: 12 }}>Loading assessments…</p>
          ) : assessments.length === 0 ? (
            <div style={{ padding: 18, color: "#64748b" }}>
              <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>No assessments yet</div>
              <div style={{ fontSize: 14 }}>
                Click <b>+ Add Assessment</b> to create one. Then you can upload marks, solutions and run grading audit.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Title</th>
                    <th style={th}>Type</th>
                    <th style={th}>Total</th>
                    <th style={th}>Weight%</th>
                    <th style={th}>Date</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id}>
                      <td style={tdStrong}>{a.title}</td>
                      <td style={td}>{a.type}</td>
                      <td style={td}>{a.total_marks}</td>
                      <td style={td}>{a.weightage}</td>
                      <td style={td}>{String(a.date_conducted || "").slice(0, 10)}</td>
                      <td style={td}>
                        <button className="btn-primary" onClick={() => navigate(`/assessments/${a.id}`)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Assessment Modal */}
      {openCreate && (
        <div className="material-panel-backdrop">
          <div className="material-panel" style={{ maxWidth: 720 }}>
            <div className="material-panel-header">
              <div>
                <h2>Create Assessment</h2>
                <p>Set title, type, marks, weightage, and date.</p>
              </div>
              <button className="icon-button" onClick={() => setOpenCreate(false)} disabled={saving}>
                ✕
              </button>
            </div>

            <div className="material-panel-body">
              <label className="field-label">Title *</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label className="field-label">Type</label>
                  <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="quiz">Quiz</option>
                    <option value="assignment">Assignment</option>
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Date Conducted *</label>
                  <input className="form-input" type="date" value={form.date_conducted} onChange={(e) => setForm({ ...form, date_conducted: e.target.value })} />
                </div>

                <div>
                  <label className="field-label">Total Marks</label>
                  <input className="form-input" type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} />
                </div>

                <div>
                  <label className="field-label">Weightage (%)</label>
                  <input className="form-input" type="number" value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} />
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
                CLO mapping will be added next (multi-select). For now you can create & grade assessments first.
              </div>
            </div>

            <div className="material-panel-footer">
              <button className="btn-primary" onClick={createAssessment} disabled={saving}>
                {saving ? "Saving..." : "Create"}
              </button>
              <button className="btn-ghost" onClick={() => setOpenCreate(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#475569" };
const td = { padding: 10, borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#0f172a" };
const tdStrong = { ...td, fontWeight: 600 };
