require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const initChatSocket = require('./sockets/chatSocket');
const startTaskJobs = require('./jobs/taskJobs');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const taskRoutes = require('./routes/tasks');
const mapRoutes = require('./routes/maps');

// CORS Configuration
// Environment Variable:
//   ALLOWED_ORIGINS: Comma-separated list of allowed origins (e.g. "https://taskchat.com,https://admin.taskchat.com").
//   In development (NODE_ENV !== 'production'), defaults to permissive '*' if ALLOWED_ORIGINS is not set.
//   In production (NODE_ENV === 'production'), only origins explicitly specified in ALLOWED_ORIGINS are permitted.
const getAllowedOrigins = () => {
  const allowed = process.env.ALLOWED_ORIGINS;
  if (allowed) {
    const list = allowed.split(',').map((origin) => origin.trim()).filter(Boolean);
    return list.length > 0 ? list : (process.env.NODE_ENV === 'production' ? [] : '*');
  }
  return process.env.NODE_ENV === 'production' ? [] : '*';
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
};

if (corsOptions.origin === '*') {
  delete corsOptions.credentials;
}

const app = express();

// Railway (and most PaaS) terminate HTTPS at a reverse proxy and forward
// requests to this app over plain HTTP internally. Without this line,
// req.protocol always reports 'http' even when the public site is https,
// which caused avatar URLs to be saved as http:// and silently fail to
// load on Android (cleartext traffic is blocked in release builds).
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

connectDB();

// Ensure uploads folder exists and is served statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/maps', mapRoutes);

app.get('/', (req, res) => res.send('Task-Chat API is running'));

// Make io accessible inside route handlers via req.app.get('io')
app.set('io', io);

initChatSocket(io);
startTaskJobs(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));