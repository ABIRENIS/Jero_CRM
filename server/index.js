const express = require('express');
const cors = require('cors');
const pool = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config(); // Load environment variables

const app = express();
const server = http.createServer(app);

// --- 1. MIDDLEWARE ---
// Updated CORS for production (allows local testing + Vercel)
const allowedOrigins = [
    process.env.CLIENT_URL, 
    process.env.PORTAL_URL,
    'https://jerobyte-crm-exe.vercel.app',
    'https://jerocrmeng.vercel.app',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

// --- 2. FILE STORAGE SETUP ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(uploadDir));

// --- 3. SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*", // For sockets, strictly limiting origins is safer in next phase
        methods: ["GET", "POST"]
    }
});

// --- 4. ROOT ROUTE (FIXES "CANNOT GET /") ---
app.get('/', (req, res) => {
    res.json({
        status: "Live",
        message: "Jerobyte CRM Server is running successfully.",
        timestamp: new Date()
    });
});

// --- 5. HELPER FUNCTION: Broadcast Real-time Stats ---
const broadcastStats = async () => {
    try {
        const query = `
            SELECT group_type, COUNT(*) as total,
            SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online_count
            FROM engineers
            GROUP BY group_type;
        `;
        const result = await pool.query(query);
        const stats = {
            ups: { total: 0, online: 0 },
            lan: { total: 0, online: 0 },
            cctv: { total: 0, online: 0 }
        };

        result.rows.forEach(row => {
            if (row.group_type) {
                const type = row.group_type.toLowerCase().trim();
                if (stats[type]) {
                    stats[type] = {
                        total: parseInt(row.total),
                        online: parseInt(row.online_count)
                    };
                }
            }
        });
        io.emit('update_group_stats', stats);
    } catch (err) {
        console.error("Broadcast Stats Error:", err.message);
    }
};

// --- 6. CRON JOB ---
cron.schedule('0 0 * * *', async () => {
    try {
        await pool.query("DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '30 days'");
        console.log("Cleanup: Old messages deleted.");
    } catch (err) {
        console.error("Cleanup error:", err.message);
    }
});

// --- 7. API ROUTES ---

