import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Paperclip, X, FileText, Download, Eye } from 'lucide-react';
import '../styles/Chat.css';

const ChatPage = ({ socket, clearUnread }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { engineer } = location.state || {}; 
  
  // API URL logic
  const API_BASE_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";
  
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const scrollRef = useRef();
  const fileInputRef = useRef();
  
  // Use Ref to keep track of active engineer ID inside the socket listener
  const engineerIdRef = useRef(engineer?.id);

  // 1. Sync Ref and Clear Unread on Load
  useEffect(() => {
    if (engineer?.id) {
      engineerIdRef.current = engineer.id;
      if (clearUnread) clearUnread(engineer.id);
    }
  }, [engineer?.id, clearUnread]);

  // 2. Join Room & Load History
  useEffect(() => {
    if (engineer && socket) {
      // Standardize ID as String for Room Joining
      const roomId = String(engineer.id);
      socket.emit("join_chat", roomId);
      
      fetch(`${API_BASE_URL}/api/chat/${engineer.id}`)
        .then(res => res.json())
        .then(data => setChatHistory(data)) 
        .catch(err => console.error("Error loading history:", err));
    }
  }, [engineer, socket, API_BASE_URL]);

  // 3. Socket Listener (The "Filter" logic)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      // CRITICAL: Check if incoming message belongs to the open chat
      const incomingId = String(data.engineer_db_id);
      const activeId = String(engineerIdRef.current);

      if (incomingId === activeId) {
        setChatHistory((prev) => {
          // Prevent UI duplicates
          const isDuplicate = prev.some(msg => 
            msg.created_at === data.created_at && msg.message_text === data.message_text
          );
          if (isDuplicate) return prev;
          return [...prev, data];
        });
        
        // Auto-clear unread if the chat is open
        if (clearUnread) clearUnread(incomingId);
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
  }, [socket, clearUnread]);

  // 4. Auto-Scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const downloadFile = async (url, fileName) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobURL;
      link.setAttribute('download', fileName || 'download');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobURL);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((message.trim() !== "" || selectedFile) && engineer && socket) {
      let uploadedFile = null;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData,
          });
          uploadedFile = await res.json();
        } catch (err) {
          alert("File upload failed!");
          return;
        }
      }

      const messageData = {
        engineer_db_id: engineer.id,
        sender: 'Executive Panel', 
        sender_type: 'admin', 
        sender_id: 'ADMIN_01',
        message_text: message, 
        file_info: uploadedFile, 
        created_at: new Date().toISOString()
      };

      // Server broadcasts this back, so it will appear via handleReceiveMessage
      socket.emit("send_message", messageData);
      
      setMessage("");
      setSelectedFile(null);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) 
      ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!engineer) return <div className="p-20">No engineer selected.</div>;

  const displayName = engineer.name || 'Engineer';
  const displayId = engineer.engineer_id || 'N/A';
  const displayStatus = engineer.status || 'Offline';

  return (
    <div className="dashboard-wrapper">
      <div className="main-content">
        <main className="chat-container">
          <div className="chat-window-header">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
            <div className="chat-user-info">
              <div className="chat-avatar">{displayName.charAt(0)}</div>
              <div>
                <h4>{displayName}</h4>
                <p>ID: {displayId} • <span className={`status-${displayStatus.toLowerCase()}`}>{displayStatus}</span></p>
              </div>
            </div>
          </div>

          <div className="chat-messages-area">
            {chatHistory.map((msg, index) => {
              const isSentByMe = msg.sender_type === 'admin';
              return (
                <div key={index} className={`message-wrapper ${isSentByMe ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    {msg.file_info && (
                      <div 
                        className="file-attachment-card" 
                        onClick={() => {
                          if (isSentByMe) {
                            window.open(msg.file_info.url, '_blank');
                          } else {
                            downloadFile(msg.file_info.url, msg.file_info.name);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <FileText size={20} />
                        <div className="file-meta">
                          <span>{msg.file_info.name}</span>
                          <small>{isSentByMe ? "View Sent File" : "Click to download"}</small>
                        </div>
                        <div className="file-action-icon">
                          {isSentByMe ? <Eye size={16} /> : <Download size={16} />}
                        </div>
                      </div>
                    )}
                    {msg.message_text && <span>{msg.message_text}</span>}
                    <span className="msg-time">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          <div className="chat-footer-container">
            {selectedFile && (
              <div className="file-upload-preview">
                <FileText size={16} />
                <span>{selectedFile.name}</span>
                <X size={14} onClick={() => setSelectedFile(null)} style={{cursor: 'pointer'}} />
              </div>
            )}
            <form className="chat-input-row" onSubmit={sendMessage}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden />
              <button type="button" className="attach-btn" onClick={() => fileInputRef.current.click()}>
                <Paperclip size={20} />
              </button>
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit" className="send-btn"><Send size={20} /></button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChatPage;
