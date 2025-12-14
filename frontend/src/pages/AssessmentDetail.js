import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "./api";

import UploadMarkModal from "../components/UploadMarkModal";
import GradingAuditTab from "../components/GradingAuditTab";

const AssessmentDetail = () => {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    api.get(`/assessments/${id}`).then(res => setAssessment(res.data));
    api.get(`/assessments/${id}/submissions`).then(res => setSubmissions(res.data));
  }, [id]);

  if (!assessment) return <p>Loading...</p>;

  return (
    <div>
      <h2>{assessment.title}</h2>
      <p>
        {assessment.type} | Total Marks: {assessment.total_marks}
      </p>

      {/* -------- Submissions -------- */}
      <h3>Student Submissions</h3>

      <button onClick={() => setShowUpload(true)}>
        Upload Marks (CSV)
      </button>

      <table>
        <thead>
          <tr>
            <th>Reg No</th>
            <th>Marks</th>
            <th>Solution</th>
          </tr>
        </thead>

        <tbody>
          {submissions.map(s => (
            <tr key={s.id}>
              <td>{s.reg_no}</td>
              <td>{s.obtained_marks ?? "-"}</td>
              <td>
                {s.file_upload_id ? (
                  <a href={`/api/uploads/${s.file_upload_id}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : (
                  "Not uploaded"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* -------- Modals / Components -------- */}
      {showUpload && (
        <UploadMarkModal
          assessmentId={id}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            api.get(`/assessments/${id}/submissions`)
              .then(res => setSubmissions(res.data));
          }}
        />
      )}

      {/* -------- Grading Audit -------- */}
      <GradingAuditTab assessmentId={id} />
    </div>
  );
};

export default AssessmentDetail;
