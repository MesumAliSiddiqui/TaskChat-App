import { useState, useMemo, useEffect } from 'react';
import api from '../api/client';

const PAGE_LIMIT = 50;

export const useChatMessages = ({
  chat,
  user,
  socket,
  connected,
  pendingQueue,
  setTypingUser,
  setSelectedMessageIds,
}) => {
  const [messages, setMessages] = useState([]);
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const loadInitialMessages = async () => {
    if (!chat?._id) return;
    try {
      const { data } = await api.get(`/chats/${chat._id}/messages`, {
        params: { skip: 0, limit: PAGE_LIMIT },
      });
      const initialMsgs = Array.isArray(data) ? data : data.messages || [];

      // Preserve and append any pending offline messages for this chat
      const chatPending = (pendingQueue || [])
        .filter((q) => q.chatId === chat._id)
        .map((q) => ({
          _id: q.tempId,
          tempId: q.tempId,
          chat: q.chatId,
          sender: q.sender || { _id: user.id, name: user.name, avatar: user.avatar },
          text: q.text,
          image: q.image,
          attachmentUrl: q.attachmentUrl,
          createdAt: q.createdAt,
          status: q.status || 'sending',
          error: q.error,
          _isOptimistic: true,
        }));

      const existingIds = new Set(initialMsgs.map((m) => m._id));
      const filteredPending = chatPending.filter((p) => !existingIds.has(p._id));

      setMessages([...initialMsgs, ...filteredPending]);
      setHasMore(data.hasMore !== undefined ? data.hasMore : initialMsgs.length >= PAGE_LIMIT);
      
    } catch (err) {
      console.warn('Failed to load initial messages:', err);
    }
  };

  const loadOlderMessages = async () => {
    if (!chat?._id || !hasMore || loadingOlder) return;
    try {
      setLoadingOlder(true);
      const nonOptimistic = messages.filter((m) => !m._isOptimistic);
      const skip = nonOptimistic.length;
      const { data } = await api.get(`/chats/${chat._id}/messages`, {
        params: { skip, limit: PAGE_LIMIT },
      });
      const olderMsgs = Array.isArray(data) ? data : data.messages || [];
      if (olderMsgs.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const uniqueOlder = olderMsgs.filter((m) => !existingIds.has(m._id));
          return [...uniqueOlder, ...prev];
        });
      }
      setHasMore(data.hasMore !== undefined ? data.hasMore : olderMsgs.length >= PAGE_LIMIT);
    } catch (err) {
      console.warn('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (!chat?._id) return;

    loadInitialMessages();

    if (!socket) return;
    socket.emit('chat:join', chat._id);
    socket.emit('message:read', { chatId: chat._id });
    api.post(`/chats/${chat._id}/read`).catch(() => { });

    const onNewMessage = (msg) => {
      // If user is currently in this room, mark incoming message as read
      if (msg.sender?._id !== user.id) {
        socket.emit('message:read', { chatId: chat._id, messageIds: [msg._id] });
      }

      setMessages((prev) => {
        // Prevent exact duplicates
        if (prev.find((m) => m._id === msg._id)) return prev;

        // Check if there is a matching optimistic message waiting to be updated
        const optIndex = prev.findIndex(
          (m) =>
            m._isOptimistic &&
            (m.text === msg.text || (m.image && msg.attachmentUrl))
        );

        if (optIndex !== -1) {
          const updated = [...prev];
          updated[optIndex] = {
            ...msg,
            // Keep local image file:// URI for seamless sender display
            image: prev[optIndex].image || msg.attachmentUrl,
          };
          return updated;
        }

        return [...prev, msg];
      });
    };

    const onTypingStart = ({ chatId, name, userId }) => {
      if (chatId === chat._id && userId !== user.id) setTypingUser(name);
    };
    const onTypingStop = ({ chatId }) => {
      if (chatId === chat._id) setTypingUser(null);
    };

    const onMessageDelete = ({ chatId: targetChatId, messageIds }) => {
      if (targetChatId === chat._id && Array.isArray(messageIds)) {
        setMessages((prev) =>
          prev.filter((m) => !messageIds.includes((m._id || m.tempId)?.toString()))
        );
        setSelectedMessageIds((prev) =>
          prev.filter((id) => !messageIds.includes(id))
        );
      }
    };

    const onChatCleared = ({ chatId: targetChatId }) => {
      if (targetChatId === chat._id) {
        setMessages([]); // Instantly empty the chat UI
        setSelectedMessageIds([]);
      }
    };

    socket.on('message:new', onNewMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:delete', onMessageDelete);
    socket.on('chat:cleared', onChatCleared);

    return () => {
      socket.emit('chat:leave', chat._id);
      socket.emit('message:read', { chatId: chat._id });
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('message:delete', onMessageDelete);
      socket.off('chat:cleared', onChatCleared);
    };
  }, [socket, chat?._id, user.id]);

  return {
    messages,
    setMessages,
    reversedMessages,
    hasMore,
    loadingOlder,
    loadInitialMessages,
    loadOlderMessages,
  };
};
