// --- 0. CONFIGURATION (Dynamic URL) ---
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://jero-crm.onrender.com';

// 1. Socket connection initialize
const socket = io(API_BASE_URL);

// Login details retrieval from LocalStorage
let currentEngineer = JSON.parse(localStorage.getItem('engineerData')) || null;

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentEngineer) {
        window.location.href = 'index.html'; // Redirect if not logged in
        return;
    }
    loadChatHistory();
    registerWithServer(); 
});

function registerWithServer() {
    if (currentEngineer && currentEngineer.id) {
        console.log("Registering status and joining room for:", currentEngineer.id);
        socket.emit('register_engineer', currentEngineer.id);
        socket.emit('join_chat', currentEngineer.id);
    }
}

socket.on('connect', registerWithServer);

// --- 2. DATABASE OPERATIONS (Fetch, Edit, Delete) ---

async function loadChatHistory() {
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

async function editMsg(msgId, oldText) {
    const newText = prompt("Edit your message:", oldText);
    if (newText === null || newText.trim() === "" || newText === oldText) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message_id: msgId, 
                new_text: newText,
                engineer_db_id: currentEngineer.id // For room targeting
            })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.message || "Failed to edit message.");
        }
        // Note: UI will be updated via socket.on('message_edited')
    } catch (err) {
        console.error("Edit failed:", err);
    }
}

// --- 3. UI RENDERING ---

function appendMessageToUI(data) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const msgId = data.id || `temp-${Date.now()}`;
    const messageKey = `msg-${msgId}`;
    
    // Prevent duplicates
    if (document.getElementById(messageKey)) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = messageKey;
    
    const isMe = data.sender_type === 'engineer';
    msgDiv.className = isMe ? 'msg engineer-msg-style' : 'msg executive';
    
    const msgTime = data.created_at ? new Date(data.created_at) : new Date();
    const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = msgTime.toLocaleDateString();

    let content = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
            <small style="font-weight: bold; color: #1b4e8c;">
                ${isMe ? 'You' : data.sender}
            </small>
            <small style="font-size: 0.7rem; color: #666;">${dateStr} | ${timeStr}</small>
        </div>
        <p id="text-${msgId}" style="margin: 5px 0;">
            ${data.message_text || ''} 
            ${data.is_edited ? '<small style="color:gray; font-style:italic;">(edited)</small>' : ''}
        </p>
    `;

    // Only show Edit button if it's my text message and NOT a file
    if (isMe && !data.file_info) {
        content += `
            <button class="edit-btn" onclick="editMsg('${msgId}', '${data.message_text.replace(/'/g, "\\'")}')" 
                style="background: none; border: none; font-size: 0.8rem; color: #007bff; cursor: pointer; padding: 0;">
                Edit ✎
            </button>`;
    }
    
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

// --- 4. REAL-TIME SOCKET LISTENERS ---

// Listener for NEW messages
socket.on('receive_message', (data) => {
    if (String(data.engineer_db_id) === String(currentEngineer.id)) {
        appendMessageToUI(data);
        if (data.sender_type === 'admin') {
            showToastNotification(`New message from Executive`);
        }
    }
});

// Listener for EDITED messages
socket.on('message_edited', (data) => {
    if (String(data.engineer_db_id) === String(currentEngineer.id)) {
        const textElement = document.getElementById(`text-${data.message_id}`);
        if (textElement) {
            textElement.innerHTML = `${data.new_text} <small style="color:gray; font-style:italic;">(edited)</small>`;
            
            // Update the edit button's onclick attribute with the new text
            const msgContainer = document.getElementById(`msg-${data.message_id}`);
            const editBtn = msgContainer.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.setAttribute('onclick', `editMsg('${data.message_id}', '${data.new_text.replace(/'/g, "\\'")}')`);
            }
        }
    }
});

// --- 5. SEND LOGIC ---

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
            return;
        }
    }

    const chatData = {
        sender: currentEngineer.name,
        sender_type: 'engineer',
        sender_id: currentEngineer.engineer_id,
        engineer_db_id: currentEngineer.id,
        message_text: message,
        file_info: uploadedFile, 
        created_at: new Date().toISOString()
    };

    socket.emit('send_message', chatData);

    msgArea.value = '';
    if (fileInput) fileInput.value = '';
}

// --- 6. UTILS & AUTH ---

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

async function downloadFile(url, fileName) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobURL = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobURL;
        link.download = fileName; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

// Global exposure for login
window.loginEngineer = async function(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/engineer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok && data.id) {
            localStorage.setItem('engineerData', JSON.stringify(data));
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || "Invalid Credentials");
        }
    } catch (err) {
        alert("Server is connecting... Please try again in a moment.");
    }
};
