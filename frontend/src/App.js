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
import CourseExecutionMonitor from "./pages/CourseExecutionMonitor";
import Admin from "./pages/Admin";
import CourseGuideUpload from "./pages/CourseGuideUpload";
import WeeklyUpload from "./pages/WeeklyUpload";

import CourseAssessments from "./pages/CourseAssessments";
import AssessmentDetail from "./pages/AssessmentDetail";

import api from "./api";

function App() {
  const [user, setUser] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Rehydrate from localStorage and validate token once
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setBootstrapped(true);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    (async () => {
      try {
        const me = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me.data);
      } catch {
        localStorage.removeItem("token");
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  // Login handler
  const handleLogin = (me) => setUser(me);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  };

  if (!bootstrapped) return null;

  return (
    <Router>
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* ✅ All logged-in pages live under Layout */}
            <Route element={<Layout user={user} onLogout={handleLogout} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/course-folder" element={<CourseFolder />} />

              <Route path="/weekly-upload" element={<WeeklyUpload />} />


              <Route path="/course-guide" element={<CourseGuideUpload user={user} />} />


              {/* ✅ Admin page (Layout shows link only for admins) */}
              <Route path="/admin" element={<Admin user={user} />} />

              {/* ✅ Assessments routes */}
              <Route path="/courses/:courseId/assessments" element={<CourseAssessments />} />
              <Route path="/assessments/:id" element={<AssessmentDetail />} />

              <Route path="/clo-alignment" element={<CLOAlignment />} />
              <Route path="/student-feedback" element={<StudentFeedback />} />
              <Route path="/suggestions" element={<Suggestions />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/execution" element={<CourseExecutionMonitor />} />

              {/* convenience: hit "/" goes to dashboard when logged in */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
