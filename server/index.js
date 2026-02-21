const express = require('express');
const cors = require('cors');
const pool = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// --- 1. MIDDLEWARE ---
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
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// --- 4. ROOT ROUTE ---
app.get('/', (req, res) => {
    res.json({ status: "Live", message: "Jerobyte CRM Server is running.", timestamp: new Date() });
});

// --- 5. HELPER: Broadcast Stats ---
const broadcastStats = async () => {
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
                if (stats[type]) {
                    stats[type] = { total: parseInt(row.total), online: parseInt(row.online_count) };
                }
            }
        });
        io.emit('update_group_stats', stats);
    } catch (err) {
        console.error("Stats Error:", err.message);
    }
};

// --- 6. CRON JOB ---
cron.schedule('0 0 * * *', async () => {
    try {
        await pool.query("DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '30 days'");
    } catch (err) { console.error("Cleanup error:", err.message); }
});

// --- 7. API ROUTES ---

app.post('/api/engineers/add', async (req, res) => {
    const { name, group_type, email, password, phone } = req.body;
    try {
        const prefix = `ENG-${group_type.toUpperCase()}`;
        const lastEng = await pool.query(
            `SELECT engineer_id FROM engineers WHERE engineer_id LIKE $1 ORDER BY id DESC LIMIT 1`, [`${prefix}-%`]
        );
        let newId = `${prefix}-001`;
        if (lastEng.rows.length > 0) {
            const lastNum = parseInt(lastEng.rows[0].engineer_id.split('-')[2]);
            newId = `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
        }
        const result = await pool.query(
            `INSERT INTO engineers (name, engineer_id, group_type, email, password, phone, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, newId, group_type.toLowerCase(), email, password, phone, 'Offline']
        );
        broadcastStats();
        res.json({ success: true, engineer: result.rows[0] });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/engineer/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM engineers WHERE email = $1 AND password = $2", [email, password]);
        if (result.rows.length > 0) {
            const eng = result.rows[0];
            await pool.query("UPDATE engineers SET status = 'Online' WHERE id = $1", [eng.id]);
            broadcastStats();
            io.emit('status_changed', { id: eng.id, status: 'Online' });
            res.json({ 
                success: true, 
                id: eng.id, 
                name: eng.name, 
                engineer_id: eng.engineer_id,
                email: eng.email 
            });
        } else { res.status(401).json({ success: false, message: "Invalid Credentials" }); }
    } catch (err) { res.status(500).json({ error: "Login error" }); }
});

app.post('/api/engineer/logout', async (req, res) => {
    const { engineer_id } = req.body;
    try {
        await pool.query("UPDATE engineers SET status = 'Offline' WHERE id = $1", [engineer_id]);
        broadcastStats();
        io.emit('status_changed', { id: engineer_id, status: 'Offline' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Logout error" }); }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file" });
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, name: req.file.originalname, type: req.file.mimetype });
});

app.get('/api/chat/:engineer_id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM chat_messages WHERE engineer_db_id = $1 ORDER BY created_at ASC", [req.params.engineer_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "History error" }); }
});

app.get('/api/engineers/stats', async (req, res) => {
    try {
        const query = `SELECT group_type, COUNT(*) as total, SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online_count FROM engineers GROUP BY group_type`;
        const result = await pool.query(query);
        const stats = { ups: { total: 0, online: 0 }, lan: { total: 0, online: 0 }, cctv: { total: 0, online: 0 } };
        result.rows.forEach(row => {
            const type = row.group_type.toLowerCase();
            if (stats[type]) stats[type] = { total: parseInt(row.total), online: parseInt(row.online_count) };
        });
        res.json(stats);
    } catch (err) { res.status(500).json({ error: "Stats fetch error" }); }
});

app.get('/api/engineers/:groupType', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM engineers WHERE group_type = $1 ORDER BY id ASC", [req.params.groupType.toLowerCase()]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

// --- 8. REAL-TIME LOGIC ---
const connectedEngineers = new Map();

io.on('connection', (socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    socket.on('register_engineer', async (engineerId) => {
        if (!engineerId) return;
        connectedEngineers.set(socket.id, engineerId);
        try {
            await pool.query("UPDATE engineers SET status = 'Online' WHERE id = $1", [engineerId]);
            broadcastStats();
            io.emit('status_changed', { id: engineerId, status: 'Online' });
        } catch (err) { console.error("Register Error:", err); }
    });

    socket.on('join_chat', (engineer_db_id) => {
        if (!engineer_db_id) return;
        const roomId = String(engineer_db_id);
        socket.join(roomId);
        console.log(`✅ Room Joined: ${roomId}`);
    });

    socket.on('send_message', async (data) => {
        const { engineer_db_id, sender, sender_type, message_text, file_info } = data;
        const roomId = String(engineer_db_id);
        
        try {
            await pool.query(
                "INSERT INTO chat_messages (engineer_db_id, sender, sender_type, message_text, file_info) VALUES ($1, $2, $3, $4, $5)",
                [engineer_db_id, sender, sender_type, message_text, file_info ? JSON.stringify(file_info) : null]
            );

            // BROADCAST STRATEGY:
            // 1. Send to the specific room (Captured by Engineer OR Admin if they joined room)
            io.to(roomId).emit('receive_message', data);

            // 2. Global broadcast for Executive Panel (If they aren't in a specific room yet)
            socket.broadcast.emit('receive_message', data);

        } catch (err) { console.error("Msg Save Error:", err.message); }
    });

    socket.on('disconnect', async () => {
        const engineerId = connectedEngineers.get(socket.id);
        if (engineerId) {
            try {
                await pool.query("UPDATE engineers SET status = 'Offline' WHERE id = $1", [engineerId]);
                connectedEngineers.delete(socket.id);
                broadcastStats();
                io.emit('status_changed', { id: engineerId, status: 'Offline' });
            } catch (err) { console.error("Disconnect Error:", err); }
        }
    });
});

// --- 9. SERVER LISTEN ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server on port ${PORT}`);
});
