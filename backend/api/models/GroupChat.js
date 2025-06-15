import mongoose from 'mongoose';

const groupChatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  creator: {
    type: String,
    required: true
  },
  members: {
    type: [String],
    required: true,
    validate: {
      validator: function (members) {
        return members.length > 0;
      },
      message: 'Group must have at least one member'
    }
  },
  lastMessage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
groupChatSchema.index({ name: 1 });
groupChatSchema.index({ members: 1 });

const GroupChat = mongoose.model('GroupChat', groupChatSchema);

export default GroupChat;