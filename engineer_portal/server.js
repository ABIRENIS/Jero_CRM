const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// --- STATIC FILES SERVING ---
// HTML, CSS, JS files-ah browser-ku anupa
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- FILE UPLOAD LOGIC ---
// Certificates upload panna
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload-certificates', upload.fields([
    { name: 'invoice', maxCount: 1 },
    { name: 'icdc', maxCount: 1 },
    { name: 'bill', maxCount: 1 }
]), (req, res) => {
    console.log('Files received at Engineer Portal');
    res.send({ status: 'Success', message: 'Certificates sent successfully' });
});

// NOTE: Socket.io logic inga thevai illai.
// Chat logic ellame 'SERVER/index.js' (Port 5000)-la irukku.

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Engineer Portal files running on http://localhost:${PORT}`);
});

