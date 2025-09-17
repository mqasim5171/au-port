// src/layout/Layout.js
import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  HomeIcon, 
  FolderIcon, 
  DocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import api from '../api';
import '../App.css';

const Layout = ({ user: userProp, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(userProp || null);

  // If we reload the app and lose in-memory user, fetch from /api/profile using the stored token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!userProp) {
      api.get('/profile')
        .then(res => setUser(res.data))
        .catch(() => {
          // token might be invalid/expired
          localStorage.removeItem('token');
          navigate('/login');
        });
    }
  }, [userProp, navigate]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Course Folder', href: '/course-folder', icon: FolderIcon },
    { name: 'CLO Alignment', href: '/clo-alignment', icon: DocumentCheckIcon },
    { name: 'Students Feedback', href: '/student-feedback', icon: ChatBubbleLeftRightIcon },
    { name: 'Suggestions', href: '/suggestions', icon: LightBulbIcon },
    { name: 'Reports', href: '/reports', icon: DocumentTextIcon },
  ];

  // Active if current path starts with the item path (so nested routes highlight too)
  const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/');

  const handleLogout = () => {
    try { if (onLogout) onLogout(); } catch {}
    localStorage.removeItem('token');
    navigate('/login');
  };

  const initial =
    (user?.full_name?.trim?.()[0]) ||
    (user?.username?.trim?.()[0]) ||
    'U';

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
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
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
              <h4>{user?.full_name || user?.username || 'User'}</h4>
              <p>
                {(user?.role || 'user')}
                {user?.department ? ` • ${user.department}` : ''}
              </p>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-logout">
            <ArrowRightOnRectangleIcon style={{ width: '16px', marginRight: '8px' }} />
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
