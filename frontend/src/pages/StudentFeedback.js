import React, { useEffect, useState } from "react";
import api from "../api";

function StudentFeedback() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [newFeedback, setNewFeedback] = useState({ student_name: "", feedback_text: "", rating: 5 });

  useEffect(() => {
    api.get("/courses").then(res => setCourses(res.data));
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      api.get(`/courses/${selectedCourse}/feedback`).then(res => setFeedback(res.data));
    }
  }, [selectedCourse]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post(`/courses/${selectedCourse}/feedback`, { ...newFeedback, course_id: selectedCourse });
    api.get(`/courses/${selectedCourse}/feedback`).then(res => setFeedback(res.data));
    setNewFeedback({ student_name: "", feedback_text: "", rating: 5 });
  };

  return (
    <div>
      <h1>Student Feedback</h1>
      <select onChange={e => setSelectedCourse(e.target.value)} value={selectedCourse}>
        <option value="">Select Course</option>
        {courses.map(course => (
          <option key={course.id} value={course.id}>{course.course_name}</option>
        ))}
      </select>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Student Name"
          value={newFeedback.student_name}
          onChange={e => setNewFeedback({ ...newFeedback, student_name: e.target.value })}
        />
        <textarea
          placeholder="Feedback"
          value={newFeedback.feedback_text}
          onChange={e => setNewFeedback({ ...newFeedback, feedback_text: e.target.value })}
        />
        <input
          type="number"
          min="1"
          max="5"
          value={newFeedback.rating}
          onChange={e => setNewFeedback({ ...newFeedback, rating: Number(e.target.value) })}
        />
        <button type="submit">Submit Feedback</button>
      </form>
      <ul>
        {feedback.map(fb => (
          <li key={fb.id}>{fb.student_name}: {fb.feedback_text} ({fb.sentiment})</li>
        ))}
      </ul>
    </div>
  );
}

export default StudentFeedback;
