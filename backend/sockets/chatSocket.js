const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Call = require('../models/Call');

const userSockets = new Map();
const activeCallTimers = new Map();
const activeCalls = new Map();

const CALL_TIMEOUT_MS = 35000;

const clearCallTimer = (callIdStr) => {
  if (activeCallTimers.has(callIdStr)) {
    clearTimeout(activeCallTimers.get(callIdStr));
    activeCallTimers.delete(callIdStr);
  }
};

const initChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    const userIdStr = user._id.toString();

    if (!userSockets.has(userIdStr)) {
      userSockets.set(userIdStr, new Set());
    }
    const sockets = userSockets.get(userIdStr);
    const isFirstConnection = sockets.size === 0;
    sockets.add(socket.id);

    console.log(`${user.name} connected (${socket.id}) - active connections: ${sockets.size}`);

    socket.join(user._id.toString());
    if (user.role) {
      socket.join(`role:${user.role}`);
    }

    for (const activeCall of activeCalls.values()) {
      if (activeCall.status === 'ringing') {
        if (!activeCall.isGroup && activeCall.calleeId === userIdStr) {
          socket.emit('call:incoming', {
            callId: activeCall.callId,
            chatId: activeCall.chatId,
            callerId: activeCall.callerId,
            callerName: activeCall.callerName,
            callerAvatar: activeCall.callerAvatar,
            callType: activeCall.type,
            isGroup: false,
          });
        } else if (activeCall.isGroup && activeCall.callerId !== userIdStr) {
          Chat.findById(activeCall.chatId).then(chat => {
            if (chat && chat.members.map(String).includes(userIdStr)) {
              socket.emit('call:incoming', {
                callId: activeCall.callId,
                chatId: activeCall.chatId,
                callerId: activeCall.callerId,
                callerName: activeCall.callerName,
                callerAvatar: activeCall.callerAvatar,
                callType: activeCall.type,
                isGroup: true,
                groupName: activeCall.groupName,
              });
            }
          }).catch(() => { });
        }
      }
    }

    if (isFirstConnection) {
      User.findByIdAndUpdate(user._id, { isOnline: true })
        .then(async () => {
          const freshUser = await User.findById(user._id).select('privacy');
          if (freshUser?.privacy?.showOnlineStatus !== false) {
            socket.broadcast.emit('user:online', { userId: user._id });
          }
        })
        .catch((e) => console.warn('Error marking user online:', e));
    }

    socket.on('chat:join', (chatId) => {
      socket.join(chatId);
    });

    socket.on('chat:leave', (chatId) => {
      socket.leave(chatId);
    });

    socket.on('message:send', async ({ chatId, text, attachmentUrl, image, replyTo }, callback) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.members.map(String).includes(user._id.toString())) {
          return callback?.({ error: 'Not a member of this chat' });
        }

        let finalAttachmentUrl = attachmentUrl || image || '';

        if (finalAttachmentUrl && (finalAttachmentUrl.startsWith('data:image') || finalAttachmentUrl.startsWith('data:audio'))) {
          try {
            const matches = finalAttachmentUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const ext = matches[1].split('/')[1] || (matches[1].startsWith('audio') ? 'mp3' : 'jpg');
              const buffer = Buffer.from(matches[2], 'base64');
              const fileName = `media_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`;
              const uploadsDir = path.join(__dirname, '../uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              const filePath = path.join(uploadsDir, fileName);
              await fs.promises.writeFile(filePath, buffer);
              finalAttachmentUrl = `/uploads/${fileName}`;
            }
          } catch (writeErr) {
            console.warn('Could not write socket media to disk, keeping payload:', writeErr);
          }
        }

        const message = await Message.create({
          chat: chatId,
          sender: user._id,
          text: text || '',
          attachmentUrl: finalAttachmentUrl,
          replyTo: replyTo || null,
          deliveredTo: [user._id],
          readBy: [user._id],
        });

        const recipientIds = chat.members
          .map((m) => (m?._id ? m._id.toString() : m.toString()))
          .filter((id) => id !== user._id.toString());

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
        const memberRooms = (chat.members || []).map((m) => (m._id || m).toString());
        io.to([chatId, ...memberRooms]).emit('message:new', populated);

        callback?.({ success: true, message: populated });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('typing:start', ({ chatId }) => {
      socket.to(chatId).emit('typing:start', { chatId, userId: user._id, name: user.name });
    });
    socket.on('typing:stop', ({ chatId }) => {
      socket.to(chatId).emit('typing:stop', { chatId, userId: user._id });
    });

    socket.on('message:read', async ({ chatId, messageIds }) => {
      try {
        const userIdStr = user._id.toString();
        await Chat.findByIdAndUpdate(chatId, {
          $set: { [`unreadCounts.${userIdStr}`]: 0 },
        });

        if (Array.isArray(messageIds) && messageIds.length > 0) {
          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: user._id } }
          );
        }

        socket.emit('chat:unread', { chatId, unreadCount: 0 });

        const reader = await User.findById(user._id).select('privacy');
        if (reader?.privacy?.readReceipts !== false) {
          socket.to(chatId).emit('message:read', { chatId, messageIds, readerId: user._id });
        }
      } catch (err) {
        console.warn('Error in message:read handler:', err);
      }
    });

    socket.on('message:delete', async ({ chatId, messageIds }, callback) => {
      try {
        if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) {
          return callback?.({ error: 'chatId and messageIds are required' });
        }

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.members.map(String).includes(user._id.toString())) {
          return callback?.({ error: 'Not a member of this chat' });
        }

        await Message.deleteMany({
          _id: { $in: messageIds },
          chat: chatId,
        });

        const remainingLatest = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
        await Chat.findByIdAndUpdate(chatId, {
          $set: { lastMessage: remainingLatest ? remainingLatest._id : null, updatedAt: new Date() },
        });

        const memberRooms = (chat.members || []).map((m) => (m._id || m).toString());
        io.to([chatId, ...memberRooms]).emit('message:delete', {
          chatId,
          messageIds,
          deletedBy: user._id.toString(),
        });

        callback?.({ success: true, messageIds });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:invite', async ({ chatId, calleeId, isGroup, groupName }, callback) => {
      try {
        if (!chatId) {
          return callback?.({ error: 'chatId is required' });
        }

        const callerIdStr = user._id.toString();

        if (isGroup) {
          const chat = await Chat.findById(chatId);
          if (!chat || !chat.members.map(String).includes(callerIdStr)) {
            return callback?.({ error: 'Not a member of this group' });
          }

          const call = await Call.create({
            chat: chatId,
            caller: user._id,
            callee: null,
            isGroup: true,
            type: 'audio',
            status: 'missed',
            startedAt: new Date(),
          });

          const callIdStr = call._id.toString();

          activeCalls.set(callIdStr, {
            callId: callIdStr,
            chatId: chatId.toString(),
            callerId: callerIdStr,
            callerName: user.name,
            callerAvatar: user.avatar,
            isGroup: true,
            groupName: groupName || chat.name || 'Group',
            type: 'audio',
            status: 'ringing',
          });

          const recipientIds = chat.members
            .map((m) => (m?._id ? m._id.toString() : m.toString()))
            .filter((id) => id !== callerIdStr);

          for (const rId of recipientIds) {
            io.to(rId).emit('call:incoming', {
              callId: callIdStr,
              chatId: chatId.toString(),
              callerId: callerIdStr,
              callerName: user.name,
              callerAvatar: user.avatar,
              callType: 'audio',
              isGroup: true,
              groupName: groupName || chat.name || 'Group',
            });
          }

          const timer = setTimeout(async () => {
            try {
              activeCallTimers.delete(callIdStr);
              const active = activeCalls.get(callIdStr);
              activeCalls.delete(callIdStr);

              if (active && active.status === 'ringing') {
                await Call.findByIdAndUpdate(call._id, {
                  status: 'missed',
                  endedAt: new Date(),
                });

                io.to(callerIdStr).emit('call:missed', {
                  callId: callIdStr,
                  chatId: chatId.toString(),
                  reason: 'timeout',
                });

                for (const rId of recipientIds) {
                  io.to(rId).emit('call:missed', {
                    callId: callIdStr,
                    chatId: chatId.toString(),
                    reason: 'timeout',
                  });
                }
              }
            } catch (tErr) {
              console.warn('Error in group call:invite timeout:', tErr);
            }
          }, CALL_TIMEOUT_MS);

          activeCallTimers.set(callIdStr, timer);
          return callback?.({ success: true, callId: callIdStr });
        }

        if (!calleeId) {
          return callback?.({ error: 'calleeId is required for 1:1 call' });
        }

        const calleeIdStr = calleeId.toString();

        const call = await Call.create({
          chat: chatId,
          caller: user._id,
          callee: calleeId,
          isGroup: false,
          type: 'audio',
          status: 'missed',
          startedAt: new Date(),
        });

        const callIdStr = call._id.toString();

        activeCalls.set(callIdStr, {
          callId: callIdStr,
          chatId: chatId.toString(),
          callerId: callerIdStr,
          callerName: user.name,
          callerAvatar: user.avatar,
          calleeId: calleeIdStr,
          isGroup: false,
          type: 'audio',
          status: 'ringing',
        });

        io.to(calleeIdStr).emit('call:incoming', {
          callId: callIdStr,
          chatId: chatId.toString(),
          callerId: callerIdStr,
          callerName: user.name,
          callerAvatar: user.avatar,
          callType: 'audio',
          isGroup: false,
        });

        const timer = setTimeout(async () => {
          try {
            activeCallTimers.delete(callIdStr);
            const active = activeCalls.get(callIdStr);
            activeCalls.delete(callIdStr);

            if (active && active.status === 'ringing') {
              await Call.findByIdAndUpdate(call._id, {
                status: 'missed',
                endedAt: new Date(),
              });

              io.to(callerIdStr).emit('call:missed', {
                callId: callIdStr,
                chatId: chatId.toString(),
                calleeId: calleeIdStr,
                reason: 'timeout',
              });

              io.to(calleeIdStr).emit('call:missed', {
                callId: callIdStr,
                chatId: chatId.toString(),
                callerId: callerIdStr,
                reason: 'timeout',
              });
            }
          } catch (tErr) {
            console.warn('Error in call:invite timeout:', tErr);
          }
        }, CALL_TIMEOUT_MS);

        activeCallTimers.set(callIdStr, timer);
        callback?.({ success: true, callId: callIdStr });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:answer', async ({ callId, targetUserId, sdp }, callback) => {
      try {
        if (!callId) return callback?.({ error: 'callId is required' });
        const callIdStr = callId.toString();

        clearCallTimer(callIdStr);

        const active = activeCalls.get(callIdStr);
        if (active) {
          active.status = 'answered';
        }

        await Call.findByIdAndUpdate(callId, {
          status: 'answered',
        });

        const destinationId = targetUserId?.toString() || active?.callerId;
        if (destinationId) {
          io.to(destinationId).emit('call:answer', {
            callId: callIdStr,
            sdp,
            answererId: user._id.toString(),
          });
        }
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:offer', ({ callId, targetUserId, sdp }, callback) => {
      try {
        const callIdStr = callId?.toString();
        const active = callIdStr ? activeCalls.get(callIdStr) : null;
        const destinationId = targetUserId?.toString() || active?.calleeId;

        if (destinationId) {
          io.to(destinationId).emit('call:offer', {
            callId: callIdStr,
            sdp,
            senderId: user._id.toString(),
          });
        }
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:ice-candidate', ({ callId, targetUserId, candidate }, callback) => {
      try {
        const callIdStr = callId?.toString();
        const active = callIdStr ? activeCalls.get(callIdStr) : null;
        const destinationId =
          targetUserId?.toString() ||
          (active?.callerId === user._id.toString() ? active?.calleeId : active?.callerId);

        if (destinationId) {
          io.to(destinationId).emit('call:ice-candidate', {
            callId: callIdStr,
            candidate,
            senderId: user._id.toString(),
          });
        }
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:decline', async ({ callId, targetUserId }, callback) => {
      try {
        const callIdStr = callId?.toString();
        if (callIdStr) {
          clearCallTimer(callIdStr);
          await Call.findByIdAndUpdate(callId, {
            status: 'declined',
            endedAt: new Date(),
          });
        }

        const active = callIdStr ? activeCalls.get(callIdStr) : null;
        const destinationId = targetUserId?.toString() || active?.callerId;

        if (destinationId) {
          io.to(destinationId).emit('call:decline', {
            callId: callIdStr,
            declinerId: user._id.toString(),
          });
        }

        if (callIdStr) activeCalls.delete(callIdStr);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:busy', async ({ callId, targetUserId }, callback) => {
      try {
        const callIdStr = callId?.toString();
        if (callIdStr) {
          clearCallTimer(callIdStr);
          await Call.findByIdAndUpdate(callId, {
            status: 'declined',
            endedAt: new Date(),
          });
        }

        const active = callIdStr ? activeCalls.get(callIdStr) : null;
        const destinationId = targetUserId?.toString() || active?.callerId;

        if (destinationId) {
          io.to(destinationId).emit('call:busy', {
            callId: callIdStr,
            calleeId: user._id.toString(),
          });
        }

        if (callIdStr) activeCalls.delete(callIdStr);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('call:end', async ({ callId, targetUserId }, callback) => {
      try {
        const callIdStr = callId?.toString();
        if (callIdStr) {
          clearCallTimer(callIdStr);
          await Call.findByIdAndUpdate(callId, {
            endedAt: new Date(),
          });
        }

        const active = callIdStr ? activeCalls.get(callIdStr) : null;
        const destinationId =
          targetUserId?.toString() ||
          (active?.callerId === user._id.toString() ? active?.calleeId : active?.callerId);

        if (destinationId) {
          io.to(destinationId).emit('call:end', {
            callId: callIdStr,
            endedBy: user._id.toString(),
          });
        }

        if (callIdStr) activeCalls.delete(callIdStr);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('disconnect', async () => {
      const userIdStr = user._id.toString();

      for (const [cId, activeCall] of activeCalls.entries()) {
        if (activeCall.callerId === userIdStr || activeCall.calleeId === userIdStr) {
          clearCallTimer(cId);
          activeCalls.delete(cId);
          const otherId = activeCall.callerId === userIdStr ? activeCall.calleeId : activeCall.callerId;
          io.to(otherId).emit('call:end', {
            callId: cId,
            endedBy: userIdStr,
            reason: 'disconnected',
          });
          Call.findByIdAndUpdate(cId, { endedAt: new Date() }).catch(() => { });
        }
      }

      const sockets = userSockets.get(userIdStr);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userIdStr);
        }
      }

      const remainingSocketsCount = userSockets.get(userIdStr)?.size || 0;
      console.log(`${user.name} disconnected (${socket.id}) - remaining active: ${remainingSocketsCount}`);

      if (remainingSocketsCount === 0) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen });
        const freshUser = await User.findById(user._id).select('privacy');
        if (freshUser?.privacy?.showOnlineStatus !== false) {
          socket.broadcast.emit('user:offline', { userId: user._id, lastSeen });
        }
      }
    });
  });
};

initChatSocket.userSockets = userSockets;
initChatSocket.activeCallTimers = activeCallTimers;
initChatSocket.activeCalls = activeCalls;
initChatSocket.clearCallTimer = clearCallTimer;
initChatSocket.getUserSocketCount = (userId) => {
  const idStr = userId?._id ? userId._id.toString() : userId?.toString?.();
  return userSockets.get(idStr)?.size || 0;
};

module.exports = initChatSocket;