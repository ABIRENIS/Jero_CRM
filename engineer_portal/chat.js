// --- 0. CONFIGURATION (Dynamic URL) ---
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://jero-crm.onrender.com';

// 1. Socket connection initialize
const socket = io(API_BASE_URL);

// Login details retrieval from LocalStorage
let currentEngineer = JSON.parse(localStorage.getItem('engineerData')) || null;

// --- 1. FETCH HISTORY FROM DATABASE ON LOAD ---
async function loadChatHistory() {
    if (!currentEngineer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/${currentEngineer.id}`);
        const history = await response.json();
        
        const chatWindow = document.getElementById('chat-window');
        if(!chatWindow) return; 
        chatWindow.innerHTML = ''; 

        history.forEach(msg => {
            appendMessageToUI(msg);
        });
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (err) {
        console.error("History loading error:", err);
    }
}

// --- 2. REGISTRATION & CONNECTION LOGIC ---
function registerWithServer() {
    if (currentEngineer && currentEngineer.id) {
        console.log("Registering status and joining room for:", currentEngineer.id);
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

// --- 3. UI HELPER FUNCTION (Standardized for History & Live) ---
function appendMessageToUI(data) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    // Create a unique key to prevent duplicate messages on screen
    const messageKey = `msg-${data.created_at}-${data.message_text}`;
    if (document.getElementById(messageKey)) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = messageKey;
    
    const isMe = data.sender_type === 'engineer';
    msgDiv.className = isMe ? 'msg engineer-msg-style' : 'msg executive';
    
    let content = `<small>${isMe ? 'You' : data.sender}</small><p>${data.message_text || ''}</p>`;
    
    if (data.file_info) {
        const file = typeof data.file_info === 'string' ? JSON.parse(data.file_info) : data.file_info;
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
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- 4. MESSAGE SEND LOGIC ---
async function sendEngineerRequest() {
    const msgArea = document.getElementById('engineer-msg');
    const fileInput = document.getElementById('eng-file-input');
    
    const message = msgArea.value.trim();
    const file = fileInput ? fileInput.files[0] : null;

    if ((!message && !file) || !currentEngineer) return;

    let uploadedFile = null;

    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
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

    // Emit to server (The server will broadcast this back via 'receive_message')
    socket.emit('send_message', chatData);

    // Clear inputs
    msgArea.value = '';
    if (fileInput) fileInput.value = '';
}

// --- 5. RECEIVE LOGIC ---
socket.on('receive_message', (data) => {
    // SECURITY CHECK: Only show message if it belongs to this engineer
    if (String(data.engineer_db_id) === String(currentEngineer.id)) {
        appendMessageToUI(data);

        if (data.sender_type === 'admin') {
            showToastNotification(`New message from Executive`);
        }
    }
});

// --- 6. AUTH & TOOLS ---
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

async function handleLogout() {
    if (!currentEngineer) return;
    try {
        await fetch(`${API_BASE_URL}/api/engineer/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engineer_id: currentEngineer.id })
        });
        localStorage.removeItem('engineerData');
        socket.disconnect();
        window.location.href = 'index.html';
    } catch (err) {
        console.error("Logout error:", err);
        localStorage.clear();
        window.location.href = 'index.html';
    }
}
// --- 7. LOGIN LOGIC (MISSING PIECE) ---
async function loginEngineer(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/engineer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.id) {
            // Save engineer data to localStorage
            localStorage.setItem('engineerData', JSON.stringify(data));
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || "Invalid Email or Password");
        }
    } catch (err) {
        console.error("Login connection error:", err);
        alert("The server on Render is waking up. Please wait 20 seconds and try again.");
    }
}

// Make it globally accessible for index.html
window.loginEngineer = loginEngineer;
