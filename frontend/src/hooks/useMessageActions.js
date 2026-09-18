import { useState } from 'react';
import { Platform, Clipboard, ToastAndroid, Alert } from 'react-native';
import api from '../api/client';

export const useMessageActions = ({ messages, setMessages, socket, connected, chat }) => {
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [starredMessageIds, setStarredMessageIds] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  const handleActionCopy = () => {
    const selected = messages.filter((m) =>
      selectedMessageIds.includes((m._id || m.tempId)?.toString())
    );
    const textToCopy = selected
      .map((m) => m.text)
      .filter(Boolean)
      .join('\n');

    if (textToCopy) {
      Clipboard.setString(textToCopy);
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          selected.length > 1 ? `${selected.length} messages copied` : 'Message copied',
          ToastAndroid.SHORT
        );
      } else {
        Alert.alert('Copied', selected.length > 1 ? `${selected.length} messages copied` : 'Message copied');
      }
    }
    setSelectedMessageIds([]);
  };

  const handleActionReply = () => {
    if (selectedMessageIds.length !== 1) return;
    const target = messages.find(
      (m) => (m._id || m.tempId)?.toString() === selectedMessageIds[0]
    );
    if (target) {
      setReplyingTo(target);
    }
    setSelectedMessageIds([]);
  };

  const handleActionStar = () => {
    const allAlreadyStarred = selectedMessageIds.every((id) =>
      starredMessageIds.includes(id)
    );
    let updatedStarred;
    if (allAlreadyStarred) {
      updatedStarred = starredMessageIds.filter(
        (id) => !selectedMessageIds.includes(id)
      );
      if (Platform.OS === 'android') {
        ToastAndroid.show('Message unstarred', ToastAndroid.SHORT);
      }
    } else {
      updatedStarred = Array.from(
        new Set([...starredMessageIds, ...selectedMessageIds])
      );
      if (Platform.OS === 'android') {
        ToastAndroid.show('Message starred', ToastAndroid.SHORT);
      }
    }
    setStarredMessageIds(updatedStarred);
    setSelectedMessageIds([]);
  };

  const handleActionDelete = () => {
    const count = selectedMessageIds.length;
    const idsToDelete = [...selectedMessageIds];

    Alert.alert(
      count > 1 ? 'Delete messages?' : 'Delete message?',
      count > 1
        ? `Are you sure you want to delete these ${count} messages?`
        : 'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages((prev) =>
              prev.filter((m) => !idsToDelete.includes((m._id || m.tempId)?.toString()))
            );
            setSelectedMessageIds([]);

            const realIds = idsToDelete.filter((id) => !id.startsWith('temp_'));
            if (realIds.length > 0) {
              if (socket && connected) {
                socket.emit('message:delete', { chatId: chat._id, messageIds: realIds });
              } else {
                api
                  .delete(`/chats/${chat._id}/messages`, { data: { messageIds: realIds } })
                  .catch((err) => console.warn('Delete message error:', err));
              }
            }
          },
        },
      ]
    );
  };

  const handleLongPressMessage = (item) => {
    const id = (item._id || item.tempId)?.toString();
    if (!id) return;
    if (selectedMessageIds.includes(id)) {
      setSelectedMessageIds(selectedMessageIds.filter((mId) => mId !== id));
    } else {
      setSelectedMessageIds([...selectedMessageIds, id]);
    }
  };

  const handlePressMessage = (item) => {
    const id = (item._id || item.tempId)?.toString();
    if (!id) return;
    if (selectedMessageIds.length > 0) {
      handleLongPressMessage(item);
    }
  };

  return {
    selectedMessageIds,
    setSelectedMessageIds,
    starredMessageIds,
    setStarredMessageIds,
    replyingTo,
    setReplyingTo,
    handleActionCopy,
    handleActionReply,
    handleActionStar,
    handleActionDelete,
    handleLongPressMessage,
    handlePressMessage,
  };
};
