import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  FolderIcon, 
  DocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const Layout = ({ user, onLogout }) => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Course Folder', href: '/course-folder', icon: FolderIcon },
    { name: 'CLO Alignment', href: '/clo-alignment', icon: DocumentCheckIcon },
    { name: 'Students Feedback', href: '/student-feedback', icon: ChatBubbleLeftRightIcon },
    { name: 'Suggestions', href: '/suggestions', icon: LightBulbIcon },
    { name: 'Reports', href: '/reports', icon: DocumentTextIcon },
  ];

  const isActive = (href) => location.pathname === href;

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
            <div className="user-avatar">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <h4>{user?.full_name || user?.username}</h4>
              <p>{user?.role} • {user?.department}</p>
            </div>
          </div>
          
          <button onClick={onLogout} className="btn-logout">
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