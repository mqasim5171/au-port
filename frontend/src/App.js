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
import api from "./api";
 
import CourseExecutionMonitor from "./pages/CourseExecutionMonitor";
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
        // Bad/expired token: clear and stay logged out
        localStorage.removeItem("token");
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  // IMPORTANT: Login handler should NOT call the API again.
  // Login.jsx already did /auth/login and /auth/me and passes us the user.
  const handleLogin = (me) => {
    setUser(me);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
  };

  if (!bootstrapped) {
    // Optional: show nothing or a tiny loader to avoid flicker
    return null;
  }

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
            <Route element={<Layout user={user} onLogout={handleLogout} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/course-folder" element={<CourseFolder />} />
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
