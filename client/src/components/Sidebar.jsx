import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ChevronDown, ChevronRight } from 'lucide-react';

// App.js-la irundhu vara boolean status (true/false) ah vangurom
const Sidebar = ({ unreadCount = 0 }) => {
  const navigate = useNavigate(); 
  const location = useLocation();
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const toggleSubMenu = (e) => {
    e.stopPropagation(); 
    setIsGroupsOpen(!isGroupsOpen);
  };

  return (
    <aside className="sidebar">
      <div className="logo-section" onClick={() => handleNavigation('/')} style={{cursor: 'pointer'}}>
        <div className="logo-box">j</div>
        <span>Jerobyte</span>
      </div>

      <nav className="nav-links">
        {/* Dashboard Action */}
        <div 
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => handleNavigation('/')}
        >
          <div className="nav-item-content">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
        </div>

        {/* Groups Action with Simple Red Dot */}
        <div className="menu-group">
          <div 
            className={`nav-item ${location.pathname.includes('/groups') ? 'active' : ''}`}
            onClick={() => handleNavigation('/groups')} 
            style={{ position: 'relative' }} 
          >
            <div className="nav-item-content">
              <Users size={20} />
              <span>Groups</span>

              {/* --- SIMPLE RED DOT INDICATOR --- */}
              {unreadCount > 0 && (
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#ef4444',
                  borderRadius: '50%',
                  marginLeft: '10px',
                  boxShadow: '0 0 5px rgba(239, 68, 68, 0.8)',
                  flexShrink: 0
                }}></div>
              )}
            </div>
            
            <div onClick={toggleSubMenu} className="arrow-btn">
              {isGroupsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </div>

          {isGroupsOpen && (
            <div className="sub-menu show">
              <div onClick={() => handleNavigation('/groups/ups')} className="sub-nav-item">UPS Engineers</div>
              <div onClick={() => handleNavigation('/groups/lan')} className="sub-nav-item">LAN Engineers</div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;