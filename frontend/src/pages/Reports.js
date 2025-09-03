import React, { useEffect, useState } from "react";
import api from "../api";
import { DocumentTextIcon, ArrowDownTrayIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import '../App.css';

function Reports() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [qualityScore, setQualityScore] = useState(null);

  useEffect(() => {
    api.get("/courses").then(res => setCourses(res.data));
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      api.get(`/courses/${selectedCourse}/quality-score`).then(res => setQualityScore(res.data));
    }
  }, [selectedCourse]);

  const downloadReport = () => {
    if (!qualityScore) return;

    const reportContent = `
AIR QA PORTAL - QA REPORT
=========================
Course: ${selectedCourse}
Overall Quality Score: ${qualityScore.overall_score}%
CLOs: ${qualityScore.clos ? qualityScore.clos.join(', ') : 'N/A'}
Uploads: ${qualityScore.uploads ? qualityScore.uploads.length : 0}
Feedback Entries: ${qualityScore.feedback ? qualityScore.feedback.length : 0}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCourse}_QA_Report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">QA Reports</h1>
        <p className="page-subtitle">Generate comprehensive quality assurance reports</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Generate Report</h2>
        </div>
        <div className="card-content">
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
              style={{ maxWidth: '400px' }}
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {qualityScore && (
              <button onClick={downloadReport} className="btn btn-success">
                <ArrowDownTrayIcon className="w-4 h-4" style={{ marginRight: '8px' }} />
                Download Report
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedCourse && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course: {selectedCourse}</h2>
          </div>
          <div className="card-content">
            {qualityScore ? (
              <div>
                <p><strong>Overall Score:</strong> {qualityScore.overall_score}%</p>
                <p><strong>Completeness:</strong> {qualityScore.completeness_score}%</p>
                <p><strong>Alignment:</strong> {qualityScore.alignment_score}%</p>
                <p><strong>Feedback Score:</strong> {qualityScore.feedback_score}%</p>
              </div>
            ) : (
              <p>Loading quality score...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
