import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CloudArrowUpIcon, DocumentIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import '../App.css';

const CourseFolder = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchUploads();
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/courses');
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchUploads = async () => {
    if (!selectedCourse) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`/courses/${selectedCourse}/uploads`);
      setUploads(response.data);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCourse) return;

    setUploadLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'course_folder');

    try {
      const response = await axios.post(`/courses/${selectedCourse}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert('File uploaded successfully!');
      fetchUploads(); // Refresh uploads list
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'incomplete':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'invalid':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const selectedCourseData = courses.find(c => c.id === selectedCourse);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Folder Management</h1>
        <p className="page-subtitle">Upload and validate course folders for NCEAC compliance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Select Course</h2>
          </div>
          <div className="card-content">
            <select 
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="form-input"
              style={{ marginBottom: '16px' }}
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {selectedCourseData && (
              <div style={{ 
                background: '#f8fafc', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>Course Details</h3>
                <p><strong>Instructor:</strong> {selectedCourseData.instructor}</p>
                <p><strong>Semester:</strong> {selectedCourseData.semester} {selectedCourseData.year}</p>
                <p><strong>Department:</strong> {selectedCourseData.department}</p>
              </div>
            )}

            {selectedCourse && (
              <div className="upload-area">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.zip"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploadLoading}
                />
                <label htmlFor="file-upload" style={{ cursor: uploadLoading ? 'not-allowed' : 'pointer' }}>
                  <CloudArrowUpIcon className="upload-icon" />
                  <div className="upload-text">
                    {uploadLoading ? 'Uploading...' : 'Upload Course Folder'}
                  </div>
                  <div className="upload-subtext">
                    Drag & drop files or click to browse (PDF, ZIP)
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Upload History & Validation</h2>
          </div>
          <div className="card-content">
            {!selectedCourse ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '48px' }}>
                Select a course to view upload history
              </p>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ marginTop: '16px', color: '#64748b' }}>Loading uploads...</p>
              </div>
            ) : uploads.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '48px' }}>
                No uploads found for this course
              </p>
            ) : (
              <div>
                {uploads.map((upload) => (
                  <div key={upload.id} style={{ 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <DocumentIcon className="w-5 h-5 text-gray-400" style={{ marginRight: '8px' }} />
                        <div>
                          <div style={{ fontWeight: '500' }}>{upload.filename}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Uploaded on {new Date(upload.upload_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getStatusIcon(upload.validation_status)}
                        <span className={`status-badge status-${upload.validation_status}`} style={{ marginLeft: '8px' }}>
                          {upload.validation_status}
                        </span>
                      </div>
                    </div>

                    {upload.validation_details && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>
                            Completeness:
                          </span>
                          <span style={{ fontSize: '14px', color: '#059669' }}>
                            {upload.validation_details.completeness_percentage || 0}%
                          </span>
                        </div>
                        
                        <div className="progress-bar" style={{ marginBottom: '12px' }}>
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${upload.validation_details.completeness_percentage || 0}%`,
                              background: upload.validation_details.completeness_percentage >= 80 
                                ? '#10b981' 
                                : upload.validation_details.completeness_percentage >= 60 
                                ? '#f59e0b' 
                                : '#ef4444'
                            }}
                          ></div>
                        </div>

                        {upload.validation_details.missing_items && upload.validation_details.missing_items.length > 0 && (
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                              Missing Items:
                            </div>
                            <div style={{ fontSize: '12px', color: '#dc2626' }}>
                              {upload.validation_details.missing_items.map(item => item.replace('_', ' ')).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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

export default CourseFolder;