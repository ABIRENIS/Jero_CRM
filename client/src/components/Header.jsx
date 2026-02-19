import React from 'react';
import { Search, Bell, User } from 'lucide-react';
import '../styles/Dashboard.css'; // Reusing your dashboard styles for consistency

const Header = () => {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">Easy Profit - A CRM Software</h1>
      </div>

      <div className="header-right">
        {/* Main Search Bar */}
      

        {/* Action Icons */}
        <div className="header-actions">
          <button className="icon-btn">
            <Bell size={20} />
            <span className="notification-badge"></span>
          </button>
          
            
          </div>
        </div>
    
    </header>
  );
};

export default Header;