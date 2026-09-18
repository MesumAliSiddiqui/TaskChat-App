const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: '' }, // used only for groups
    avatar: { type: String, default: '' }, // group icon
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // group admins (boss/manager typically)
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Computed deterministic key for 1:1 chats (sorted user ids). Null for group chats.
    pairKey: {
      type: String,
      default: null,
      index: {
        unique: true,
        sparse: true,
      },
    },
    // Map of userId -> unread count for that user in this chat
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Retain existing index for fast lookup of a user's chats
chatSchema.index({ members: 1, isGroup: 1 });

// Helper to compute deterministic pairKey from two user IDs
chatSchema.statics.getPairKey = function (userId1, userId2) {
  if (!userId1 || !userId2) return null;
  const id1 = userId1._id ? userId1._id.toString() : userId1.toString();
  const id2 = userId2._id ? userId2._id.toString() : userId2.toString();
  const sorted = [id1, id2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

// Ensure pairKey is always computed before save for 1:1 chats
chatSchema.pre('save', function (next) {
  if (!this.isGroup && Array.isArray(this.members) && this.members.length === 2 && !this.pairKey) {
    const sorted = this.members.map((m) => (m._id ? m._id.toString() : m.toString())).sort();
    this.pairKey = sorted.join('_');
  }
  next();
});

module.exports = mongoose.model('Chat', chatSchema);

