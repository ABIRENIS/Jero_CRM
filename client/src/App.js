import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import AddEngineer from './pages/AddEngineer';

// Pages & Components
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import ChatPage from './pages/ChatPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// --- UPDATED: Socket connection ---
// Vercel-la set panna REACT_APP_SERVER_URL-ah use pannum, illana localhost-ku pogum.
const SOCKET_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'] // Better stability for production
});

function App() {
  const [showToast, setShowToast] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // --- 1. STATE & PERSISTENCE ---
  const [unreadStatus, setUnreadStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('jerobyte_unread_status');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('jerobyte_unread_status', JSON.stringify(unreadStatus));
  }, [unreadStatus]);

  // --- 2. GLOBAL SOCKET LISTENER ---
  useEffect(() => {
    const handleGlobalMessage = (data) => {
      if (data.sender_type !== 'admin') {
        setShowToast({
          message: `New message from ${data.sender}`,
          engineerId: data.engineer_db_id,
          engineer: {
            id: data.engineer_db_id,
            name: data.sender,
            engineer_id: data.engineer_id,
            status: data.status || 'Online',
            group_type: data.group_type || 'ups'
          }
        });
        
        setTimeout(() => setShowToast(null), 5000);

        // --- 3. UNREAD LOGIC ---
        const currentChatPath = `/chat/${data.engineer_db_id}`;
        if (location.pathname !== currentChatPath) {
          setUnreadStatus(prev => ({
            ...prev,
            [data.engineer_db_id]: true
          }));
        }
      }
    };

    socket.on("receive_message", handleGlobalMessage);
    return () => socket.off("receive_message", handleGlobalMessage);
  }, [location.pathname]);

  const clearUnread = (id) => {
    setUnreadStatus(prev => {
      if (!prev[id]) return prev; 
      const newStatus = { ...prev };
      delete newStatus[id];
      return newStatus;
    });
  };

  const handleToastClick = () => {
    if (showToast) {
      navigate(`/chat/${showToast.engineerId}`, { 
        state: { engineer: showToast.engineer } 
      });
      setShowToast(null);
    }
  };

  const hasAnyUnread = Object.keys(unreadStatus).length > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      <Sidebar unreadCount={hasAnyUnread ? 1 : 0} />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#f8f9fa' }}>
        
        {showToast && (
          <div 
            onClick={handleToastClick}
            className="global-toast"
            style={{
              position: 'fixed', top: '20px', right: '20px',
              background: '#1b4e8c', color: 'white',
              padding: '15px 25px', borderRadius: '8px', zIndex: 10000,
              boxShadow: '0 5px 15px rgba(0,0,0,0.3)', fontWeight: 'bold',
              borderLeft: '5px solid #28a745', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: '5px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>💬</span> {showToast.message} 
            </div>
            <small style={{ fontSize: '0.7rem', color: '#ccc', textAlign: 'right' }}>
              Click to reply
            </small>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard unreadStatus={unreadStatus} />} />
            <Route path="/groups" element={<Groups unread={unreadStatus} />} />
            <Route path="/groups/:type" element={<Groups unread={unreadStatus} />} />
            <Route path="/AddEngineer" element={<AddEngineer />} />
            <Route path="/chat/:id" element={<ChatPage socket={socket} clearUnread={clearUnread} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
