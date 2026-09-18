const path = require('path');
const fs = require('fs');
const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Call = require('../models/Call');
const { protect } = require('../middleware/auth');
const { saveBase64Image } = require('../utils/fileUpload');

const router = express.Router();

const MEMBER_FIELDS = 'name email avatar phone about isOnline lastSeen role privacy';

const sanitizeChat = (chatDoc, requesterId) => {
  if (!chatDoc) return chatDoc;
  const chat = chatDoc.toObject ? chatDoc.toObject() : { ...chatDoc };
  if (Array.isArray(chat.members)) {
    const requesterIdStr = requesterId?.toString();
    const requesterInChat = chat.members.some(
      (m) => (m._id ? m._id.toString() : m.toString()) === requesterIdStr
    );

    chat.members = chat.members.map((member) => {
      if (!member || typeof member !== 'object') return member;
      const m = member.toObject ? member.toObject() : { ...member };
      const privacy = m.privacy || {};

      if (privacy.showOnlineStatus === false) {
        delete m.isOnline;
        delete m.lastSeen;
      }

      if (privacy.publicProfilePhoto === false && !requesterInChat) {
        m.avatar = '';
      }

      delete m.privacy;
      return m;
    });
  }

  let unreadCount = 0;
  if (chat.unreadCounts) {
    const requesterIdStr = requesterId?.toString();
    if (typeof chat.unreadCounts.get === 'function') {
      unreadCount = chat.unreadCounts.get(requesterIdStr) || 0;
    } else if (typeof chat.unreadCounts === 'object') {
      unreadCount = chat.unreadCounts[requesterIdStr] || 0;
    }
  }
  chat.unreadCount = Math.max(0, parseInt(unreadCount, 10) || 0);
  delete chat.unreadCounts;

  return chat;
};

router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const rawChats = await Chat.find({ members: req.user._id })
      .populate('members', MEMBER_FIELDS)
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = rawChats.length > limit;
    const pageChats = hasMore ? rawChats.slice(0, limit) : rawChats;
    const sanitized = pageChats.map((c) => sanitizeChat(c, req.user._id));
    const sorted = sanitized.sort((a, b) => {
      const timeA = Math.max(
        a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0,
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
        a.createdAt ? new Date(a.createdAt).getTime() : 0
      );
      const timeB = Math.max(
        b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0,
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        b.createdAt ? new Date(b.createdAt).getTime() : 0
      );
      return timeB - timeA;
    });

    res.json({ chats: sorted, hasMore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/private', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    if (req.user._id.toString() === userId.toString()) {
      return res.status(400).json({ message: 'Cannot start a private chat with yourself' });
    }

    const pairKey = Chat.getPairKey(req.user._id, userId);

    const chat = await Chat.findOneAndUpdate(
      { isGroup: false, pairKey },
      {
        $setOnInsert: {
          isGroup: false,
          pairKey,
          members: [req.user._id, userId],
          createdBy: req.user._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('members', MEMBER_FIELDS);

    res.json(sanitizeChat(chat, req.user._id));
  } catch (err) {
    if (err.code === 11000) {
      try {
        const pairKey = Chat.getPairKey(req.user._id, req.body.userId);
        const existing = await Chat.findOne({ isGroup: false, pairKey }).populate('members', MEMBER_FIELDS);
        if (existing) {
          return res.json(sanitizeChat(existing, req.user._id));
        }
      } catch (retryErr) {
        return res.status(500).json({ message: retryErr.message });
      }
    }
    res.status(500).json({ message: err.message });
  }
});

router.post('/group', protect, async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds || memberIds.length < 1) {
    return res.status(400).json({ message: 'Group name and members are required' });
  }
  const members = Array.from(new Set([...memberIds, req.user._id.toString()]));

  const chat = await Chat.create({
    isGroup: true,
    name,
    members,
    admins: [req.user._id],
    createdBy: req.user._id,
  });
  const populated = await chat.populate('members', MEMBER_FIELDS);
  res.status(201).json(sanitizeChat(populated, req.user._id));
});

