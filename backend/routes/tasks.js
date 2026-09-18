const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const { protect, allowRoles } = require('../middleware/auth');
const { applyDeduction } = require('../utils/salary');

const router = express.Router();

const getTaskRecipientsWithRoles = async (task) => {
  const recipientMap = new Map();

  if (Array.isArray(task.assignedTo)) {
    for (const assignee of task.assignedTo) {
      const id = assignee?._id ? assignee._id.toString() : assignee?.toString?.();
      const role = assignee?.role;
      if (id) recipientMap.set(id, role || 'employee');
    }
  }

  if (task.assignedBy) {
    const creatorId = task.assignedBy?._id
      ? task.assignedBy._id.toString()
      : task.assignedBy?.toString?.();
    const role = task.assignedBy?.role;
    if (creatorId) recipientMap.set(creatorId, role || 'manager');
  }

  const bossesAndManagers = await User.find({ role: { $in: ['boss', 'manager'] } }).select('_id role');
  bossesAndManagers.forEach((u) => {
    recipientMap.set(u._id.toString(), u.role);
  });

  return recipientMap;
};

const sanitizeTaskPayload = (taskDoc, recipientUserId, recipientRole) => {
  if (!taskDoc) return taskDoc;
  const obj = taskDoc.toObject ? taskDoc.toObject() : JSON.parse(JSON.stringify(taskDoc));

  if (['boss', 'manager'].includes(recipientRole)) {
    return obj;
  }

  if (Array.isArray(obj.assignedTo)) {
    obj.assignedTo = obj.assignedTo.map((assignee) => {
      if (assignee && typeof assignee === 'object') {
        const assigneeId = assignee._id ? assignee._id.toString() : '';
        if (assigneeId !== recipientUserId.toString()) {
          const sanitized = { ...assignee };
          delete sanitized.baseSalary;
          delete sanitized.currentSalary;
          return sanitized;
        }
      }
      return assignee;
    });
  }

  return obj;
};

const emitTargetedTaskEvent = async (io, eventName, taskDoc) => {
  if (!io) return;
  const recipients = await getTaskRecipientsWithRoles(taskDoc);
  for (const [userId, role] of recipients.entries()) {
    const safePayload = sanitizeTaskPayload(taskDoc, userId, role);
    io.to(userId).emit(eventName, safePayload);
  }
};

router.post('/', protect, allowRoles('boss', 'manager'), async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      deadline,
      deductionAmount,
      deductionPercent,
    } = req.body;

    if (!title || !assignedTo || !assignedTo.length || !deadline) {
      return res.status(400).json({ message: 'title, assignedTo and deadline are required' });
    }

    const task = await Task.create({
      title,
      description,
      assignedBy: req.user._id,
      assignedTo,
      deadline,
      deductionAmount: deductionAmount || 0,
      deductionPercent: deductionPercent || 0,
    });

    const populated = await task.populate([
      { path: 'assignedTo', select: 'name avatar baseSalary currentSalary role' },
      { path: 'assignedBy', select: 'name avatar role' },
    ]);

    await emitTargetedTaskEvent(req.app.get('io'), 'task:new', populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  const filter =
    req.user.role === 'employee'
      ? { assignedTo: req.user._id }
      : { $or: [{ assignedBy: req.user._id }, { assignedTo: req.user._id }] };

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name avatar baseSalary currentSalary role')
    .populate('assignedBy', 'name avatar role')
    .sort({ deadline: 1 });
  res.json(tasks);
});

router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name avatar baseSalary currentSalary role')
      .populate('assignedBy', 'name avatar role');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isAssignee = task.assignedTo.some((u) => u._id.toString() === req.user._id.toString());
    const isCreator = task.assignedBy && task.assignedBy._id.toString() === req.user._id.toString();
    if (!isAssignee && !isCreator && !['boss', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed to view this task' });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', protect, async (req, res) => {
  const { status } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const isAssignee = task.assignedTo.map(String).includes(req.user._id.toString());
  const isCreator = task.assignedBy && task.assignedBy.toString() === req.user._id.toString();
  if (!isAssignee && !isCreator && !['boss', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed to update this task' });
  }

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date();
    task.completedBy = req.user._id;

    if (task.completedAt > task.deadline && !task.penaltyApplied) {
      await applyDeduction(task);
      task.penaltyApplied = true;
    }
  } else {
    task.completedAt = null;
    task.completedBy = null;
  }
  await task.save();

  const populated = await task.populate([
    { path: 'assignedTo', select: 'name avatar baseSalary currentSalary role' },
    { path: 'assignedBy', select: 'name avatar role' },
  ]);

  await emitTargetedTaskEvent(req.app.get('io'), 'task:updated', populated);
  res.json(populated);
});

router.delete('/', protect, async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: 'taskIds array is required' });
    }

    const tasks = await Task.find({ _id: { $in: taskIds } });
    if (tasks.length === 0) {
      return res.status(404).json({ message: 'No tasks found' });
    }

    const nonCompleted = tasks.filter((t) => t.status !== 'completed');
    if (nonCompleted.length > 0) {
      return res.status(400).json({
        message: 'Strict validation error: only tasks with completed status can be deleted.',
      });
    }

    for (const task of tasks) {
      const isAssignee = Array.isArray(task.assignedTo) && task.assignedTo.map(String).includes(req.user._id.toString());
      const isCreator = task.assignedBy && task.assignedBy.toString() === req.user._id.toString();
      if (!isAssignee && !isCreator && !['boss', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: `Not allowed to delete task ${task._id}` });
      }
    }

    await Task.deleteMany({ _id: { $in: taskIds } });

    const io = req.app.get('io');
    if (io) {
      for (const task of tasks) {
        await emitTargetedTaskEvent(io, 'task:deleted', { _id: task._id.toString(), title: task.title });
      }
    }

    res.json({ message: 'Tasks deleted successfully', deletedCount: tasks.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status !== 'completed') {
      return res.status(400).json({
        message: 'Strict validation error: only tasks with completed status can be deleted.',
      });
    }

    const isAssignee = Array.isArray(task.assignedTo) && task.assignedTo.map(String).includes(req.user._id.toString());
    const isCreator = task.assignedBy && task.assignedBy.toString() === req.user._id.toString();
    if (!isAssignee && !isCreator && !['boss', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed to delete this task' });
    }

    await Task.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      await emitTargetedTaskEvent(io, 'task:deleted', { _id: task._id.toString(), title: task.title });
    }

    res.json({ message: 'Task deleted successfully', taskId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.getTaskRecipientsWithRoles = getTaskRecipientsWithRoles;
router.sanitizeTaskPayload = sanitizeTaskPayload;

module.exports = router;