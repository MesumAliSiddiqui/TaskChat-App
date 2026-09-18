const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // A task can go to one employee or a whole team (array of users)
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    deadline: { type: Date, required: true },
    createdAt2: { type: Date, default: Date.now }, // separate from timestamps.createdAt for % elapsed math

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending',
    },

    // Salary deduction rules
    deductionAmount: { type: Number, default: 0 }, // flat amount deducted if missed
    deductionPercent: { type: Number, default: 0 }, // OR percent of base salary deducted if missed
    penaltyApplied: { type: Boolean, default: false },

    // Reminder tracking so we don't spam the same reminder repeatedly
    reminderSentAt: { type: Date, default: null },
    finalReminderSentAt: { type: Date, default: null },

    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