// A. ADD ENGINEER
app.post('/api/engineers/add', async (req, res) => {
    const { name, group_type, email, password, phone } = req.body;
    try {
        const prefix = `ENG-${group_type.toUpperCase()}`;
        const lastEng = await pool.query(
            `SELECT engineer_id FROM engineers 
             WHERE engineer_id LIKE $1 
             ORDER BY CAST(NULLIF(split_part(engineer_id, '-', 3), '') AS INTEGER) DESC 
             LIMIT 1`,
            [`${prefix}-%`]
        );
        let newId = `${prefix}-001`;
        if (lastEng.rows.length > 0) {
            const parts = lastEng.rows[0].engineer_id.split('-');
            const lastNum = parseInt(parts[2]);
            if (!isNaN(lastNum)) {
                newId = `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
            }
        }
        const query = `
            INSERT INTO engineers (name, engineer_id, group_type, email, password, phone, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const result = await pool.query(query, [name, newId, group_type.toLowerCase(), email, password, phone, 'Offline']);
        broadcastStats(); 
        res.json({ success: true, engineer: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// B. LOGIN API
app.post('/api/engineer/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT id, name, engineer_id, group_type, email FROM engineers WHERE email = $1 AND password = $2",
            [email, password]
        );
        if (result.rows.length > 0) {
            const engineer = result.rows[0];
            await pool.query("UPDATE engineers SET status = 'Online' WHERE id = $1", [engineer.id]);
            broadcastStats();
            io.emit('status_changed', { id: engineer.id, status: 'Online' });
            res.json({ success: true, engineer });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials!" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// C. LOGOUT API
app.post('/api/engineer/logout', async (req, res) => {
    const { engineer_id } = req.body;
    try {
        await pool.query("UPDATE engineers SET status = 'Offline' WHERE id = $1", [engineer_id]);
        broadcastStats();
        io.emit('status_changed', { id: engineer_id, status: 'Offline' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// D. UPLOAD API (Updated to dynamic host)
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    // Use the request host so it works on both localhost and Render
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, name: req.file.originalname, type: req.file.mimetype });
});

app.get('/api/chat/:engineer_id', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM chat_messages WHERE engineer_db_id = $1 ORDER BY created_at ASC",
            [req.params.engineer_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "History load failed" });
    }
});

app.get('/api/engineers/stats', async (req, res) => {
    try {
        const query = `
            SELECT group_type, COUNT(*) as total,
            SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online_count
            FROM engineers GROUP BY group_type;
        `;
        const result = await pool.query(query);
        const stats = { ups: { total: 0, online: 0 }, lan: { total: 0, online: 0 }, cctv: { total: 0, online: 0 } };
        result.rows.forEach(row => {
            if (row.group_type) {
                const type = row.group_type.toLowerCase().trim();
                if (stats[type]) stats[type] = { total: parseInt(row.total), online: parseInt(row.online_count) };
            }
        });
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Database fetch failed" });
    }
});

app.get('/api/engineers/:groupType', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM engineers WHERE group_type = $1 ORDER BY id ASC",
            [req.params.groupType.toLowerCase()]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Server Error");
    }
});



   // --- 8. REAL-TIME LOGIC ---
// --- 8. REAL-TIME LOGIC ---
// ONLY DECLARE THIS ONCE
const connectedEngineers = new Map();

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // A. REGISTER STATUS (For Dashboard Online/Offline)
    socket.on('register_engineer', async (engineerId) => {
        connectedEngineers.set(socket.id, engineerId);
        try {
            await pool.query("UPDATE engineers SET status = 'Online' WHERE id = $1", [engineerId]);
            broadcastStats();
            io.emit('status_changed', { id: engineerId, status: 'Online' });
        } catch (err) {
            console.error("Socket Register Error:", err);
        }
    });

    // B. JOIN CHAT ROOM (For Real-time messages)
    socket.on('join_chat', (engineer_db_id) => {
        if (!engineer_db_id) return;
        
        const roomId = String(engineer_db_id); // Force ID to be a String
        socket.join(roomId); 
        console.log(`✅ Socket ${socket.id} successfully joined Room: ${roomId}`);
    });

    // C. SEND & RECEIVE MESSAGE
    socket.on('send_message', async (data) => {
        const { engineer_db_id, sender, sender_type, message_text, file_info } = data;
        
        try {
            // 1. Save to Database
            await pool.query(
                "INSERT INTO chat_messages (engineer_db_id, sender, sender_type, message_text, file_info) VALUES ($1, $2, $3, $4, $5)",
                [engineer_db_id, sender, sender_type, message_text, file_info ? JSON.stringify(file_info) : null]
            );

            const roomId = String(engineer_db_id); // Force match with Join ID

            // 2. Broadcast to Engineer
            // This hits the specific room the engineer joined
            io.to(roomId).emit('receive_message', data);

            // 3. Broadcast to Executive
            // If the sender is an engineer, we use io.emit to tell all Admins.
            // If sender is admin, io.to(roomId) already covers the engineer.
            if (sender_type === 'engineer') {
                socket.broadcast.emit('receive_message', data); 
            }

            console.log(`📨 Message from ${sender} sent to Room ${roomId}`);

        } catch (err) {
            console.error("❌ Msg Save Error:", err.message);
        }
    });

    // D. DISCONNECT LOGIC
    socket.on('disconnect', async () => {
        const engineerId = connectedEngineers.get(socket.id);
        if (engineerId) {
            try {
                await pool.query("UPDATE engineers SET status = 'Offline' WHERE id = $1", [engineerId]);
                connectedEngineers.delete(socket.id);
                broadcastStats();
                io.emit('status_changed', { id: engineerId, status: 'Offline' });
            } catch (err) {
                console.error("Disconnect error:", err);
            }
        }
    });
});
// --- 9. SERVER LISTEN (RENDER COMPATIBLE) ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Jerobyte Server running on port ${PORT}`);
});
