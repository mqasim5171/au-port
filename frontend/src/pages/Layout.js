// src/pages/Layout.js
import React, { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  FolderIcon,
  DocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  BellIcon,
  Cog6ToothIcon, // Admin
  AcademicCapIcon, // Course Guide
  ArrowUpTrayIcon, // Weekly Upload
  ClipboardDocumentListIcon, // ✅ Assessments
} from "@heroicons/react/24/outline";

import api from "../api";
import "../App.css";

const Layout = ({ user: userProp, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(userProp || null);
  const roleLower = (user?.role || "").toLowerCase();

  // ✅ Role flags
  const isAdmin = useMemo(() => roleLower.includes("admin"), [roleLower]);

  const isCourseLead = useMemo(
    () => roleLower.includes("course_lead") || isAdmin,
    [roleLower, isAdmin]
  );

  const isInstructor = useMemo(() => {
    // include faculty/instructor; admin also allowed
    return (
      isAdmin ||
      roleLower.includes("instructor") ||
      roleLower.includes("faculty")
    );
  }, [roleLower, isAdmin]);

  // ✅ can access assessments (you can tighten this later)
  const canAssess = useMemo(
    () => isAdmin || isCourseLead || isInstructor,
    [isAdmin, isCourseLead, isInstructor]
  );

  // Rehydrate user if refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (userProp) {
      setUser(userProp);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login");
      });
  }, [userProp, navigate]);

  const navigation = useMemo(() => {
    return [
      { name: "Dashboard", href: "/dashboard", icon: HomeIcon },

      ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Cog6ToothIcon }] : []),

     


      ...(isCourseLead
        ? [{ name: "Course Guide", href: "/course-guide", icon: AcademicCapIcon }]
        : []),

      ...(isInstructor
        ? [{ name: "Weekly Upload", href: "/weekly-upload", icon: ArrowUpTrayIcon }]
        : []),

      ...(canAssess
        ? [{ name: "Assessments", href: "/assessments", icon: ClipboardDocumentListIcon }]
        : []),

      { name: "Course Folder", href: "/course-folder", icon: FolderIcon },
      { name: "CLO Alignment", href: "/clo-alignment", icon: DocumentCheckIcon },
      { name: "Students Feedback", href: "/student-feedback", icon: ChatBubbleLeftRightIcon },
      { name: "Suggestions", href: "/suggestions", icon: LightBulbIcon },
      { name: "Reports", href: "/reports", icon: DocumentTextIcon }, 
     
      { name: "Execution Monitor", href: "/execution", icon: ChartBarIcon },
 ...(isAdmin ? [{ name: "Reminders", href: "/reminders", icon: BellIcon }] : []),
    ];
  }, [isAdmin, isCourseLead, isInstructor, canAssess]);

  const isActive = (href) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = () => {
    try {
      if (onLogout) onLogout();
    } catch {}
    localStorage.removeItem("token");
    navigate("/login");
  };

  const initial =
    (user?.full_name?.trim?.()[0]) ||
    (user?.username?.trim?.()[0]) ||
    "U";

  return (
    <div className="layout-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">AIR QA Portal</h1>
          <p className="sidebar-subtitle">Quality Assurance System</p>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-item ${isActive(item.href) ? "active" : ""}`}
              >
                <Icon className="nav-icon" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initial}</div>
            <div className="user-details">
              <h4>{user?.full_name || user?.username || "User"}</h4>
              <p>
                {user?.role || "user"}
                {user?.department ? ` • ${user.department}` : ""}
              </p>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-logout">
            <ArrowRightOnRectangleIcon style={{ width: "16px", marginRight: "8px" }} />
            Logout
          </button>
        </div>
      </div>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
