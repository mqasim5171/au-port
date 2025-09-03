import React, { useState, useEffect } from 'react';
import { DocumentTextIcon, ArrowDownTrayIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import '../App.css';

const Reports = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Mock data (instead of backend API)
  const mockCourses = [
    { id: 'CSE101', course_code: 'CSE101', course_name: 'Intro to CS', instructor: 'Dr. Ayesha', semester: 'Spring', year: 2025, department: 'CS', clos: ['Understand basics', 'Problem-solving'] },
    { id: 'CSE202', course_code: 'CSE202', course_name: 'Data Structures', instructor: 'Prof. Ali', semester: 'Fall', year: 2025, department: 'CS', clos: ['Implement DS', 'Analyze algorithms'] },
  ];

  const mockUploads = [
    { filename: 'Course Outline.pdf', validation_status: 'complete' },
    { filename: 'Assignments.zip', validation_status: 'pending' },
  ];

  const mockFeedback = [
    { sentiment: 'positive' },
    { sentiment: 'positive' },
    { sentiment: 'neutral' },
    { sentiment: 'negative' },
  ];

  const mockQuality = {
    overall_score: 78,
    completeness_score: 80,
    alignment_score: 75,
    feedback_score: 70,
    suggestions: ['Add more assignments', 'Improve lecture notes'],
  };

  useEffect(() => {
    // simulate fetching courses
    setTimeout(() => setCourses(mockCourses), 500);
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      generateReport();
    }
  }, [selectedCourse]);

  const generateReport = () => {
    setLoading(true);
    setTimeout(() => {
      const course = mockCourses.find((c) => c.id === selectedCourse);
      setReportData({
        course,
        uploads: mockUploads,
        feedback: mockFeedback,
        quality: mockQuality,
      });
      setLoading(false);
    }, 1000); // simulate API delay
  };

  const downloadReport = () => {
    if (!reportData) return;

    const reportContent = `
AIR QA PORTAL - QA REPORT
=========================
Course: ${reportData.course.course_code} - ${reportData.course.course_name}
Instructor: ${reportData.course.instructor}
Semester: ${reportData.course.semester} ${reportData.course.year}
Department: ${reportData.course.department}

Overall Quality Score: ${reportData.quality.overall_score}%
CLOs: ${reportData.course.clos.join(', ')}
Uploads: ${reportData.uploads.length}
Feedback Entries: ${reportData.feedback.length}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.course.course_code}_QA_Report.txt`;
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

            {reportData && (
              <button onClick={downloadReport} className="btn btn-success">
                <ArrowDownTrayIcon className="w-4 h-4" style={{ marginRight: '8px' }} />
                Download Report
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedCourse && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '16px', color: '#64748b' }}>Generating report...</p>
            </div>
          ) : reportData ? (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Course: {reportData.course.course_name}</h2>
              </div>
              <div className="card-content">
                <p><strong>Instructor:</strong> {reportData.course.instructor}</p>
                <p><strong>Department:</strong> {reportData.course.department}</p>
                <p><strong>Overall Score:</strong> {reportData.quality.overall_score}%</p>
                <p><strong>Total Uploads:</strong> {reportData.uploads.length}</p>
                <p><strong>Feedback Entries:</strong> {reportData.feedback.length}</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-content">
                <p>No data found for this course.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
