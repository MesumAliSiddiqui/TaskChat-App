import { useState, useRef } from 'react';
import { Keyboard } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { compressAndConvertToBase64 } from '../utils/imageCompressor';

export const useChatInput = ({
  chat,
  user,
  socket,
  connected,
  replyingTo,
  setReplyingTo,
  sendOrQueueMessage,
  setMessages,
  navigation,
  title,
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const [cursorSelection, setCursorSelection] = useState({ start: 0, end: 0 });
  const [attachmentVisible, setAttachmentVisible] = useState(false);
  
  const inputRef = useRef(null);

  const toggleEmojiPicker = () => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setShowEmojiPicker(true);
    }
  };

  const handleTyping = (val) => {
    setText(val);
    if (socket && connected) {
      if (val.length > 0) socket.emit('typing:start', { chatId: chat._id });
      else socket.emit('typing:stop', { chatId: chat._id });
    }
  };

  const handleSelectEmoji = (emoji) => {
    const start = cursorSelection?.start ?? text.length;
    const end = cursorSelection?.end ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    handleTyping(newText);
    const newCursor = start + emoji.length;
    setCursorSelection({ start: newCursor, end: newCursor });
  };

  const handleEmojiBackspace = () => {
    const start = cursorSelection?.start ?? text.length;
    const end = cursorSelection?.end ?? text.length;
    if (start === 0 && end === 0) return;

    if (start !== end) {
      const newText = text.slice(0, start) + text.slice(end);
      handleTyping(newText);
      setCursorSelection({ start, end: start });
    } else {
      const chars = Array.from(text.slice(0, start));
      chars.pop();
      const newBefore = chars.join('');
      const newText = newBefore + text.slice(end);
      handleTyping(newText);
      const newCursor = newBefore.length;
      setCursorSelection({ start: newCursor, end: newCursor });
    }
  };

  const sendMessage = () => {
    if (!text.trim()) return;

    let finalMessage = text.trim();
    if (replyingTo) {
      const replySnippet = replyingTo.text
        ? (replyingTo.text.startsWith('ðŸ“ ') ? replyingTo.text.split('\n')[0] : replyingTo.text)
        : (replyingTo.image || replyingTo.attachmentUrl ? 'ðŸ“· Photo' : 'Message');

      const snippet = replySnippet.replace(/^ðŸ’¬ \[Reply to .*?: ".*?"\]\n/, '');
      const replyName = replyingTo.sender?.name || ((replyingTo.sender?._id || replyingTo.sender?.id) === (user?._id || user?.id) ? 'You' : 'User');

      finalMessage = `ðŸ’¬ [Reply to ${replyName}: "${snippet}"]\n${finalMessage}`;
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      chat: chat._id,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
      text: finalMessage,
      createdAt: new Date().toISOString(),
      status: 'sending',
      _isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    sendOrQueueMessage({
      tempId,
      chatId: chat._id,
      text: finalMessage,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
    });

    setText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const handleAttachmentSelect = async (option) => {
    setAttachmentVisible(false);
    try {
      if (option === 'image' || option === 'gallery') {
        const selected = await ImagePicker.openPicker({
          multiple: true,
          maxFiles: 10,
          mediaType: 'photo',
        });
        
        if (selected) {
          const images = Array.isArray(selected) ? selected : [selected];
          
          for (const image of images) {
            if (image && image.path) {
              const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              let base64Data = null;
              if (compressAndConvertToBase64) {
                 base64Data = await compressAndConvertToBase64(image.path);
              }

              const optimisticMessage = {
                _id: tempId,
                tempId,
                chat: chat._id,
                sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
                image: image.path,
                createdAt: new Date().toISOString(),
                status: 'sending',
                _isOptimistic: true,
              };
              setMessages((prev) => [...prev, optimisticMessage]);

              sendOrQueueMessage({
                tempId,
                chatId: chat._id,
                attachmentUrl: base64Data,
                attachmentType: 'image',
                sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
              });
            }
          }
        }
      } else if (option === 'camera') {
        navigation.navigate('CameraScreen', { chatId: chat._id, chat, title });
      } else if (option === 'location') {
        navigation.navigate('MapScreen', { chatId: chat._id, chat, title });
      }
    } catch (err) {
      if (err.code !== 'E_PICKER_CANCELLED') {
        console.warn('Attachment error:', err);
      }
    }
  };

  return {
    text,
    setText,
    showEmojiPicker,
    setShowEmojiPicker,
    activeEmojiCategory,
    setActiveEmojiCategory,
    cursorSelection,
    setCursorSelection,
    attachmentVisible,
    setAttachmentVisible,
    inputRef,
    toggleEmojiPicker,
    handleTyping,
    handleSelectEmoji,
    handleEmojiBackspace,
    sendMessage,
    handleAttachmentSelect,
  };
};
