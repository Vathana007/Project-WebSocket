import express from 'express';
import GroupChat from '../models/GroupChat.js';
import User from '../models/User.js';

const router = express.Router();

// Create new group chat
router.post('/', async (req, res) => {
  const { name, creator, members } = req.body;

  if (!name || !creator || !Array.isArray(members)) {
    return res.status(400).json({ message: 'Name, creator, and members are required' });
  }

  try {
    const invalidMembers = [];
    for (const member of members) {
      const userExists = await User.exists({ username: member });
      if (!userExists) invalidMembers.push(member);
    }

    if (invalidMembers.length > 0) {
      return res.status(400).json({
        message: 'Some users do not exist',
        invalidMembers
      });
    }

    const existingGroup = await GroupChat.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ message: 'Group name already exists' });
    }

    const allMembers = [...new Set([creator, ...members])];
    const newGroup = new GroupChat({
      name,
      creator,
      members: allMembers,
      lastMessage: 'Group created!',
      updatedAt: new Date()
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Add member to group
router.post('/:id/add-member', async (req, res) => {
  console.log(`Received POST request for /api/groupChats/${req.params.id}/add-member`); // Debug log
  const { username } = req.body;

  try {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ message: 'Valid username is required' });
    }

    const group = await GroupChat.findById(req.params.id);
    if (!group) {
      console.log(`Group ${req.params.id} not found`);
      return res.status(404).json({ message: 'Group not found' });
    }

    const userExists = await User.exists({ username });
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (group.members.includes(username)) {
      return res.status(400).json({ message: 'User already in group' });
    }

    group.members.push(username);
    group.updatedAt = new Date();
    await group.save();
    console.log(`Successfully added ${username} to group ${req.params.id}`);

    // Emit group update to connected clients
    io.to(group._id.toString()).emit('groupUpdated', group);

    res.json(group);
  } catch (err) {
    console.error('Error adding member:', err);
    res.status(500).json({ message: 'Failed to add member' });
  }
});

// Get all groups for a user
router.get('/user/:username', async (req, res) => {
  try {
    const groups = await GroupChat.find({ members: req.params.username })
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Get group by ID
router.get('/:id', async (req, res) => {
  try {
    const group = await GroupChat.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.json(group);
  } catch (err) {
    console.error('Error fetching group:', err);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

// Remove member from group
router.post('/:id/remove-member', async (req, res) => {
  const { username } = req.body;

  try {
    const group = await GroupChat.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(username)) {
      return res.status(400).json({ message: 'User not in group' });
    }

    group.members = group.members.filter(member => member !== username);
    group.updatedAt = new Date();
    await group.save();

    io.to(group._id.toString()).emit('groupUpdated', group);

    res.json(group);
  } catch (err) {
    console.error('Error removing member:', err);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

export default router; 