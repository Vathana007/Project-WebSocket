import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  chatId: { type: String, required: true },
});

const Message = mongoose.model('Message', messageSchema);

export default Message;