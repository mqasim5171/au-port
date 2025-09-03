import React, { useState, useEffect } from 'react';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    total_courses: 5,
    total_uploads: 12,
    total_feedback: 8,
    recent_uploads: [
      { filename: "CourseOutline.pdf", upload_date: new Date(), validation_status: "approved" },
      { filename: "Syllabus.docx", upload_date: new Date(), validation_status: "pending" },
    ],
    recent_feedback: [
      { feedback_text: "The course material was very helpful", student_name: "Ali", sentiment: "positive" },
      { feedback_text: "The lectures were sometimes too fast", student_name: "Sara", sentiment: "neutral" },
    ]
  });
  const [loading, setLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your academic quality assurance activities</p>
        </div>
        
        <div className="text-center" style={{ padding: '64px' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: '#64748b' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.full_name || user?.username || "User"}!</h1>
        <p className="page-subtitle">Overview of your academic quality assurance activities</p>
      </div>

      <div className="dashboard-grid">
        <div className="stats-card">
          <div className="stats-number">{stats.total_courses}</div>
          <div className="stats-label">Total Courses</div>
        </div>
        
        <div className="stats-card">
          <div className="stats-number">{stats.total_uploads}</div>
          <div className="stats-label">Course Folders</div>
        </div>
        
        <div className="stats-card">
          <div className="stats-number">{stats.total_feedback}</div>
          <div className="stats-label">Student Feedback</div>
        </div>

        <div className="stats-card">
          <div className="stats-number">75%</div>
          <div className="stats-label">Average Compliance</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Uploads</h2>
          </div>
          <div className="card-content">
            {stats.recent_uploads.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                No uploads yet
              </p>
            ) : (
              <div>
                {stats.recent_uploads.map((upload, index) => (
                  <div key={index} style={{ 
                    padding: '12px 0', 
                    borderBottom: index < stats.recent_uploads.length - 1 ? '1px solid #e2e8f0' : 'none' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>{upload.filename}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(upload.upload_date).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`status-badge status-${upload.validation_status}`}>
                        {upload.validation_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Feedback</h2>
          </div>
          <div className="card-content">
            {stats.recent_feedback.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                No feedback yet
              </p>
            ) : (
              <div>
                {stats.recent_feedback.map((feedback, index) => (
                  <div key={index} style={{ 
                    padding: '12px 0', 
                    borderBottom: index < stats.recent_feedback.length - 1 ? '1px solid #e2e8f0' : 'none' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                          {feedback.feedback_text.substring(0, 50)}...
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          by {feedback.student_name}
                        </div>
                      </div>
                      <span className={`sentiment-${feedback.sentiment}`}>
                        {feedback.sentiment}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
