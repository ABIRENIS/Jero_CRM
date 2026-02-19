import React, { useState, useEffect } from 'react';
import '../styles/Groups.css';
import { Monitor, Laptop, Camera, ChevronRight, ArrowLeft, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import AddEngineer from './AddEngineer';

// Component-ku veliya socket connection, to prevent multiple connections on re-render
const socket = io.connect("http://localhost:5000");

const Groups = ({ unread = {} }) => {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState(null); 
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [groupStats, setGroupStats] = useState({
    ups: { total: 0, online: 0 },
    lan: { total: 0, online: 0 },
    cctv: { total: 0, online: 0 }
  });

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    fetch('http://localhost:5000/api/engineers/stats') 
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setGroupStats(data);
        }
      })
      .catch(err => console.error("Error fetching stats:", err));
  }, []);

  // --- 2. REAL-TIME SOCKET LISTENERS ---
  useEffect(() => {
    // A. Update Group Card Counts (UPS/LAN/CCTV)
    const handleStatsUpdate = (newStats) => {
      console.log("Real-time stats update received:", newStats);
      setGroupStats(newStats);
    };

    // B. Update Individual Table Rows (Online/Offline status)
    const handleStatusChange = (data) => {
      console.log("Status change received for Engineer:", data);
      
      setEngineers(prevEngineers => 
        prevEngineers.map(eng => 
          // Database-la irundhu vara ID string-ah irukkalaam, so == use pannuvoam
          eng.id == data.id ? { ...eng, status: data.status } : eng
        )
      );
    };

    socket.on('update_group_stats', handleStatsUpdate);
    socket.on('status_changed', handleStatusChange);

    return () => {
      socket.off('update_group_stats', handleStatsUpdate);
      socket.off('status_changed', handleStatusChange);
    };
  }, []);

  // --- 3. FETCH GROUP LIST ---
  useEffect(() => {
    if (selectedGroup) {
      setLoading(true);
      fetch(`http://localhost:5000/api/engineers/${selectedGroup}`)
        .then(res => res.json())
        .then(data => {
          setEngineers(data);
          setLoading(false);
        })
        .catch(err => console.error("Error fetching list:", err));
    }
  }, [selectedGroup]);

  const groupsData = [
    { 
      id: 'ups', 
      name: 'UPS Engineers', 
      icon: <Monitor />, 
      color: 'blue', 
      stats: (groupStats && groupStats.ups) ? groupStats.ups : { total: 0, online: 0 } 
    },
    { 
      id: 'lan', 
      name: 'LAN Engineers', 
      icon: <Laptop />, 
      color: 'green', 
      stats: (groupStats && groupStats.lan) ? groupStats.lan : { total: 0, online: 0 } 
    },
    { 
      id: 'cctv', 
      name: 'CCTV Engineers', 
      icon: <Camera />, 
      color: 'orange', 
      stats: (groupStats && groupStats.cctv) ? groupStats.cctv : { total: 0, online: 0 } 
    }
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="main-content">
        <main className="groups-body">
          <div className="groups-header" style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'flex-start' 
}}>
  <div>
    <h2 className="page-title">
      {selectedGroup ? (
        <span onClick={() => setSelectedGroup(null)} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'}}>
          <ArrowLeft size={20} /> {selectedGroup.toUpperCase()} List
        </span>
      ) : "Engineer Groups"}
    </h2>
    <p className="page-subtitle">Manage departments and communication</p>
  </div>

  {/* ADD ENGINEER BUTTON - Top Right logic */}
  {!selectedGroup && (
    <button 
      className="btn-add-engineer"
      onClick={() => navigate('/AddEngineer')} // Inga unga function-ah kudukkalam
      style={{
        backgroundColor: '#4398de',
        color: 'white',
        border: 'none',
        padding: '10px 18px',
        borderRadius: '6px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.9rem',
        marginTop: '20px',
        transition: 'background 0.3s ease'
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = '#3183c5'}
      onMouseOut={(e) => e.target.style.backgroundColor = '#4398de'}
    >
      + Add Engineer
    </button>
  )}
</div>

          {!selectedGroup ? (
            <div className="groups-list">
              {groupsData.map((group) => (
                <div key={group.id} className="group-list-item">
                  <div className={`group-icon-circle ${group.color}`}>{group.icon}</div>
                  <div className="group-info">
                    <h3>{group.name}</h3>
                    <span>{group.stats.total} Total Engineers</span>
                  </div>
                  <div className="group-status-pills">
                    <div className="status-pill online">{group.stats.online} Online</div>
                  </div>
                  <button className="btn-view-group" onClick={() => setSelectedGroup(group.id)}>
                    View List <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="engineer-table-container">
              {loading ? <p>Loading engineers...</p> : (
                <table className="engineer-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Engineer ID</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineers.map((eng) => {
                      const isUnread = unread[eng.id] === true;
                      return (
                        <tr key={eng.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <strong>{eng.name}</strong>
                              {isUnread && (
                                <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }}></div>
                              )}
                            </div>
                          </td>
                          <td><code>{eng.engineer_id}</code></td>
                          <td>
                            <span className={`status-tag ${(eng.status || 'offline').toLowerCase()}`}>
                              {eng.status || 'Offline'}
                            </span>
                          </td>
                          <td>
                            <button 
                              className={`btn-chat ${isUnread ? 'highlight' : ''}`} 
                              onClick={() => navigate(`/chat/${eng.id}`, { state: { engineer: eng } })}
                            >
                              <MessageSquare size={16} /> Chat Now
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Groups;