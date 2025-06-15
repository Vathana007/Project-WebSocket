// import express from 'express';
// import GroupChat from '../models/GroupChat.js';

// const router = express.Router();

// // Create new group chat
// router.post('/', async (req, res) => {
//   const { name, creator, members } = req.body;

//   // Validate input fields
//   if (!name || !creator || !Array.isArray(members)) {
//     return res.status(400).json({ message: 'Name, creator, and members are required' });
//   }

//   try {
//     // Ensure the creator is included in the members list
//     const allMembers = [...new Set([creator, ...members])];

//     // Check if a group with the same name already exists
//     const existingGroup = await GroupChat.findOne({ name });
//     if (existingGroup) {
//       return res.status(400).json({ message: 'Group name already exists' });
//     }

//     // Create the new group chat
//     const newGroup = new GroupChat({
//       name,
//       creator,
//       members: allMembers,
//       createdBy: creator,
//       updatedAt: new Date()
//     });

//     await newGroup.save();
//     res.status(201).json(newGroup);
//   } catch (err) {
//     console.error('Error creating group:', err);
//     res.status(500).json({ message: 'Failed to create group' });
//   }
// });

// // Add member to group
// // router.post('/:id/add-member', async (req, res) => {
// //   const { username } = req.body;

// //   try {
// //     const group = await GroupChat.findById(req.params.id);
// //     if (!group) {
// //       return res.status(404).json({ message: 'Group not found' });
// //     }

// //     if (group.members.includes(username)) {
// //       return res.status(400).json({ message: 'User already in group' });
// //     }

// //     group.members.push(username);
// //     group.updatedAt = new Date();
// //     await group.save();
// //     res.json(group);
// //   } catch (err) {
// //     console.error('Error adding member:', err);
// //     res.status(500).json({ message: 'Failed to add member' });
// //   }
// // });

// // Get all groups for a user
// router.get('/user/:username', async (req, res) => {
//   try {
//     const groups = await GroupChat.find({ members: req.params.username });
//     res.json(groups);
//   } catch (err) {
//     console.error('Error fetching groups:', err);
//     res.status(500).json({ message: 'Failed to fetch groups' });
//   }
// });

// // Get group by ID
// router.get('/:id', async (req, res) => {
//   try {
//     const group = await GroupChat.findById(req.params.id);
//     if (!group) {
//       return res.status(404).json({ message: 'Group not found' });
//     }
//     res.json(group);
//   } catch (err) {
//     console.error('Error fetching group:', err);
//     res.status(500).json({ message: 'Failed to fetch group' });
//   }
// });

// export default router;

import express from 'express';
import GroupChat from '../models/GroupChat.js';

const router = express.Router();

// Create new group chat
router.post('/', async (req, res) => {
  const { name, creator, members } = req.body;

  // Validate input fields
  if (!name || !creator || !Array.isArray(members)) {
    return res.status(400).json({ message: 'Name, creator, and members are required' });
  }

  try {
    // Ensure the creator is included in the members list
    const allMembers = [...new Set([creator, ...members])];  // Creator must be included

    // Check if a group with the same name already exists
    const existingGroup = await GroupChat.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ message: 'Group name already exists' });
    }

    // Create the new group chat
    const newGroup = new GroupChat({
      name,
      creator,
      members: allMembers, // Save the full members list correctly
      createdBy: creator,
      updatedAt: new Date()
    });

    await newGroup.save();
    res.status(201).json(newGroup); // Return the newly created group
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Get all groups for a user
router.get('/user/:username', async (req, res) => {
  try {
    const groups = await GroupChat.find({ members: req.params.username });
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

export default router;
