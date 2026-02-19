import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Monitor, Laptop, Camera, ChevronRight, 
  MessageSquare, X, Send, 
  Cctv
} from 'lucide-react';
import Header from '../components/Header';
import io from 'socket.io-client';

const Dashboard = ({ recentMessages = [] }) => {
  const navigate = useNavigate();
  
  // --- UPDATED: Environment Variable Logic ---
  const API_BASE_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

  const [groupStats, setGroupStats] = useState({
    ups: { total: 0, online: 0 },
    lan: { total: 0, online: 0 },
    cctv: { total: 0, online: 0 }
  });

  // Fetch initial stats on component mount
  useEffect(() => {
    // --- UPDATED: Fetching from production URL ---
    fetch(`${API_BASE_URL}/api/engineers/stats`) 
      .then(res => res.json())
      .then(data => {
        if (data) setGroupStats(data);
      })
      .catch(err => console.error("Error fetching stats:", err));
  }, [API_BASE_URL]);

  // Listen for real-time status updates
  useEffect(() => {
    // Create socket connection inside useEffect to prevent multiple instances
    const socket = io(API_BASE_URL);

    const handleStatusUpdate = (data) => {
      console.log("Dashboard - Status update received:", data);
      // Fetch updated stats when status changes
      fetch(`${API_BASE_URL}/api/engineers/stats`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data === 'object') {
            setGroupStats(data);
          }
        })
        .catch(err => console.error("Error fetching updated stats:", err));
    };

    socket.on('status_update', handleStatusUpdate);
    socket.on('update_group_stats', (stats) => setGroupStats(stats)); // Direct stats update from backend
    
    return () => {
      socket.off('status_update', handleStatusUpdate);
      socket.disconnect(); // Cleanup connection when leaving dashboard
    };
  }, [API_BASE_URL]);

  const handleReply = (msg) => {
    navigate(`/chat/${msg.engineer_db_id}`, { 
      state: { 
        engineer: {
          id: msg.engineer_db_id,           
          name: msg.sender,                 
          engineer_id: msg.engineer?.engineer_id || 'ID not available', 
          status: msg.engineer?.status || 'Online',
          group_type: msg.engineer?.group_type || 'ups'
        } 
      } 
    });
  };

  return (
    <div className="dashboard-wrapper">
      <div className="main-content">
        
        {/* --- TOP FLOATING POPUP BANNER --- */}
        {recentMessages.length > 0 && (
          <div className="dashboard-top-popup">
            <div className="popup-inner">
              <div className="notif-icon-box">
                <MessageSquare size={20} color="white" />
                <span className="count-badge">{recentMessages.length}</span>
              </div>
              
              <div className="msg-preview-area">
                <p className="msg-title">New Message from <strong>{recentMessages[0].sender}</strong></p>
                <p className="msg-body">"{recentMessages[0].message_text}"</p>
              </div>

              <div className="popup-actions">
                <button className="dash-reply-btn" onClick={() => handleReply(recentMessages[0])}>
                  Reply Now <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="dashboard-body">
          <Header/>
          <div className="top-row">
            
            <div className="action-card">
              <button className="btn-book"><Plus size={20} /> Book Complaint</button>
              <div className="quick-search">
                <Search size={20} className="search-icon-small" />
                <input type="text" className="small-input" placeholder="Quick Search..." />
              </div>
            </div>

            <div className="stats-container">
              <div className="stat-card"><span>OPEN CALLS</span><h2>18</h2></div>
              <div className="stat-card"><span>PENDING</span><h2>6</h2></div>
              <div className="stat-card"><span>COMPLETED</span><h2>0</h2></div>
              <div className="stat-card"><span>APPROVAL</span><h2>277</h2></div>
            </div>
          </div>

          <section className="groups-section">
            <h2 className="section-title">Engineer Groups</h2>
            <div className="groups-grid">
              <div className="group-card" onClick={() => navigate('/groups/ups')}>
                <ChevronRight className="arrow-icon" />
                <div className="icon-box blue-bg"><Monitor size={32} /></div>
                <h4>UPS Engineers:</h4>
                <p><strong>{groupStats.ups?.online || 0} Online</strong></p>
              </div>
              
              <div className="group-card" onClick={() => navigate('/groups/lan')}>
                <ChevronRight className="arrow-icon" />
                <div className="icon-box green-bg"><Laptop size={32} /></div>
                <h4>LAN Engineers:</h4>
                <p><strong>{groupStats.lan?.online || 0} Online</strong></p>
              </div>

              <div className="group-card" onClick={() => navigate('/groups/cctv')}>
                <ChevronRight className="arrow-icon" />
                <div className="icon-box blue-bg"><Cctv size={32} /></div>
                <h4>CCTV Engineers:</h4>
                <p><strong>{groupStats.cctv?.online || 0} Online</strong></p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
