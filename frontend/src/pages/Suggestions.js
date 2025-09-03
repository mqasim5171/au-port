import React, { useState, useEffect } from 'react';
import { LightBulbIcon, ChartBarIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import '../App.css';

const Suggestions = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [qualityScore, setQualityScore] = useState(null);
  const [loading, setLoading] = useState(false);

  // Mock data
  const mockCourses = [
    { id: 'CSE101', course_code: 'CSE101', course_name: 'Intro to CS' },
    { id: 'CSE202', course_code: 'CSE202', course_name: 'Data Structures' },
  ];

  const mockScores = {
    CSE101: {
      overall_score: 78,
      completeness_score: 80,
      alignment_score: 70,
      feedback_score: 85,
      suggestions: [
        "Add more real-world examples to improve engagement.",
        "Simplify CLO mapping for easier student understanding."
      ]
    },
    CSE202: {
      overall_score: 55,
      completeness_score: 60,
      alignment_score: 50,
      feedback_score: 55,
      suggestions: [
        "Revise lecture pace to allow students more time to absorb concepts.",
        "Include more diagrams/visuals to support explanations."
      ]
    }
  };

  useEffect(() => {
    // Simulate fetching courses
    setTimeout(() => setCourses(mockCourses), 500);
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchQualityScore();
    }
  }, [selectedCourse]);

  const fetchQualityScore = () => {
    setLoading(true);
    setTimeout(() => {
      setQualityScore(mockScores[selectedCourse] || null);
      setLoading(false);
    }, 800);
  };

  const selectedCourseInfo = courses.find(c => c.id === selectedCourse);

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '16px', color: '#64748b' }}>Analyzing quality score...</p>
            </div>
          ) : qualityScore ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quality Assessment</h2>
                </div>
                <div className="card-content">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    Course: {selectedCourseInfo?.course_code}
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
                      <ChartBarIcon className="w-6 h-6 text-blue-600" style={{ marginRight: '8px' }} />
                      <span style={{ fontWeight: '600' }}>Overall Quality Score</span>
                    </div>
                    <div style={{ 
                      fontSize: '36px', 
                      fontWeight: '700', 
                      color: getScoreColor(qualityScore.overall_score)
                    }}>
                      {qualityScore.overall_score}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {getScoreLabel(qualityScore.overall_score)}
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
                            background: getScoreColor(qualityScore[metric])
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
                          <LightBulbIcon className="w-5 h-5 text-yellow-600" style={{ marginRight: '12px' }} />
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
                      <ExclamationCircleIcon className="w-5 h-5 text-red-600" style={{ marginRight: '12px' }} />
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
};

export default Suggestions;
