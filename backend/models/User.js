const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['boss', 'manager', 'employee'],
      default: 'employee',
    },
    // Who this user reports to (manager reports to boss, employee reports to manager or boss)
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    avatar: { type: String, default: '' },
    // Required + unique so every account can be matched by phone number,
    // WhatsApp-style. Stored in E.164-ish format e.g. "+923219164878".
    phone: { type: String, required: true, unique: true },
    about: { type: String, default: '' },
    baseSalary: { type: Number, default: 0 },
    currentSalary: { type: Number, default: 0 }, // running salary after deductions this cycle
    salaryAdjustments: [
      {
        previousBaseSalary: { type: Number, default: 0 },
        newBaseSalary: { type: Number, default: 0 },
        previousCurrentSalary: { type: Number, default: 0 },
        newCurrentSalary: { type: Number, default: 0 },
        reason: { type: String, default: '' },
        adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        adjustedAt: { type: Date, default: Date.now },
      },
    ],
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    notificationPrefs: {
      taskAssignments: { type: Boolean, default: true },
      contactSupport: { type: Boolean, default: true },
      mentions: { type: Boolean, default: false },
      groupActivity: { type: Boolean, default: false },
      vibrate: { type: Boolean, default: true },
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true },
      publicProfilePhoto: { type: Boolean, default: true },
    },
    pushTokens: [{ type: String }],
  },
  { timestamps: true }
);

// Keep currentSalary in sync with baseSalary on creation
userSchema.pre('save', function (next) {
  if (this.isNew && !this.currentSalary) {
    this.currentSalary = this.baseSalary;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);