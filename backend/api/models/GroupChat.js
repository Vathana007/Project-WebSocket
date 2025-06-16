import mongoose from 'mongoose';

const groupChatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
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
        return members.length >= 2; // At least creator + 1 member
      },
      message: 'Group must have at least two members'
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
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
groupChatSchema.index({ name: 1 });
groupChatSchema.index({ members: 1 });
groupChatSchema.index({ updatedAt: -1 });

// Virtual for member count
groupChatSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

const GroupChat = mongoose.model('GroupChat', groupChatSchema);

export default GroupChat;