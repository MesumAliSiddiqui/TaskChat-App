import { useState } from 'react';
import { Platform, ToastAndroid, Alert } from 'react-native';
import api from '../api/client';

export const useForwardMessages = ({
  messages,
  selectedMessageIds,
  setSelectedMessageIds,
  user,
  chat,
  sendOrQueueMessage,
  setMessages,
}) => {
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardMessages, setForwardMessages] = useState([]);
  const [forwardChats, setForwardChats] = useState([]);
  const [forwardSelectedChatIds, setForwardSelectedChatIds] = useState([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const handleActionForward = async () => {
    const selected = messages.filter((m) =>
      selectedMessageIds.includes((m._id || m.tempId)?.toString())
    );
    if (selected.length === 0) return;

    setForwardMessages(selected);
    setSelectedMessageIds([]);
    setForwardSelectedChatIds([]);
    setForwardSearch('');
    setForwardModalVisible(true);

    try {
      const res = await api.get('/chats');
      setForwardChats(res.data.chats || []);
    } catch (err) {
      console.warn('Error fetching chats for forward:', err);
    }
  };

  const toggleForwardChatSelection = (id) => {
    setForwardSelectedChatIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const executeForwardMessages = async () => {
    if (forwardSelectedChatIds.length === 0 || forwardMessages.length === 0) return;
    setForwarding(true);

    try {
      for (const targetChatId of forwardSelectedChatIds) {
        for (const msg of forwardMessages) {
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const payload = {
            tempId,
            chatId: targetChatId,
            text: msg.text || '',
            image: msg.image || msg.attachmentUrl || null,
            attachmentUrl: msg.attachmentUrl || msg.image || null,
            sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
          };

          if (targetChatId === chat._id) {
            const optimisticMsg = {
              _id: tempId,
              tempId,
              chat: chat._id,
              sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
              text: msg.text || '',
              image: msg.image || msg.attachmentUrl || null,
              attachmentUrl: msg.attachmentUrl || msg.image || null,
              createdAt: new Date().toISOString(),
              status: 'sending',
              _isOptimistic: true,
            };
            setMessages((prev) => [...prev, optimisticMsg]);
          }

          sendOrQueueMessage(payload);
        }
      }

      const count = forwardMessages.length;
      const recipientCount = forwardSelectedChatIds.length;
      const successNotice = `${count} ${count === 1 ? 'message' : 'messages'} forwarded to ${recipientCount} ${recipientCount === 1 ? 'chat' : 'chats'}`;

      if (Platform.OS === 'android') {
        ToastAndroid.show(successNotice, ToastAndroid.SHORT);
      } else {
        Alert.alert('Forwarded', successNotice);
      }

      setForwardModalVisible(false);
      setForwardSelectedChatIds([]);
      setForwardMessages([]);
    } catch (err) {
      console.error('Execute forward error:', err);
      Alert.alert('Error', 'Failed to forward message(s). Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  return {
    forwardModalVisible,
    setForwardModalVisible,
    forwardMessages,
    forwardChats,
    forwardSelectedChatIds,
    forwardSearch,
    setForwardSearch,
    forwarding,
    handleActionForward,
    toggleForwardChatSelection,
    executeForwardMessages,
  };
};
