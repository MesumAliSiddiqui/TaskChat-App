const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { protect, allowRoles } = require('../middleware/auth');
const { saveBase64Image } = require('../utils/fileUpload');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const [users, userChats] = await Promise.all([
    User.find({ _id: { $ne: req.user._id } })
      .select('name email role avatar phone about isOnline lastSeen privacy')
      .lean(),
    Chat.find({ members: req.user._id }).select('members').lean(),
  ]);

  const sharedUserIds = new Set();
  userChats.forEach((c) => {
    c.members?.forEach((m) => sharedUserIds.add(m.toString()));
  });

  const sanitized = users.map((u) => {
    const isShared = sharedUserIds.has(u._id.toString());
    const privacy = u.privacy || {};

    if (privacy.showOnlineStatus === false) {
      delete u.isOnline;
      delete u.lastSeen;
    }

    if (privacy.publicProfilePhoto === false && !isShared) {
      u.avatar = '';
    }

    delete u.privacy;
    return u;
  });

  res.json(sanitized);
});

router.post('/', protect, allowRoles('boss', 'manager'), async (req, res) => {
  try {
    const { name, email, password, phone, role, baseSalary } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    if (req.user.role === 'manager' && role !== 'employee') {
      return res.status(403).json({ message: 'Managers can only add employees' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) return res.status(400).json({ message: 'Phone number already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      phone: phone.trim(),
      role: role || 'employee',
      reportsTo: req.user._id,
      baseSalary: baseSalary || 0,
      currentSalary: baseSalary || 0,
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email or phone number already registered' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me', protect, async (req, res) => {
  try {
    const { name, avatar, about } = req.body;
    if (name !== undefined) req.user.name = name;
    if (avatar !== undefined) req.user.avatar = avatar;
    if (about !== undefined) req.user.about = about;
    await req.user.save();
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/me/avatar', protect, async (req, res) => {
  try {
    const { image, avatar } = req.body;
    const imagePayload = image || avatar;

    if (!imagePayload) {
      return res.status(400).json({ message: 'Base64 image is required' });
    }

    const relativeUrl = await saveBase64Image(imagePayload, `avatar_${req.user._id}`);

    // Use a fixed public base URL from env instead of req.protocol/req.get('host').
    // Behind Railway's reverse proxy, req.protocol can report 'http' even though
    // the real public site is https, which produced http:// avatar URLs that
    // Android silently refused to load (cleartext traffic blocked in release builds).
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const fullUrl = `${baseUrl}${relativeUrl}`;

    req.user.avatar = fullUrl;
    await req.user.save();

    res.json({ avatar: req.user.avatar, user: req.user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me/notification-prefs', protect, async (req, res) => {
  try {
    const { taskAssignments, contactSupport, mentions, groupActivity, vibrate } = req.body;
    if (!req.user.notificationPrefs) {
      req.user.notificationPrefs = {};
    }
    if (taskAssignments !== undefined) req.user.notificationPrefs.taskAssignments = Boolean(taskAssignments);
    if (contactSupport !== undefined) req.user.notificationPrefs.contactSupport = Boolean(contactSupport);
    if (mentions !== undefined) req.user.notificationPrefs.mentions = Boolean(mentions);
    if (groupActivity !== undefined) req.user.notificationPrefs.groupActivity = Boolean(groupActivity);
    if (vibrate !== undefined) req.user.notificationPrefs.vibrate = Boolean(vibrate);

    req.user.markModified('notificationPrefs');
    await req.user.save();
    res.json({ notificationPrefs: req.user.notificationPrefs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me/privacy', protect, async (req, res) => {
  try {
    const { showOnlineStatus, readReceipts, publicProfilePhoto } = req.body;
    if (!req.user.privacy) {
      req.user.privacy = {};
    }
    if (showOnlineStatus !== undefined) req.user.privacy.showOnlineStatus = Boolean(showOnlineStatus);
    if (readReceipts !== undefined) req.user.privacy.readReceipts = Boolean(readReceipts);
    if (publicProfilePhoto !== undefined) req.user.privacy.publicProfilePhoto = Boolean(publicProfilePhoto);

    req.user.markModified('privacy');
    await req.user.save();
    res.json({ privacy: req.user.privacy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me/phone', protect, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const existing = await User.findOne({ phone: phone.trim(), _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ message: 'This phone number is already registered to another account' });
    }

    req.user.phone = phone.trim();
    await req.user.save();
    res.json({ phone: req.user.phone });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'This phone number is already registered to another account' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.post('/lookup', protect, async (req, res) => {
  try {
    const { phones } = req.body;
    if (!Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({ message: 'phones must be a non-empty array' });
    }

    const cappedPhones = phones.slice(0, 3000);

    const matches = await User.find({
      phone: { $in: cappedPhones },
      _id: { $ne: req.user._id },
    }).select('name phone avatar role isOnline about');

    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/salary', protect, async (req, res) => {
  if (
    req.user._id.toString() !== req.params.id &&
    !['boss', 'manager'].includes(req.user.role)
  ) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  const user = await User.findById(req.params.id).select(
    'name role baseSalary currentSalary reportsTo salaryAdjustments'
  );
  if (!user) return res.status(404).json({ message: 'User not found' });

  const canEdit =
    req.user.role === 'boss' ||
    (req.user.role === 'manager' && user.reportsTo?.toString() === req.user._id.toString());

  res.json({
    name: user.name,
    role: user.role,
    baseSalary: user.baseSalary,
    currentSalary: user.currentSalary,
    totalDeducted: user.baseSalary - user.currentSalary,
    reportsTo: user.reportsTo,
    canEdit,
    salaryAdjustments: ['boss', 'manager'].includes(req.user.role) ? user.salaryAdjustments : undefined,
  });
});

router.patch('/:id/salary', protect, allowRoles('boss', 'manager'), async (req, res) => {
  try {
    const { baseSalary, currentSalary, reason } = req.body;

    if (baseSalary === undefined && currentSalary === undefined) {
      return res.status(400).json({ message: 'At least one of baseSalary or currentSalary is required' });
    }

    if (baseSalary !== undefined && (isNaN(Number(baseSalary)) || Number(baseSalary) < 0)) {
      return res.status(400).json({ message: 'baseSalary must be a non-negative number' });
    }

    if (currentSalary !== undefined && (isNaN(Number(currentSalary)) || Number(currentSalary) < 0)) {
      return res.status(400).json({ message: 'currentSalary must be a non-negative number' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'manager') {
      const isDirectReport =
        targetUser.reportsTo &&
        targetUser.reportsTo.toString() === req.user._id.toString();
      if (!isDirectReport) {
        return res.status(403).json({ message: 'Managers can only adjust salary for their direct reports' });
      }
    }

    const previousBaseSalary = targetUser.baseSalary || 0;
    const previousCurrentSalary = targetUser.currentSalary || 0;

    const newBaseSalary = baseSalary !== undefined ? Number(baseSalary) : previousBaseSalary;
    const newCurrentSalary = currentSalary !== undefined ? Number(currentSalary) : previousCurrentSalary;

    const adjustment = {
      previousBaseSalary,
      newBaseSalary,
      previousCurrentSalary,
      newCurrentSalary,
      reason: reason ? String(reason).trim() : 'Manual salary adjustment',
      adjustedBy: req.user._id,
      adjustedAt: new Date(),
    };

    if (!Array.isArray(targetUser.salaryAdjustments)) {
      targetUser.salaryAdjustments = [];
    }
    targetUser.salaryAdjustments.push(adjustment);

    targetUser.baseSalary = newBaseSalary;
    targetUser.currentSalary = newCurrentSalary;

    await targetUser.save();

    res.json({
      message: 'Salary updated successfully',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        role: targetUser.role,
        baseSalary: targetUser.baseSalary,
        currentSalary: targetUser.currentSalary,
        reportsTo: targetUser.reportsTo,
      },
      adjustment,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;