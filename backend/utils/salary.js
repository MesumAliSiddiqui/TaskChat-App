const Task = require('../models/Task');
const User = require('../models/User');

/**
 * Deducts salary from every user assigned to a missed/late task.
 * Supports either a flat deductionAmount or a deductionPercent of baseSalary.
 * Marks the task as penaltyApplied so it's never deducted twice.
 *
 * Uses an atomic findOneAndUpdate guard at the start to ensure only one process
 * (e.g. background cron vs. late completion PATCH) can ever apply the deduction.
 * If zero documents match (already claimed/applied), bails out early returning the
 * task unchanged.
 */
const applyDeduction = async (task) => {
  const updatedTask = await Task.findOneAndUpdate(
    { _id: task._id, penaltyApplied: false },
    { $set: { penaltyApplied: true } },
    { new: true }
  );

  // If update matched zero documents, another process already applied the penalty
  if (!updatedTask) {
    return task;
  }

  const users = await User.find({ _id: { $in: task.assignedTo } });

  await Promise.all(
    users.map(async (user) => {
      let amount = task.deductionAmount || 0;
      if (task.deductionPercent) {
        amount += (task.deductionPercent / 100) * user.baseSalary;
      }
      user.currentSalary = Math.max(0, user.currentSalary - amount);
      await user.save();
    })
  );

  task.penaltyApplied = true;
  task.status = task.status === 'completed' ? 'completed' : 'overdue';

  if (task.status === 'overdue') {
    await Task.updateOne({ _id: task._id }, { $set: { status: 'overdue' } });
  }

  return task;
};

module.exports = { applyDeduction };

