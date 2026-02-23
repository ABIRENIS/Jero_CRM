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

// --- 3. UI HELPER FUNCTION (Standardized for History & Live) ---........................................................................>
// --- 1. Message Edit Function ---
async function editMsg(msgId, oldText) {
    const newText = prompt("Edit your message:", oldText);
    if (newText === null || newText.trim() === "" || newText === oldText) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: msgId, new_text: newText })
        });

        if (response.ok) {
            // Screen-la ulla text-ah update pannuvom
            const textElement = document.querySelector(`#text-${msgId}`);
            if (textElement) textElement.innerText = newText + " (edited)";
            alert("Message updated!");
        }
    } catch (err) {
        console.error("Edit failed:", err);
    }
}

// --- 2. Document Filter Function ---
function filterDocuments(senderName) {
    const chatWindow = document.getElementById('chat-window');
    const allMsgs = chatWindow.querySelectorAll('.msg');
    
    // Oru simple toggle maari: documents illadha messages-ah hide pannuvom
    allMsgs.forEach(msg => {
        const hasFile = msg.querySelector('.file-preview-box') || msg.querySelector('.file-attachment');
        if (!hasFile) {
            msg.style.display = (msg.style.display === 'none') ? 'flex' : 'none';
        }
    });
    console.log(`Filtering documents for ${senderName}`);
}

// --- 3. Main UI Function (Updated) ---
function appendMessageToUI(data) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    // Unique key with ID if available, else timestamp
    const msgId = data.id || `temp-${Date.now()}`;
    const messageKey = `msg-${msgId}`;
    if (document.getElementById(messageKey)) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = messageKey;
    
    const isMe = data.sender_type === 'engineer';
    msgDiv.className = isMe ? 'msg engineer-msg-style' : 'msg executive';
    
    // Date and Time calculation
    const msgTime = data.created_at ? new Date(data.created_at) : new Date();
    const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = msgTime.toLocaleDateString();

    // UI Content
    let content = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
            <small style="font-weight: bold; cursor: pointer; color: #1b4e8c;" onclick="filterDocuments('${data.sender}')">
                ${isMe ? 'You' : data.sender} 📄
            </small>
            <small style="font-size: 0.7rem; color: #666;">${dateStr} | ${timeStr}</small>
        </div>
        <p id="text-${msgId}" style="margin: 5px 0;">${data.message_text || ''}</p>
    `;

    // Add Edit Button only for Engineer's text messages
    if (isMe && !data.file_info) {
        content += `<button onclick="editMsg('${msgId}', '${data.message_text}')" 
                     style="background: none; border: none; font-size: 0.8rem; color: #007bff; cursor: pointer; padding: 0;">
                     Edit ✎</button>`;
    }
    
    // File/Document UI
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
}//...................................................................................................................................>
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
/**
 * LOGIN LOGIC: Connects to Render/Neon
 */
async function loginEngineer(email, password) {
    try {
        // Use the API_BASE_URL defined at the top of your chat.js
        const response = await fetch(`${API_BASE_URL}/api/engineer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.id) {
            // 1. Save data for session persistence
            localStorage.setItem('engineerData', JSON.stringify(data));
            
            // 2. Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || "Invalid Email or Password");
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("The server is waking up. Please wait 20 seconds and try again.");
    }
}

// Make the function globally available to index.html
window.loginEngineer = loginEngineer;
