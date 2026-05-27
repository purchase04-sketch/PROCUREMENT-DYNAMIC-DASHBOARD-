require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Ensure uploads and data folders exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set fallback JWT_SECRET if not in .env
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt_procure_ai_secret_key_fallback_9922';

// Attach io to app for use in routes
app.io = io;

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Procurement Dashboard API Running', timestamp: new Date().toISOString() });
});

// Socket.IO Integration
io.on('connection', (socket) => {
  console.log('📡 Client connected:', socket.id);
  
  // Allow client to request full recalculation over sockets
  socket.on('requestRecalculation', async (data) => {
    try {
      const { buyerId } = data || {};
      const { fullRecalculation } = require('./services/recalculationService');
      await fullRecalculation(buyerId, io);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('disconnect', () => console.log('📡 Client disconnected:', socket.id));
});

// Start
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Watch trigger comment to force server reload and execute clean database startup
start();
