import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { BASE_URL } from '../api/client';
import { displayLocalNotification } from '../services/pushNotificationService';
import { navigationRef } from '../navigation/AppNavigator';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const isFlushingRef = useRef(false);
  const [notifications, setNotifications] = useState([]);

  // Offline message queue: Array<{ tempId, chatId, text, image, attachmentUrl, sender, status: 'sending'|'failed', error?: string, createdAt: string }>
  const [pendingQueue, setPendingQueue] = useState([]);
  const pendingQueueRef = useRef([]);
  pendingQueueRef.current = pendingQueue;

  // Listeners for message lifecycle events: Map<tempId, Set<function>>
  const subscribersRef = useRef(new Map());

  const notifySubscribers = (tempId, event) => {
    const subs = subscribersRef.current.get(tempId);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(event);
        } catch (e) {
          console.warn('[SocketContext] Subscriber error:', e);
        }
      });
    }
  };

  const subscribeToMessage = useCallback((tempId, callback) => {
    if (!subscribersRef.current.has(tempId)) {
      subscribersRef.current.set(tempId, new Set());
    }
    subscribersRef.current.get(tempId).add(callback);

    return () => {
      const subs = subscribersRef.current.get(tempId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) subscribersRef.current.delete(tempId);
      }
    };
  }, []);

  const removePendingMessage = useCallback((tempId) => {
    setPendingQueue((prev) => prev.filter((item) => item.tempId !== tempId));
    subscribersRef.current.delete(tempId);
  }, []);

  const updateMessageStatus = useCallback((tempId, status, error = null, confirmedMessage = null) => {
    setPendingQueue((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, status, error } : item))
    );
    notifySubscribers(tempId, { tempId, status, error, confirmedMessage });
  }, []);

  // Flush the queue when reconnecting
  const flushQueue = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || isFlushingRef.current) return;

    const queueSnapshot = [...pendingQueueRef.current];
    if (queueSnapshot.length === 0) return;

    isFlushingRef.current = true;
    console.log(`[SocketQueue] Flushing ${queueSnapshot.length} queued message(s) in FIFO order...`);

    for (const item of queueSnapshot) {
      // Only process messages currently in 'sending' state
      if (item.status !== 'sending') continue;

      try {
        await new Promise((resolve) => {
          socket.emit(
            'message:send',
            {
              chatId: item.chatId,
              text: item.text,
              image: item.image,
              attachmentUrl: item.attachmentUrl,
              replyTo: item.replyTo,
            },
            (response) => {
              if (response?.error) {
                console.warn(`[SocketQueue] Message ${item.tempId} failed:`, response.error);
                updateMessageStatus(item.tempId, 'failed', response.error);
              } else {
                console.log(`[SocketQueue] Message ${item.tempId} delivered and confirmed`);
                notifySubscribers(item.tempId, {
                  tempId: item.tempId,
                  status: 'sent',
                  confirmedMessage: response?.message,
                });
                removePendingMessage(item.tempId);
              }
              resolve();
            }
          );
        });
      } catch (emitErr) {
        console.warn(`[SocketQueue] Error emitting queued message ${item.tempId}:`, emitErr.message);
        updateMessageStatus(item.tempId, 'failed', emitErr.message);
      }
    }

    isFlushingRef.current = false;
  }, [updateMessageStatus, removePendingMessage]);

  // Queue a message or send immediately if connected
  const sendOrQueueMessage = useCallback(
    ({ tempId, chatId, text, image, attachmentUrl, sender, replyTo }) => {
      const socket = socketRef.current;
      const isSocketConnected = Boolean(socket && socket.connected);

      const queueItem = {
        tempId,
        chatId,
        text,
        image,
        attachmentUrl,
        sender,
        replyTo,
        status: 'sending',
        createdAt: new Date().toISOString(),
      };

      // Always track in pending queue until acknowledged by server
      setPendingQueue((prev) => [...prev, queueItem]);

      if (isSocketConnected) {
        // Connected: attempt immediate transmission
        socket.emit(
          'message:send',
          { chatId, text, image, attachmentUrl, replyTo },
          (response) => {
            if (response?.error) {
              console.warn(`[SocketContext] Immediate send error for ${tempId}:`, response.error);
              updateMessageStatus(tempId, 'failed', response.error);
            } else {
              notifySubscribers(tempId, {
                tempId,
                status: 'sent',
                confirmedMessage: response?.message,
              });
              removePendingMessage(tempId);
            }
          }
        );
      } else {
        // Disconnected: will be automatically retried when socket reconnects
        console.log(`[SocketContext] Socket disconnected - message ${tempId} held in offline queue`);
      }

      return queueItem;
    },
    [updateMessageStatus, removePendingMessage]
  );

  // Retry sending a failed or queued message
  const retryQueuedMessage = useCallback(
    (tempId) => {
      const item = pendingQueueRef.current.find((m) => m.tempId === tempId);
      if (!item) {
        console.warn(`[SocketContext] Cannot retry: message ${tempId} not found in queue`);
        return;
      }

      console.log(`[SocketContext] Retrying message ${tempId}...`);
      updateMessageStatus(tempId, 'sending', null);

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          'message:send',
          {
            chatId: item.chatId,
            text: item.text,
            image: item.image,
            attachmentUrl: item.attachmentUrl,
            replyTo: item.replyTo,
          },
          (response) => {
            if (response?.error) {
              updateMessageStatus(tempId, 'failed', response.error);
            } else {
              notifySubscribers(tempId, {
                tempId,
                status: 'sent',
                confirmedMessage: response?.message,
              });
              removePendingMessage(tempId);
            }
          }
        );
      } else {
        console.log(`[SocketContext] Socket currently disconnected; ${tempId} marked as sending and will flush upon reconnect`);
      }
    },
    [updateMessageStatus, removePendingMessage]
  );

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(BASE_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SocketContext] Connected to server');
      setConnected(true);

      // If reconnected after prior disconnect or if pending items exist, flush queue
      if (wasDisconnectedRef.current || pendingQueueRef.current.length > 0) {
        console.log('[SocketContext] Reconnected - triggering queue flush');
        flushQueue();
      }
      wasDisconnectedRef.current = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketContext] Disconnected from server:', reason);
      setConnected(false);
      wasDisconnectedRef.current = true;
    });

    // Handle global incoming messages to trigger local Notifee banners
    socket.on('message:new', (msg) => {
      const currentUserId = user.id || user._id;
      if (msg.sender?._id !== currentUserId) {
        // Suppress banner if actively looking at this specific chat
        const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
        const activeChatId = currentRoute?.name === 'ChatRoom' ? (currentRoute.params?.chat?._id || currentRoute.params?.chatId) : null;
        const msgChatId = msg.chat?._id || msg.chat;

        if (activeChatId !== msgChatId) {
          const isGroup = Boolean(msg.chat?.isGroup);
          const title = isGroup ? `${msg.chat?.name || 'Group'} (${msg.sender?.name})` : (msg.sender?.name || 'New Message');
          let body = msg.text;

          if (!body) {
            if (msg.attachmentType === 'audio' || msg.text?.includes('Voice note')) body = '🎤 Voice note';
            else if (msg.image || msg.attachmentUrl) body = '📷 Photo';
            else body = 'Sent an attachment';
          }

          displayLocalNotification({
            title,
            body,
            data: {
              type: 'chat',
              chatId: msgChatId,
              avatar: msg.sender?.avatar || '',
              isGroup: String(isGroup),
              title: msg.sender?.name || 'Chat'
            }
          });
        }
      }
    });

    // Handle incoming calls to trigger a local banner (in case RNCallKeep isn't handling foreground fully)
    socket.on('call:incoming', (callData) => {
      const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
      if (currentRoute?.name !== 'IncomingCall' && currentRoute?.name !== 'OngoingCall') {
        displayLocalNotification({
          title: callData.isGroup ? callData.groupName : callData.callerName,
          body: callData.isGroup ? 'Incoming Group Call...' : 'Incoming Voice Call...',
          data: {
            type: 'call',
            chatId: callData.chatId,
            callId: callData.callId,
            avatar: callData.callerAvatar || '',
            isGroup: callData.isGroup ? 'true' : 'false',
            callerName: callData.callerName
          }
        });
      }
    });

    // Reminder / penalty events only apply if the current user is an assignee
    const pushIfRelevant = (payload, type) => {
      const currentUserId = user.id || user._id;
      const isForMe = payload.assignedTo?.some((id) => id === currentUserId);
      if (isForMe) {
        setNotifications((prev) => [{ id: Date.now(), ...payload }, ...prev]);

        // Trigger local push banner replacing Firebase FCM
        let title = type === 'reminder' ? 'Task Reminder' : 'Task Penalty Applied';
        if (payload.urgent) title = 'Urgent Task Reminder';

        displayLocalNotification({
          title,
          body: payload.message,
          data: {
            type: 'task',
            taskId: payload.taskId,
            title: payload.title
          }
        });
      }
    };

    socket.on('task:reminder', (payload) => pushIfRelevant(payload, 'reminder'));
    socket.on('task:penalty', (payload) => pushIfRelevant(payload, 'penalty'));

    return () => {
      socket.off('message:new');
      socket.off('call:incoming');
      socket.off('task:reminder');
      socket.off('task:penalty');
      socket.disconnect();
    };
  }, [token, user, flushQueue]);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        notifications,
        dismissNotification,
        pendingQueue,
        sendOrQueueMessage,
        retryQueuedMessage,
        subscribeToMessage,
        removePendingMessage,
        flushQueue,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;