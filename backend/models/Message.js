const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' }, // image/file url if any
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      senderName: { type: String, default: '' },
      text: { type: String, default: '' },
      image: { type: String, default: '' },
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // system messages e.g. "Task assigned: Fix login bug" shown inline in chat
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