router.get('/:chatId/messages', protect, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.members.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not allowed to view messages for this chat' });
    }

    const rawMessages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = rawMessages.length > limit;
    const pageMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

    pageMessages.reverse();

    res.json({ messages: pageMessages, hasMore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:chatId/members', protect, async (req, res) => {
  try {
    const { userId, memberIds } = req.body;
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.isGroup) return res.status(404).json({ message: 'Group not found' });
    if (!chat.admins.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Only group admins can add members' });
    }

    const idsToAdd = Array.isArray(memberIds) ? memberIds : userId ? [userId] : [];

    if (idsToAdd.length === 0) {
      return res.status(400).json({ message: 'Please provide user ID(s) to add' });
    }

    let modified = false;
    for (const id of idsToAdd) {
      const idStr = String(id);
      if (!chat.members.map(String).includes(idStr)) {
        chat.members.push(idStr);
        modified = true;
      }
    }

    if (modified) await chat.save();

    const populated = await chat.populate('members', MEMBER_FIELDS);
    res.json(sanitizeChat(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:chatId/leave', protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userIdStr = req.user._id.toString();
    if (!chat.members.map(String).includes(userIdStr)) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    chat.members = chat.members.filter((m) => m.toString() !== userIdStr);
    chat.admins = chat.admins.filter((a) => a.toString() !== userIdStr);

    if (chat.admins.length === 0 && chat.members.length > 0) {
      chat.admins.push(chat.members[0]);
    }

    await chat.save();
    res.json({ message: 'Left group successfully', chatId: chat._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:chatId/upload', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, image, caption } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    let attachmentUrl = '';
    if (image) {
      attachmentUrl = await saveBase64Image(image, 'media');
    }

    let parsedReplyTo = null;
    if (req.body.replyTo) {
      try {
        parsedReplyTo = typeof req.body.replyTo === 'string' ? JSON.parse(req.body.replyTo) : req.body.replyTo;
      } catch (e) { }
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: text || caption || '',
      attachmentUrl,
      replyTo: parsedReplyTo,
      deliveredTo: [req.user._id],
      readBy: [req.user._id],
    });

    const recipientIds = chat.members
      .map((m) => (m?._id ? m._id.toString() : m.toString()))
      .filter((id) => id !== req.user._id.toString());

    const incUpdates = {};
    for (const recipientId of recipientIds) {
      incUpdates[`unreadCounts.${recipientId}`] = 1;
    }

    const now = new Date();
    if (Object.keys(incUpdates).length > 0) {
      await Chat.findByIdAndUpdate(chatId, {
        $set: { lastMessage: message._id, updatedAt: now },
        $inc: incUpdates,
      });
    } else {
      chat.lastMessage = message._id;
      chat.updatedAt = now;
      await chat.save();
    }

    const populated = await message.populate('sender', 'name avatar');

    const io = req.app.get('io');
    if (io) {
      const memberRooms = chat.members.map((m) => (m?._id ? m._id.toString() : m.toString()));
      io.to([chatId, ...memberRooms]).emit('message:new', populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:chatId/read', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userIdStr = req.user._id.toString();

    await Chat.findByIdAndUpdate(chatId, {
      $set: { [`unreadCounts.${userIdStr}`]: 0 },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(userIdStr).emit('chat:unread', { chatId, unreadCount: 0 });
    }

    res.json({ success: true, chatId, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:chatId/calls', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    const calls = await Call.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .populate('caller', 'name avatar')
      .populate('callee', 'name avatar')
      .limit(50);

    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:chatId/messages', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messageIds, clearAll } = req.body;

    if (!clearAll && (!Array.isArray(messageIds) || messageIds.length === 0)) {
      return res.status(400).json({ message: 'messageIds array or clearAll flag is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.map(String).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    if (clearAll) {
      await Message.deleteMany({ chat: chatId });
    } else {
      await Message.deleteMany({ _id: { $in: messageIds }, chat: chatId });
    }

    const remainingLatest = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
    await Chat.findByIdAndUpdate(chatId, {
      $set: { lastMessage: remainingLatest ? remainingLatest._id : null, updatedAt: new Date() },
    });

    const io = req.app.get('io');
    if (io) {
      const memberRooms = chat.members.map((m) => (m?._id ? m._id.toString() : m.toString()));
      if (clearAll) {
        io.to([chatId, ...memberRooms]).emit('chat:cleared', { chatId });
      } else {
        io.to([chatId, ...memberRooms]).emit('message:delete', {
          chatId,
          messageIds,
          deletedBy: req.user._id.toString(),
        });
      }
    }

    res.json({ success: true, messageIds, clearAll });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:chatId/avatar', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.isGroup) {
      return res.status(403).json({ message: 'Cannot change avatar for individual contact chats' });
    }

    const userIdStr = req.user._id.toString();
    if (!chat.members.map(String).includes(userIdStr)) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const avatarUrl = await saveBase64Image(image, 'group_avatar');
    chat.avatar = avatarUrl;
    chat.updatedAt = new Date();
    await chat.save();

    const populated = await chat.populate('members', MEMBER_FIELDS);
    const sanitized = sanitizeChat(populated, req.user._id);

    const io = req.app.get('io');
    if (io) {
      const memberRooms = chat.members.map((m) => (m?._id ? m._id.toString() : m.toString()));
      io.to([chatId, ...memberRooms]).emit('chat:update', sanitized);
    }

    res.json({ success: true, avatar: avatarUrl, chat: sanitized });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/', protect, async (req, res) => {
  try {
    const { chatIds } = req.body;
    if (!Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ message: 'chatIds array is required' });
    }

    const userIdStr = req.user._id.toString();
    const deletedIds = [];

    for (const id of chatIds) {
      const chat = await Chat.findById(id);
      if (!chat) continue;
      if (!chat.members.map(String).includes(userIdStr)) continue;

      if (chat.isGroup) {
        chat.members = chat.members.filter((m) => m.toString() !== userIdStr);
        chat.admins = chat.admins.filter((a) => a.toString() !== userIdStr);
        if (chat.members.length === 0) {
          await Message.deleteMany({ chat: id });
          await Chat.findByIdAndDelete(id);
        } else {
          if (chat.admins.length === 0 && chat.members.length > 0) {
            chat.admins.push(chat.members[0]);
          }
          await chat.save();
        }
      } else {
        await Message.deleteMany({ chat: id });
        await Chat.findByIdAndDelete(id);
      }
      deletedIds.push(id.toString());
    }

    const io = req.app.get('io');
    if (io) {
      io.to(userIdStr).emit('chat:deleted', { chatIds: deletedIds });
    }

    res.json({ success: true, deletedChatIds: deletedIds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userIdStr = req.user._id.toString();

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.members.map(String).includes(userIdStr)) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    if (chat.isGroup) {
      chat.members = chat.members.filter((m) => m.toString() !== userIdStr);
      chat.admins = chat.admins.filter((a) => a.toString() !== userIdStr);
      if (chat.members.length === 0) {
        await Message.deleteMany({ chat: chatId });
        await Chat.findByIdAndDelete(chatId);
      } else {
        if (chat.admins.length === 0 && chat.members.length > 0) {
          chat.admins.push(chat.members[0]);
        }
        await chat.save();
      }
    } else {
      await Message.deleteMany({ chat: chatId });
      await Chat.findByIdAndDelete(chatId);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(userIdStr).emit('chat:deleted', { chatIds: [chatId] });
    }

    res.json({ success: true, chatId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;