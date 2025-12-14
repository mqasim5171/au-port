// src/pages/CourseAssessments.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchCourseAssessments, createAssessment } from "../api";

const FOLDER_TYPES = [
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "midterm", label: "Mid Term" },
  { value: "final", label: "Final" },
];

export default function CourseAssessments() {
  const { courseId } = useParams();
  const [assessments, setAssessments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "quiz",
    total_marks: 10,
    weightage: 5,
    date_conducted: "",
    clo_ids: [],
  });

  useEffect(() => {
    fetchCourseAssessments(courseId).then((res) => setAssessments(res.data));
  }, [courseId]);

  const handleCreate = (e) => {
    e.preventDefault();
    createAssessment(courseId, form).then((res) => {
      setAssessments((prev) => [...prev, res.data]);
      setShowForm(false);
      setForm({
        title: "",
        type: "quiz",
        total_marks: 10,
        weightage: 5,
        date_conducted: "",
        clo_ids: [],
      });
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Assessments</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add new assessment
        </button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={handleCreate} className="form-grid">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {FOLDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Total marks"
              value={form.total_marks}
              onChange={(e) =>
                setForm({ ...form, total_marks: Number(e.target.value) })
              }
            />
            <input
              type="number"
              placeholder="Weightage (%)"
              value={form.weightage}
              onChange={(e) =>
                setForm({ ...form, weightage: Number(e.target.value) })
              }
            />
            <input
              type="date"
              value={form.date_conducted}
              onChange={(e) =>
                setForm({ ...form, date_conducted: e.target.value })
              }
            />
            {/* Later: dropdown for CLOs from existing CLO module */}
            <button className="btn-primary" type="submit">
              Save
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>CLOs</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td>{a.title}</td>
              <td>{a.type}</td>
              <td>{(a.clos || []).map((c) => c.code).join(", ")}</td>
              <td>{a.date_conducted}</td>
              <td>
                <Link to={`/courses/${courseId}/assessments/${a.id}`}>
                  View / Grade
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
