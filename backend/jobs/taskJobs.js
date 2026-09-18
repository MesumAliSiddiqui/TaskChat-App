const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const { applyDeduction } = require('../utils/salary');

/**
 * Resolves all target user IDs that should receive task deadline reminders or penalty alerts:
 * - All assignees in assignedTo
 * - Assigner / Creator (assignedBy)
 * - All bosses and managers
 */
const getTaskTargetUserIds = async (task) => {
  const targetIds = new Set();

  if (Array.isArray(task.assignedTo)) {
    task.assignedTo.forEach((u) => {
      const id = u?._id ? u._id.toString() : u?.toString?.();
      if (id) targetIds.add(id);
    });
  }

  if (task.assignedBy) {
    const creatorId = task.assignedBy?._id
      ? task.assignedBy._id.toString()
      : task.assignedBy?.toString?.();
    if (creatorId) targetIds.add(creatorId);
  }

  const bossesAndManagers = await User.find({ role: { $in: ['boss', 'manager'] } }).select('_id');
  bossesAndManagers.forEach((u) => {
    targetIds.add(u._id.toString());
  });

  return Array.from(targetIds);
};

/**
 * Starts two recurring jobs:
 * 1. Reminder job - warns assignees when a task is close to its deadline
 *    and hasn't been completed yet. Fires an in-app + socket notification.
 * 2. Deduction job - once the deadline has fully passed on an incomplete
 *    task, automatically deducts salary and marks it overdue.
 */
const startTaskJobs = (io) => {
  const reminderCron = process.env.REMINDER_CRON || '*/10 * * * *';
  const deductionCron = process.env.SALARY_DEDUCTION_CRON || '*/30 * * * *';
  const thresholdPercent = Number(process.env.REMINDER_THRESHOLD_PERCENT || 75);

  // --- Reminder job ---
  cron.schedule(reminderCron, async () => {
    const activeTasks = await Task.find({
      status: { $in: ['pending', 'in_progress'] },
      deadline: { $gt: new Date() },
    }).populate('assignedTo', 'name');

    const now = Date.now();

    for (const task of activeTasks) {
      const start = new Date(task.createdAt).getTime();
      const end = new Date(task.deadline).getTime();
      const totalDuration = end - start;
      if (totalDuration <= 0) continue;

      const elapsedPercent = ((now - start) / totalDuration) * 100;
      const minutesLeft = Math.round((end - now) / 60000);

      // First reminder at threshold (e.g. 75% of time used)
      if (elapsedPercent >= thresholdPercent && !task.reminderSentAt) {
        task.reminderSentAt = new Date();
        await task.save();

        const payload = {
          taskId: task._id,
          title: task.title,
          assignedTo: task.assignedTo.map((u) => (u._id ? u._id.toString() : u.toString())),
          message: `Reminder: "${task.title}" is due soon (~${minutesLeft} min left).`,
          minutesLeft,
        };

        const targetIds = await getTaskTargetUserIds(task);
        for (const userId of targetIds) {
          io.to(userId).emit('task:reminder', payload);
        }
      }

      // Final urgent reminder in the last 15 minutes
      if (minutesLeft <= 15 && minutesLeft > 0 && !task.finalReminderSentAt) {
        task.finalReminderSentAt = new Date();
        await task.save();

        const payload = {
          taskId: task._id,
          title: task.title,
          assignedTo: task.assignedTo.map((u) => (u._id ? u._id.toString() : u.toString())),
          message: `Urgent: "${task.title}" is due in ${minutesLeft} minutes!`,
          minutesLeft,
          urgent: true,
        };

        const targetIds = await getTaskTargetUserIds(task);
        for (const userId of targetIds) {
          io.to(userId).emit('task:reminder', payload);
        }
      }
    }
  });

  // --- Deduction job ---
  cron.schedule(deductionCron, async () => {
    const overdueTasks = await Task.find({
      status: { $in: ['pending', 'in_progress'] },
      deadline: { $lte: new Date() },
      penaltyApplied: false,
    }).populate('assignedTo', 'name currentSalary');

    for (const task of overdueTasks) {
      const updated = await applyDeduction(task);

      // If penalty was already applied by another process or bailed out, skip emitting penalty notification
      if (!updated || !updated.penaltyApplied) {
        continue;
      }

      const payload = {
        taskId: updated._id,
        title: updated.title,
        assignedTo: updated.assignedTo.map((u) => (u._id ? u._id.toString() : u.toString())),
        message: `Deadline missed for "${updated.title}". Salary has been deducted.`,
      };

      const targetIds = await getTaskTargetUserIds(updated);
      for (const userId of targetIds) {
        io.to(userId).emit('task:penalty', payload);
      }
    }
  });

  console.log('Task reminder & salary deduction cron jobs started (Offline mode)');
};

startTaskJobs.getTaskTargetUserIds = getTaskTargetUserIds;

module.exports = startTaskJobs;