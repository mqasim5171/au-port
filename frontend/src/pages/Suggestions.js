import React, { useEffect, useState } from "react";
import api from "../api";

function Suggestions() {
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Quality Suggestions</h1>
        <p className="page-subtitle">AI-powered suggestions to enhance course content and delivery</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Select Course</h2>
        </div>
        <div className="card-content">
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
        </div>
      </div>

      {selectedCourse && (
        <>
          {qualityScore ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quality Assessment</h2>
                </div>
                <div className="card-content">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    Course: {courses.find(c => c.id === selectedCourse)?.course_code}
                  </h3>

                  <div style={{ 
                    background: '#f0f9ff', 
                    padding: '20px', 
                    borderRadius: '12px',
                    borderLeft: '4px solid #3b82f6',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>Overall Quality Score</span>
                    </div>
                    <div style={{ 
                      fontSize: '36px', 
                      fontWeight: '700', 
                      color: qualityScore.overall_score >= 80 ? '#10b981' : qualityScore.overall_score >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {qualityScore.overall_score}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {qualityScore.overall_score >= 80 ? 'Excellent' : qualityScore.overall_score >= 60 ? 'Good' : 'Needs Improvement'}
                    </div>
                  </div>

                  {/* Breakdown */}
                  {['completeness_score', 'alignment_score', 'feedback_score'].map((metric, idx) => (
                    <div key={idx} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                          {metric.replace('_score', '').replace(/^\w/, c => c.toUpperCase())}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>
                          {qualityScore[metric]}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ 
                            width: `${qualityScore[metric]}%`,
                            background: qualityScore[metric] >= 80 ? '#10b981' : qualityScore[metric] >= 60 ? '#f59e0b' : '#ef4444'
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggestions */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Improvement Suggestions</h2>
                </div>
                <div className="card-content">
                  {qualityScore.suggestions.length > 0 ? (
                    qualityScore.suggestions.map((s, i) => (
                      <div key={i} style={{ 
                        padding: '16px',
                        background: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        borderLeft: '4px solid #f59e0b'
                      }}>
                        <div style={{ display: 'flex' }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>Suggestion {i + 1}</div>
                            <div style={{ fontSize: '14px', color: '#92400e' }}>{s}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#64748b' }}>No specific suggestions available</p>
                  )}

                  {/* Always show a priority warning */}
                  <div style={{ 
                    padding: '16px',
                    background: '#fee2e2',
                    border: '1px solid #dc2626',
                    borderRadius: '8px',
                    borderLeft: '4px solid #dc2626'
                  }}>
                    <div style={{ display: 'flex' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>Priority Action Required</div>
                        <div style={{ fontSize: '14px', color: '#dc2626' }}>
                          Address negative feedback patterns to improve student satisfaction and effectiveness.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              No quality data available for this course.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default Suggestions;
