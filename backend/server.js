import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'socket.io';
import authRouter from './api/routes/auth.js';
import messagesRouter from './api/routes/messages.js';
import groupChatRouter from './api/routes/groupChats.js';
import Message from './api/models/Message.js';
import GroupChat from './api/models/GroupChat.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Matches your frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  },
});

app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/groupChats', groupChatRouter);

// Socket.io Logic
const users = new Map(); // socket.id -> username
const onlineUsers = new Set(); // Track online users
const typingUsers = new Map(); // username -> chatId

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join', async (username) => {
    users.set(socket.id, username);
    onlineUsers.add(username);
    io.emit('onlineUsers', Array.from(onlineUsers));
    console.log(`${username} joined the chat`);

    socket.join('general');

    const groups = await GroupChat.find({ members: username });
    groups.forEach(group => {
      socket.join(group._id.toString());
      console.log(`${username} joined group ${group.name}`);
    });
  });

  socket.on('chatMessage', async (message) => {
    const username = users.get(socket.id);
    if (!username) return;

    try {
      const newMessage = new Message({
        text: message.text,
        sender: username,
        chatId: message.chatId || 'general',
        timestamp: new Date()
      });

      await newMessage.save();

      if (message.chatId && message.chatId !== 'general') {
        await GroupChat.findByIdAndUpdate(message.chatId, {
          lastMessage: message.text,
          updatedAt: new Date()
        });
      }

      io.to(message.chatId || 'general').emit('newMessage', {
        ...newMessage.toObject(),
        timestamp: newMessage.timestamp.toISOString()
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('typing', (chatId) => {
    const username = users.get(socket.id);
    if (username) {
      typingUsers.set(username, chatId || 'general');
      io.to(chatId || 'general').emit('typing', Array.from(typingUsers.keys()));
    }
  });

  socket.on('stopTyping', (chatId) => {
    const username = users.get(socket.id);
    if (username) {
      typingUsers.delete(username);
      io.to(chatId || 'general').emit('stopTyping', Array.from(typingUsers.keys()));
    }
  });

  socket.on('getOnlineMembers', (chatId, callback) => {
    if (!chatId) {
      callback([]);
      return;
    }

    const room = io.sockets.adapter.rooms.get(chatId);
    const members = room ? Array.from(room).map(socketId => users.get(socketId)).filter(Boolean) : [];
    callback(members);
  });

  socket.on('checkUserOnline', (username, callback) => {
    callback(onlineUsers.has(username));
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      console.log(`${username} disconnected`);
      onlineUsers.delete(username);
      typingUsers.delete(username);
      users.delete(socket.id);
      io.emit('onlineUsers', Array.from(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}); 