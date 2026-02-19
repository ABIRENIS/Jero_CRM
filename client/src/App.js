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

// Socket connection - Backend URL-ah sariyaa check pannikonga
const socket = io.connect("http://localhost:5000");

function App() {
  const [showToast, setShowToast] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // --- 1. STATE & PERSISTENCE ---
  // Unread messages irukkira engineers-oda ID-kalai inga store pannuvom
  const [unreadStatus, setUnreadStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('jerobyte_unread_status');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      return {};
    }
  });

  // LocalStorage update logic
  useEffect(() => {
    localStorage.setItem('jerobyte_unread_status', JSON.stringify(unreadStatus));
  }, [unreadStatus]);

  // --- 2. GLOBAL SOCKET LISTENER ---
  useEffect(() => {
    const handleGlobalMessage = (data) => {
      // Admin anuppura message-ku notification thevai illai
      if (data.sender_type !== 'admin') {
        
        // Notification Toast-kaana data-vai set pannuvom
        setShowToast({
          message: `New message from ${data.sender}`,
          engineerId: data.engineer_db_id,
          // ChatPage header-ku thevaiyaana full object
          engineer: {
            id: data.engineer_db_id,
            name: data.sender,
            engineer_id: data.engineer_id,
            status: data.status || 'Online',
            group_type: data.group_type || 'ups'
          }
        });
        
        // 5 seconds-kku apram toast-ah maraikka
        setTimeout(() => setShowToast(null), 5000);

        // --- 3. UNREAD LOGIC ---
        // User ippo andha engineer-oda chat-kulla illana mattum red dot kaattuvom
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

  // Red dot-ah remove panna intha function-ah ChatPage-ku anupuvom
  const clearUnread = (id) => {
    setUnreadStatus(prev => {
      if (!prev[id]) return prev; // Adhu munaadiye illana state update panna thevai illai
      const newStatus = { ...prev };
      delete newStatus[id];
      return newStatus;
    });
  };

  // Toast-ah click panna chat page-ku state-oda kooti pogum
  const handleToastClick = () => {
    if (showToast) {
      navigate(`/chat/${showToast.engineerId}`, { 
        state: { engineer: showToast.engineer } 
      });
      setShowToast(null);
    }
  };

  // Check if ANY engineer has an unread message for Sidebar indicator
  const hasAnyUnread = Object.keys(unreadStatus).length > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* 1. GLOBAL SIDEBAR: Indha setup-ala dhaan dot Dashboard-layum thiriyum */}
      <Sidebar unreadCount={hasAnyUnread ? 1 : 0} />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#f8f9fa' }}>
        
        {/* 2. GLOBAL CLICKABLE TOAST */}
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
              display: 'flex', flexDirection: 'column', gap: '5px',
              animation: 'slideIn 0.3s ease-out'
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

        {/* 3. MAIN CONTENT AREA (ROUTES) */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            {/* Dashboard-ku 'unreadStatus' object-ah pass pannuroam counts-kaaga */}
            <Route path="/" element={<Dashboard unreadStatus={unreadStatus} />} />
            
            <Route path="/groups" element={<Groups unread={unreadStatus} />} />
            <Route path="/groups/:type" element={<Groups unread={unreadStatus} />} />
            <Route path="/AddEngineer" element={<AddEngineer />} />
            {/* ChatPage-ku socket matrum clear function anupuroam */}
            <Route path="/chat/:id" element={<ChatPage socket={socket} clearUnread={clearUnread} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;