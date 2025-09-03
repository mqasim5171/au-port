import React, { useState, useEffect } from 'react';
import { ChatBubbleLeftRightIcon, FaceSmileIcon, FaceFrownIcon, MinusIcon } from '@heroicons/react/24/outline';
import '../App.css';


const StudentFeedback = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    student_name: '',
    feedback_text: '',
    rating: 5
  });

  // Mock data
  const mockCourses = [
    { id: 'CSE101', course_code: 'CSE101', course_name: 'Intro to CS' },
    { id: 'CSE202', course_code: 'CSE202', course_name: 'Data Structures' },
  ];

  const mockFeedback = {
    CSE101: [
      { student_name: 'Ali', feedback_text: 'Great course, very helpful!', rating: 5, sentiment: 'positive' },
      { student_name: 'Sara', feedback_text: 'Too many assignments.', rating: 2, sentiment: 'negative' },
      { student_name: 'Omar', feedback_text: 'It was okay overall.', rating: 3, sentiment: 'neutral' }
    ],
    CSE202: [
      { student_name: 'Hina', feedback_text: 'Loved the examples!', rating: 5, sentiment: 'positive' },
      { student_name: 'Usman', feedback_text: 'Lectures were too fast.', rating: 2, sentiment: 'negative' },
    ]
  };

  useEffect(() => {
    // simulate fetching courses
    setTimeout(() => setCourses(mockCourses), 500);
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchFeedback();
    }
  }, [selectedCourse]);

  const fetchFeedback = () => {
    setLoading(true);
    setTimeout(() => {
      setFeedback(mockFeedback[selectedCourse] || []);
      setLoading(false);
    }, 800);
  };

  const handleSubmitFeedback = (e) => {
    e.preventDefault();

    // sentiment classification mock
    let sentiment = 'neutral';
    if (newFeedback.rating >= 4) sentiment = 'positive';
    if (newFeedback.rating <= 2) sentiment = 'negative';

    const updated = [
      ...feedback,
      { ...newFeedback, sentiment }
    ];

    setFeedback(updated);
    setNewFeedback({ student_name: '', feedback_text: '', rating: 5 });
    setShowForm(false);
    alert('Feedback submitted successfully!');
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return <FaceSmileIcon className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <FaceFrownIcon className="w-4 h-4 text-red-500" />;
      default:
        return <MinusIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentStats = () => {
    if (!feedback.length) return { positive: 0, negative: 0, neutral: 0 };

    const stats = feedback.reduce((acc, item) => {
      acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
      return acc;
    }, {});

    return {
      positive: ((stats.positive || 0) / feedback.length * 100).toFixed(1),
      negative: ((stats.negative || 0) / feedback.length * 100).toFixed(1),
      neutral: ((stats.neutral || 0) / feedback.length * 100).toFixed(1)
    };
  };

  const selectedCourseInfo = courses.find(c => c.id === selectedCourse);
  const sentimentStats = getSentimentStats();

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Student Feedback Analyzer</h1>
        <p className="page-subtitle">Collect and analyze student feedback with sentiment analysis</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Select Course</h2>
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

            {selectedCourse && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn btn-primary"
              >
                {showForm ? 'Cancel' : 'Add Feedback'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showForm && selectedCourse && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h2 className="card-title">Submit Feedback</h2>
          </div>
          <div className="card-content">
            <form onSubmit={handleSubmitFeedback}>
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input
                  type="text"
                  value={newFeedback.student_name}
                  onChange={(e) => setNewFeedback({ ...newFeedback, student_name: e.target.value })}
                  className="form-input"
                  required
                  placeholder="Enter student name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rating (1-5)</label>
                <select
                  value={newFeedback.rating}
                  onChange={(e) => setNewFeedback({ ...newFeedback, rating: parseInt(e.target.value) })}
                  className="form-input"
                >
                  {[1, 2, 3, 4, 5].map(rating => (
                    <option key={rating} value={rating}>{rating}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Feedback</label>
                <textarea
                  value={newFeedback.feedback_text}
                  onChange={(e) => setNewFeedback({ ...newFeedback, feedback_text: e.target.value })}
                  className="form-input"
                  rows="4"
                  required
                  placeholder="Enter detailed feedback about the course"
                />
              </div>

              <button type="submit" className="btn btn-success">
                Submit Feedback
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedCourse && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '16px', color: '#64748b' }}>Loading feedback...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              {/* Sentiment Analysis */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Sentiment Analysis</h2>
                </div>
                <div className="card-content">
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    Course: {selectedCourseInfo?.course_code}
                  </h3>

                  <p>👍 Positive: {sentimentStats.positive}%</p>
                  <p>👎 Negative: {sentimentStats.negative}%</p>
                  <p>😐 Neutral: {sentimentStats.neutral}%</p>
                  <p>Total Feedback: {feedback.length}</p>
                </div>
              </div>

              {/* Feedback Highlights */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Feedback Highlights</h2>
                </div>
                <div className="card-content">
                  {feedback.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748b', padding: '48px' }}>
                      No feedback available for this course
                    </p>
                  ) : (
                    feedback.map((f, i) => (
                      <div key={i} style={{ marginBottom: '12px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                        <p>"{f.feedback_text}"</p>
                        <small>- {f.student_name}, Rating: {f.rating}/5</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentFeedback;
