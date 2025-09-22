import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import CourseFolder from "./pages/CourseFolder";
import CLOAlignment from "./pages/CLOAlignment";
import StudentFeedback from "./pages/StudentFeedback";
import Suggestions from "./pages/Suggestions";
import Reports from "./pages/Reports";
import api from './api';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Optionally fetch user profile
      api.get('/auth/me').then(res => setUser(res.data)).catch(() => handleLogout());
    }
  }, []);

  const handleLogin = async (username, password) => {
    try {
      const res = await api.post('/login', { username, password });
      setUser(res.data.user);
      localStorage.setItem('token', res.data.access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
    } catch (err) {
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <Router>
      <Routes>
        {!user ? (
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
        ) : (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/course-folder" element={<CourseFolder />} />
            <Route path="/clo-alignment" element={<CLOAlignment />} />
            <Route path="/student-feedback" element={<StudentFeedback />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
        )}
        {/* Redirects */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
