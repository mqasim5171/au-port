import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import CourseFolder from "./pages/CourseFolder";
import CLOAlignment from "./pages/CLOAlignment";
import StudentFeedback from "./pages/StudentFeedback";
import Suggestions from "./pages/Suggestions";
import Reports from "./pages/Reports";

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (username, password) => {
    // for frontend demo → set a dummy user
    setUser({
      username,
      full_name: "Ayesha Munir",
      role: "Faculty",
      department: "IT",
    });
  };

  const handleLogout = () => {
    setUser(null);
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
