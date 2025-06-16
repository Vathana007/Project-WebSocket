import express from 'express';
import Message from '../models/Message.js';
import GroupChat from '../models/GroupChat.js';

const router = express.Router();

// POST /api/messages
router.post('/', async (req, res) => {
  const { text, sender, chatId, timestamp } = req.body;
  if (!text || !sender) {
    return res.status(400).json({ message: 'Text and sender are required' });
  }

  try {
    const newMessage = new Message({
      text,
      sender,
      chatId: chatId || 'general',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });
    await newMessage.save();

    // Update group chat's lastMessage and updatedAt
    if (chatId && chatId !== 'general') {
      await GroupChat.findByIdAndUpdate(chatId, {
        lastMessage: text,
        updatedAt: new Date()
      });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ message: 'Failed to save message' });
  }
});

// GET /api/messages?chatId=xyz
router.get('/', async (req, res) => {
  const chatId = req.query.chatId || 'general';
  try {
    const messages = await Message
      .find({ chatId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

export default router;