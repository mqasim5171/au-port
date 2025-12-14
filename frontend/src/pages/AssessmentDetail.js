// src/pages/AssessmentDetail.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchAssessment,
  getGradingAudit,
  runGradingAudit,
} from "../api";
import UploadMarksModal from "../components/UploadMarksModal";
import GradingAuditTab from "../components/GradingAuditTab";

export default function AssessmentDetail() {
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [auditData, setAuditData] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchAssessment(assessmentId).then((res) => setAssessment(res.data));
  }, [assessmentId]);

  useEffect(() => {
    if (activeTab === "audit") {
      getGradingAudit(assessmentId).then((res) =>
        setAuditData(res.data)
      );
    }
  }, [activeTab, assessmentId]);

  if (!assessment) return <p>Loading...</p>;

  const handleRunAudit = () => {
    runGradingAudit(assessmentId).then(() => {
      getGradingAudit(assessmentId).then((res) => setAuditData(res.data));
    });
  };

  return (
    <div className="page-container">
      <h1>{assessment.title}</h1>
      <p>
        Type: {assessment.type} • Total Marks: {assessment.total_marks} •
        Weightage: {assessment.weightage}%
      </p>

      <div className="tabs">
        <button
          className={activeTab === "overview" ? "tab active" : "tab"}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={activeTab === "submissions" ? "tab active" : "tab"}
          onClick={() => setActiveTab("submissions")}
        >
          Submissions
        </button>
        <button
          className={activeTab === "audit" ? "tab active" : "tab"}
          onClick={() => setActiveTab("audit")}
        >
          Grading Audit
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="card">
          {/* Show CLO list, date, course, maybe link to Course Execution Monitor */}
          <h3>CLOs</h3>
          <ul>
            {(assessment.clos || []).map((c) => (
              <li key={c.id}>{c.code} – {c.description}</li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "submissions" && (
        <div className="card">
          <div className="card-header">
            <h3>Submissions</h3>
            <button
              className="btn-primary"
              onClick={() => setShowUploadModal(true)}
            >
              Upload Marks (CSV)
            </button>
          </div>
          {/* TODO: call a backend endpoint to get submissions list with students */}
          <p>Later: table of students + marks + file links.</p>

          {showUploadModal && (
            <UploadMarksModal
              assessmentId={assessmentId}
              onClose={() => setShowUploadModal(false)}
            />
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <GradingAuditTab
          auditData={auditData}
          onRunAudit={handleRunAudit}
        />
      )}
    </div>
  );
}
