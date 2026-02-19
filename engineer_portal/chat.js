// 1. Socket connection initialize (Port 5000 Backend)
const socket = io('http://localhost:5000');

// Login details retrieval from LocalStorage
let currentEngineer = JSON.parse(localStorage.getItem('engineerData')) || null;

// --- 1. FETCH HISTORY FROM DATABASE ON LOAD ---
async function loadChatHistory() {
    if (!currentEngineer) return;

    try {
        const response = await fetch(`http://localhost:5000/api/chat/${currentEngineer.id}`);
        const history = await response.json();
        
        const chatWindow = document.getElementById('chat-window');
        if(!chatWindow) return; 
        chatWindow.innerHTML = ''; 

        history.forEach(msg => {
            const msgDiv = document.createElement('div');
            const isMe = msg.sender_type === 'engineer';
            msgDiv.className = isMe ? 'msg engineer-msg-style' : 'msg executive';
            
            let content = `<small>${isMe ? 'You' : msg.sender}</small><p>${msg.message_text || ''}</p>`;
            
            if (msg.file_info) {
                const file = typeof msg.file_info === 'string' ? JSON.parse(msg.file_info) : msg.file_info;
                if (isMe) {
                    content += `
                        <div class="file-preview-box" onclick="window.open('${file.url}', '_blank')" 
                             style="cursor: pointer; background: #e3f2fd; padding: 10px; border-radius: 8px; margin-top: 5px; font-size: 0.85rem; border: 1px solid #90caf9; color: #1565c0; display: flex; align-items: center; gap: 8px;">
                            📄 <span>${file.name}</span> <small>(View Sent)</small>
                        </div>`;
                } else {
                    content += `
                        <div class="file-attachment" onclick="downloadFile('${file.url}', '${file.name}')" 
                             style="cursor: pointer; background: #fff; padding: 10px; border-radius: 8px; margin-top: 8px; border: 1px solid #ddd; display: flex; align-items: center; gap: 8px;">
                            📥 <span style="color: #1b4e8c; font-weight: bold;">Download ${file.name}</span>
                        </div>`;
                }
            }
            
            msgDiv.innerHTML = content;
            chatWindow.appendChild(msgDiv);
        });
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (err) {
        console.error("History loading error:", err);
    }
}

// --- 2. REGISTRATION & CONNECTION LOGIC ---
function registerWithServer() {
    if (currentEngineer && currentEngineer.id) {
        console.log("Registering status for:", currentEngineer.id);
        socket.emit('register_engineer', currentEngineer.id);
        socket.emit('join_chat', currentEngineer.id);
    }
}

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    registerWithServer(); 
});

socket.on('connect', registerWithServer);

// --- 3. LOGIN & LOGOUT LOGIC ---
async function loginEngineer(email, password) {
    try {
        const response = await fetch('http://localhost:5000/api/engineer/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            currentEngineer = data.engineer;
            localStorage.setItem('engineerData', JSON.stringify(data.engineer));
            registerWithServer();
            window.location.href = 'dashboard.html'; 
        } else {
            alert(data.message); 
        }
    } catch (err) {
        console.error("Login failed:", err);
        alert("Server connection error!");
    }
}

// NEW: Explicit Logout Logic
async function handleLogout() {
    if (!currentEngineer) return;

    try {
        // Backend-ku signal anuppi status-ah Offline mathurom
        await fetch('http://localhost:5000/api/engineer/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engineer_id: currentEngineer.id })
        });

        // Local storage clear panni, socket-ah cut pandrom
        localStorage.removeItem('engineerData');
        socket.disconnect();
        window.location.href = 'index.html';
    } catch (err) {
        console.error("Logout error:", err);
        // Error vandhaalum safety-ku clear panniduvom
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// --- 4. MESSAGE SEND LOGIC ---
async function sendEngineerRequest() {
    const msgArea = document.getElementById('engineer-msg');
    const fileInput = document.getElementById('eng-file-input');
    const chatWindow = document.getElementById('chat-window');
    
    const message = msgArea.value.trim();
    const file = fileInput ? fileInput.files[0] : null;

    if (!message && !file || !currentEngineer) return;

    let uploadedFile = null;

    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadRes = await fetch('http://localhost:5000/api/upload', {
                method: 'POST',
                body: formData
            });
            uploadedFile = await uploadRes.json(); 
        } catch (err) {
            console.error("Upload failed:", err);
            alert("File upload failed.");
            return;
        }
    }

    const chatData = {
        sender: currentEngineer.name || 'Engineer',
        sender_type: 'engineer',
        sender_id: currentEngineer.engineer_id,
        engineer_db_id: currentEngineer.id,
        message_text: message,
        file_info: uploadedFile, 
        created_at: new Date().toISOString()
    };

    socket.emit('send_message', chatData);

    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg engineer-msg-style';
    
    let content = `<small>You</small><p>${message || ''}</p>`;
    if (uploadedFile) {
        content += `
            <div class="file-preview-box" 
                 onclick="window.open('${uploadedFile.url}', '_blank')"
                 style="background: #e3f2fd; padding: 10px; border-radius: 8px; margin-top: 5px; font-size: 0.85rem; border: 1px solid #90caf9; color: #1565c0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                📄 <span>${uploadedFile.name}</span>
                <small style="color: #666; font-size: 0.7rem;">(View Sent)</small>
            </div>`;
    }

    msgDiv.innerHTML = content;
    chatWindow.appendChild(msgDiv);

    msgArea.value = '';
    if(fileInput) fileInput.value = '';
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- 5. DOWNLOAD & RECEIVE LOGIC ---
async function downloadFile(url, fileName) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobURL = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobURL;
        link.setAttribute('download', fileName); 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobURL); 
    } catch (err) {
        window.open(url, '_blank'); 
    }
}

socket.on('receive_message', (data) => {
    if (data.sender_type === 'admin') {
        showToastNotification(`New message from Executive`);

        const chatWindow = document.getElementById('chat-window');
        if(!chatWindow) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg executive';
        
        let content = `<small>${data.sender}</small><p>${data.message_text || ""}</p>`;
        
        if (data.file_info) {
            const file = typeof data.file_info === 'string' ? JSON.parse(data.file_info) : data.file_info;
            content += `
                <div class="file-attachment" onclick="downloadFile('${file.url}', '${file.name}')" 
                     style="cursor: pointer; margin-top: 5px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 5px;">
                    📥 Download ${file.name}
                </div>`;
        }

        msgDiv.innerHTML = content;
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});

function showToastNotification(text) {
    const toast = document.createElement('div');
    toast.innerText = text;
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #28a745; color: white;
        padding: 12px 24px; border-radius: 8px;
        z-index: 9999; font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}