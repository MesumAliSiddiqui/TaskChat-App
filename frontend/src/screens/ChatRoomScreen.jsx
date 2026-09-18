import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  BackHandler,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { colors, spacing, fontSizes } from '../theme/theme';
import RNFS from 'react-native-fs';

import AttachmentModal from '../components/AttachmentModal';
import MessageBubble from '../components/chat/MessageBubble';
import TaskBanner from '../components/chat/TaskBanner';
import ReplyBanner from '../components/chat/ReplyBanner';
import ChatInputBar from '../components/chat/ChatInputBar';
import ForwardMessageModal from '../components/chat/ForwardMessageModal';

import { useChatMessages } from '../hooks/useChatMessages';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useChatTasks } from '../hooks/useChatTasks';
import { useMessageActions } from '../hooks/useMessageActions';
import { useForwardMessages } from '../hooks/useForwardMessages';
import { useChatInput } from '../hooks/useChatInput';
import { formatRecordingTime, formatVoiceProgress, extractVoiceDuration } from '../utils/voiceHelpers';
import { getQuotedReply, getImageSource, openLocationLink } from '../utils/messageHelpers';
import { compressAndConvertToBase64 } from '../utils/imageCompressor';
import { EMOJI_CATEGORIES } from '../utils/emojiData';

const PAGE_LIMIT = 50;

const ChatRoomScreen = ({ route, navigation }) => {
  const { chat = {}, title = '' } = route.params || {};
  const { user } = useAuth();
  const {
    socket,
    connected,
    sendOrQueueMessage,
    retryQueuedMessage,
    pendingQueue,
  } = useSocket();
  const { startCall } = useCall();

  const currentUserId = (user?._id || user?.id)?.toString();
  const otherUser = chat.isGroup
    ? null
    : chat.members?.find((m) => (m._id || m.id)?.toString() !== currentUserId);

  const [typingUser, setTypingUser] = useState(null);
  const [failedImageIds, setFailedImageIds] = useState({});
  const listRef = useRef(null);

  const { activeTaskCount } = useChatTasks(chat);

  const {
    messages,
    setMessages,
    reversedMessages,
    hasMore,
    loadingOlder,
    loadInitialMessages,
    loadOlderMessages,
  } = useChatMessages({
    chat,
    user,
    socket,
    connected,
    pendingQueue,
    setTypingUser,
  });

  const {
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
  } = useMessageActions({ messages, setMessages, socket, connected, chat });

  const {
    forwardModalVisible,
    setForwardModalVisible,
    forwardSearch,
    setForwardSearch,
    forwardChats,
    forwardSelectedChatIds,
    forwarding,
    handleActionForward,
    toggleForwardChatSelection,
    executeForwardMessages,
  } = useForwardMessages({
    messages,
    selectedMessageIds,
    setSelectedMessageIds,
    user,
    chat,
    sendOrQueueMessage,
    setMessages,
  });

  const {
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
  } = useChatInput({
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
  });

  const sendVoiceNoteMessage = async (duration, waveform) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let base64Audio = null;
    try {
      const path = `${RNFS.CachesDirectoryPath}/voicenote.mp4`;
      base64Audio = await RNFS.readFile(path, 'base64');
      base64Audio = `data:audio/mp4;base64,${base64Audio}`;
    } catch (err) {
      console.warn('Failed to read voice note:', err);
    }

    const voiceNoteText = `ðŸŽ¤ Voice note (${formatRecordingTime(duration)})`;

    const optimisticMessage = {
      _id: tempId,
      tempId,
      chat: chat._id,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
      text: voiceNoteText,
      attachmentUrl: base64Audio,
      attachmentType: 'audio',
      waveform: waveform,
      createdAt: new Date().toISOString(),
      status: 'sending',
      _isOptimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    sendOrQueueMessage({
      tempId,
      chatId: chat._id,
      text: voiceNoteText,
      attachmentUrl: base64Audio,
      attachmentType: 'audio',
      waveform: waveform,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
    });
  };

  const {
    isRecording,
    isReviewing,
    isReviewPlaying,
    reviewProgress,
    setReviewProgress,
    recordingDuration,
    recordedWaveform,
    isDiscarding,
    playingVoiceId,
    voicePlaybackProgress,
    recordingPulseAnim,
    recordingPulseScaleAnim,
    slideCancelAnim,
    micDragXAnim,
    trashScaleAnim,
    trashOpacityAnim,
    panResponder,
    handleStartRecording,
    handlePressOutMic,
    handleCancelRecording,
    handleToggleReviewPlay,
    handleSendLockedVoiceNote,
    handleTogglePlayVoice,
  } = useVoiceRecorder({
    text,
    setShowEmojiPicker,
    chatId: chat._id,
    socket,
    connected,
    onSendVoiceNote: sendVoiceNoteMessage,
  });

  const handlePlaceCall = () => {
    const callText = chat.isGroup ? 'ðŸ“ž Group voice call' : 'ðŸ“ž Voice call';
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      chat: chat._id,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
      text: callText,
      createdAt: new Date().toISOString(),
      status: 'sending',
      _isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    sendOrQueueMessage({
      tempId,
      chatId: chat._id,
      text: callText,
      sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
    });

    if (chat.isGroup) {
      startCall(
        chat._id,
        null,
        'audio',
        null,
        true,
        { name: chat.name || title, avatar: chat.avatar, members: chat.members }
      );
    } else if (otherUser) {
      startCall(chat._id, otherUser._id || otherUser.id, 'audio', otherUser, false);
    }
  };

  const handleScrollToQuotedMessage = (quoted) => {
    const targetIdx = reversedMessages.findIndex(
      (m) =>
        m.text === quoted.text ||
        (m.text && m.text.includes(quoted.text)) ||
        (m.sender?.name === quoted.senderName && m.text === quoted.text)
    );
    if (targetIdx !== -1 && listRef.current) {
      try {
        listRef.current.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
      } catch (err) {
        console.warn('Scroll to quoted index error:', err);
      }
    }
  };

  const handleRetryMessage = (msg) => {
    retryQueuedMessage(msg.tempId);
  };

  useEffect(() => {
    const processImages = async () => {
      let imagesToProcess = [];
      if (route.params?.capturedImages && Array.isArray(route.params.capturedImages)) {
        imagesToProcess = route.params.capturedImages;
      } else if (route.params?.capturedImage) {
        imagesToProcess = [route.params.capturedImage];
      }

      if (imagesToProcess.length > 0) {
        for (const imgPath of imagesToProcess) {
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          let base64Data = null;
          if (compressAndConvertToBase64) {
            base64Data = await compressAndConvertToBase64(imgPath);
          }

          const optimisticMessage = {
            _id: tempId,
            tempId,
            chat: chat._id,
            sender: { _id: user.id || user._id, name: user.name, avatar: user.avatar },
            image: imgPath,
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

        navigation.setParams({ capturedImage: undefined, capturedImages: undefined });
      }
    };
    processImages();
  }, [route.params?.capturedImage, route.params?.capturedImages]);

  useEffect(() => {
    const onBackPress = () => {
      if (isRecording) {
        handleCancelRecording();
        return true;
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
        return true;
      }
      if (selectedMessageIds.length > 0) {
        setSelectedMessageIds([]);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showEmojiPicker, selectedMessageIds, isRecording]);

  useEffect(() => {
    if (selectedMessageIds.length > 0) {
      navigation.setOptions({
        headerShown: true,
        headerStyle: { backgroundColor: colors.darkBackground, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: colors.white,
        headerLeft: () => (
          <TouchableOpacity
            style={styles.headerSelectionCloseBtn}
            activeOpacity={0.7}
            onPress={() => setSelectedMessageIds([])}
          >
            <Image source={require('../assets/icons/back.png')} style={styles.headerSelectionBackIcon} />
          </TouchableOpacity>
        ),
        headerTitle: () => (
          <View style={styles.headerSelectionTitleContainer}>
            <Text style={styles.headerSelectionCountText}>{selectedMessageIds.length}</Text>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerSelectionActionsRow}>
            {selectedMessageIds.length === 1 && (
              <TouchableOpacity
                style={styles.headerSelectionActionBtn}
                activeOpacity={0.7}
                onPress={handleActionReply}
              >
                <Image source={require('../assets/icons/reply.png')} style={styles.headerSelectionActionIcon} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerSelectionActionBtn}
              activeOpacity={0.7}
              onPress={handleActionStar}
            >
              <Image source={require('../assets/icons/star.png')} style={styles.headerSelectionActionIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerSelectionActionBtn}
              activeOpacity={0.7}
              onPress={handleActionDelete}
            >
              <Image source={require('../assets/icons/delete.png')} style={styles.headerSelectionActionIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerSelectionActionBtn}
              activeOpacity={0.7}
              onPress={handleActionForward}
            >
              <Image source={require('../assets/icons/forward.png')} style={styles.headerSelectionActionIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerSelectionActionBtn}
              activeOpacity={0.7}
              onPress={handleActionCopy}
            >
              <Image source={require('../assets/icons/copy.png')} style={styles.headerSelectionActionIcon} />
            </TouchableOpacity>
          </View>
        ),
      });
      return;
    }

    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: colors.darkBackground, shadowColor: 'transparent', elevation: 0 },
      headerTintColor: colors.white,
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Image source={require('../assets/icons/back.png')} style={styles.headerBackIcon} />
        </TouchableOpacity>
      ),
      headerTitle: () => {
        const avatarUrl = chat.isGroup ? chat.avatar : otherUser?.avatar;

        return (
          <TouchableOpacity
            style={styles.headerTitleRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ContactDetail', { chat, user: otherUser })}
          >
            <View style={styles.headerAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarText}>
                  {(chat.isGroup ? chat.name : otherUser?.name)?.[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerName} numberOfLines={1}>
                {title || (chat.isGroup ? chat.name : otherUser?.name)}
              </Text>
              {typingUser ? (
                <Text style={styles.headerStatus} numberOfLines={1}>typing...</Text>
              ) : (
                <Text style={styles.headerStatus} numberOfLines={1}>
                  {chat.isGroup ? `${chat.members?.length || 0} members` : (otherUser?.isOnline ? 'Online' : 'Offline')}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      },
      headerRight: () => (
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handlePlaceCall}
            activeOpacity={0.7}
          >
            <Image source={require('../assets/icons/call.png')} style={styles.headerCustomIcon} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, chat, otherUser, title, typingUser, selectedMessageIds, starredMessageIds, messages]);


  return (
    <ImageBackground source={require('../assets/images/chat_background.png')} style={styles.backgroundImage} resizeMode="cover">
      <View style={styles.darkOverlay} />
      <View style={styles.container}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

          <TaskBanner
            activeTaskCount={activeTaskCount}
            onPress={() => navigation.navigate('Tasks', { screen: 'TaskList', params: { chatId: chat._id } })}
            styles={styles}
          />

          <FlatList
            ref={listRef}
            data={reversedMessages}
            inverted={true}
            keyExtractor={(item) => (item._id || item.tempId)?.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onTouchStart={() => {
              if (showEmojiPicker) setShowEmojiPicker(false);
            }}
            scrollEventThrottle={16}
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.5}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                user={user}
                chat={chat}
                selectedMessageIds={selectedMessageIds}
                starredMessageIds={starredMessageIds}
                failedImageIds={failedImageIds}
                playingVoiceId={playingVoiceId}
                voicePlaybackProgress={voicePlaybackProgress}
                handleLongPressMessage={handleLongPressMessage}
                handlePressMessage={handlePressMessage}
                handleTogglePlayVoice={handleTogglePlayVoice}
                handleScrollToQuotedMessage={handleScrollToQuotedMessage}
                handlePlaceCall={handlePlaceCall}
                openLocationLink={openLocationLink}
                setFailedImageIds={setFailedImageIds}
                handleRetryMessage={handleRetryMessage}
                formatVoiceProgress={formatVoiceProgress}
                extractVoiceDuration={extractVoiceDuration}
                getImageSource={getImageSource}
                getQuotedReply={getQuotedReply}
                styles={styles}
              />
            )}
            ListFooterComponent={() => {
              if (loadingOlder) {
                return (
                  <View style={styles.olderLoaderContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                );
              }
              if (hasMore && messages.length >= PAGE_LIMIT) {
                return (
                  <TouchableOpacity style={styles.loadOlderBtn} onPress={loadOlderMessages} activeOpacity={0.7}>
                    <Text style={styles.loadOlderText}>Load older messages</Text>
                  </TouchableOpacity>
                );
              }
              return null;
            }}
          />

          {typingUser && (
            <View style={styles.typingIndicatorRow}>
              <View style={styles.typingIndicatorPill}>
                <Text style={styles.typingText}>... {typingUser} is typing...</Text>
              </View>
            </View>
          )}

          <ReplyBanner
            replyingTo={replyingTo}
            user={user}
            setReplyingTo={setReplyingTo}
            getImageSource={getImageSource}
            styles={styles}
          />

          <ChatInputBar
            isReviewing={isReviewing}
            isReviewPlaying={isReviewPlaying}
            handleCancelRecording={handleCancelRecording}
            handleToggleReviewPlay={handleToggleReviewPlay}
            recordedWaveform={recordedWaveform}
            reviewProgress={reviewProgress}
            setReviewProgress={setReviewProgress}
            recordingDuration={recordingDuration}
            formatRecordingTime={formatRecordingTime}
            handleSendLockedVoiceNote={handleSendLockedVoiceNote}
            isDiscarding={isDiscarding}
            trashScaleAnim={trashScaleAnim}
            trashOpacityAnim={trashOpacityAnim}
            isRecording={isRecording}
            recordingPulseAnim={recordingPulseAnim}
            recordingPulseScaleAnim={recordingPulseScaleAnim}
            slideCancelAnim={slideCancelAnim}
            toggleEmojiPicker={toggleEmojiPicker}
            inputRef={inputRef}
            text={text}
            handleTyping={handleTyping}
            setCursorSelection={setCursorSelection}
            setShowEmojiPicker={setShowEmojiPicker}
            onAttachmentPress={() => setAttachmentVisible(true)}
            navigation={navigation}
            chat={chat}
            title={title}
            micDragXAnim={micDragXAnim}
            panResponder={panResponder}
            sendMessage={sendMessage}
            handleStartRecording={handleStartRecording}
            handlePressOutMic={handlePressOutMic}
            showEmojiPicker={showEmojiPicker}
            EMOJI_CATEGORIES={EMOJI_CATEGORIES}
            activeEmojiCategory={activeEmojiCategory}
            setActiveEmojiCategory={setActiveEmojiCategory}
            handleEmojiBackspace={handleEmojiBackspace}
            handleSelectEmoji={handleSelectEmoji}
            styles={styles}
          />

        </KeyboardAvoidingView>

        <AttachmentModal
          visible={attachmentVisible}
          onClose={() => setAttachmentVisible(false)}
          onSelectOption={handleAttachmentSelect}
        />

        <ForwardMessageModal
          forwardModalVisible={forwardModalVisible}
          setForwardModalVisible={setForwardModalVisible}
          forwardSearch={forwardSearch}
          setForwardSearch={setForwardSearch}
          forwardChats={forwardChats}
          currentUserId={currentUserId}
          forwardSelectedChatIds={forwardSelectedChatIds}
          toggleForwardChatSelection={toggleForwardChatSelection}
          executeForwardMessages={executeForwardMessages}
          forwarding={forwarding}
          styles={styles}
        />

      </View>
    </ImageBackground>
  );
};

export default ChatRoomScreen;

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 15, 25, 0.82)' },
  container: { flex: 1 },
  flex: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  headerAvatarImage: { width: '100%', height: '100%' },
  headerAvatarText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  headerTextWrap: { flex: 1, marginRight: 10 },
  headerName: { color: colors.white, fontSize: 16, fontWeight: '700' },
  headerStatus: { color: colors.gray, fontSize: 12, fontWeight: '500', marginTop: 2 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 16 },
  headerCustomIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: colors.white },
  taskBanner: { backgroundColor: colors.cardBackground, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: 16, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  taskBannerLeft: { flexDirection: 'row', alignItems: 'center' },
  taskBannerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  taskBannerIcon: { width: 18, height: 18, tintColor: colors.white, resizeMode: 'contain' },
  taskBannerTitle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  taskBannerSub: { color: colors.gray, fontSize: 12, marginTop: 1 },
  taskBannerArrow: { color: colors.gray, fontSize: 22, fontWeight: '300', marginRight: 4 },
  listContent: { padding: spacing.md, paddingBottom: spacing.lg },
  bubbleRow: { marginVertical: 6, flexDirection: 'row', alignItems: 'flex-end' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  senderAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' },
  senderAvatarImage: { width: '100%', height: '100%' },
  senderAvatarText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { backgroundColor: colors.primary, borderColor: 'transparent', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.cardBackground, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 4 },
  messageImage: { width: 240, height: 240, borderRadius: 12, marginHorizontal: -4, marginTop: 2, marginBottom: 4 },
  mapThumbnail: { width: 240, height: 140, borderRadius: 12, marginHorizontal: -4, marginTop: 2, marginBottom: 4 },
  mapFallbackCard: {
    width: 240,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    marginHorizontal: -4,
    marginTop: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  mapFallbackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  mapFallbackIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mapFallbackPinIcon: {
    width: 20,
    height: 20,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  mapFallbackTextWrap: {
    flex: 1,
  },
  mapFallbackTitle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  mapFallbackSubtitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  imageErrorContainer: {
    width: 240,
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -4,
    marginTop: 2,
    marginBottom: 4,
    padding: spacing.sm,
  },
  imageErrorIcon: { fontSize: 28, marginBottom: 6 },
  imageErrorText: { color: colors.danger, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  voiceNoteCard: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 210,
  },
  voiceNoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  voicePlayBtnMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  voicePlayBtnTheirs: {
    backgroundColor: colors.primary,
  },
  voicePlayIconText: {
    fontSize: 16,
    color: colors.white,
    marginLeft: 2,
  },
  voiceWaveWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  voiceWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 2.5,
  },
  voiceWaveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceWaveBarMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  voiceWaveBarPlayedMine: {
    backgroundColor: colors.white,
  },
  voiceWaveBarTheirs: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  voiceWaveBarPlayedTheirs: {
    backgroundColor: colors.primary,
  },
  voiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  voiceDurationText: {
    fontSize: 11,
    fontWeight: '500',
  },
  voiceDurationMine: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  voiceDurationTheirs: {
    color: colors.gray,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  voiceMicBadgeIcon: {
    width: 11,
    height: 11,
    resizeMode: 'contain',
  },
  voiceMicBadgeMine: {
    tintColor: 'rgba(255, 255, 255, 0.85)',
  },
  voiceMicBadgeTheirs: {
    tintColor: colors.gray,
  },
  voiceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  voiceAvatarContainer: {
    marginLeft: 10,
    position: 'relative',
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceAvatarCircleMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  voiceAvatarCircleTheirs: {
    backgroundColor: colors.primary,
  },
  voiceAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  voiceAvatarInitials: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  voiceAvatarBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  voiceAvatarBadgeMine: {
    backgroundColor: '#22c55e',
    borderColor: '#3730a3',
  },
  voiceAvatarBadgeTheirs: {
    backgroundColor: '#22c55e',
    borderColor: colors.cardBackground,
  },
  voiceAvatarBadgeIcon: {
    width: 9,
    height: 9,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMine: { color: colors.white },
  messageTextTheirs: { color: colors.white },
  timeRow: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 4 },
  time: { fontSize: 11, fontWeight: '500' },
  timeMine: { color: 'rgba(255,255,255,0.8)' },
  timeTheirs: { color: colors.gray },
  checkIcon: { width: 14, height: 14, resizeMode: 'contain', marginLeft: 4, tintColor: colors.white },
  typingIndicatorRow: { paddingHorizontal: spacing.md, paddingBottom: 8, alignItems: 'flex-start' },
  typingIndicatorPill: { backgroundColor: 'rgba(19, 27, 46, 0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  typingText: { color: colors.gray, fontSize: 12, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: 'transparent' },
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBackground, borderRadius: 28, paddingHorizontal: 8, paddingVertical: 4, minHeight: 52, borderWidth: 1, borderColor: colors.border },
  inputActionBtn: { padding: 8 },
  input: { flex: 1, color: colors.white, fontSize: 15, maxHeight: 100, paddingHorizontal: 4 },
  inputCustomIcon: { width: 22, height: 22, resizeMode: 'contain', tintColor: colors.gray },
  sendBtn: { backgroundColor: colors.primary, width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginLeft: 12, elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  micBtn: { backgroundColor: colors.primary },
  micBtnRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    elevation: 6,
    shadowOpacity: 0.5,
  },
  sendCustomIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: colors.white },
  sendCustomIconRecording: {
    tintColor: colors.white,
  },
  recordingWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockHintFloating: {
    position: 'absolute',
    right: 14,
    bottom: 60,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  lockHintChevron: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
  },
  lockHintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  reviewBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  reviewTrashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  reviewTrashIcon: {
    width: 20,
    height: 20,
    tintColor: '#EF4444',
    resizeMode: 'contain',
  },
  reviewPlayPauseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  reviewPlayPauseIconText: {
    color: colors.white,
    fontSize: 16,
    marginLeft: 2,
  },
  reviewWaveformWrap: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  reviewWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 2.5,
  },
  reviewWaveBarTouch: {
    paddingVertical: 2,
  },
  reviewWaveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  reviewWaveBarUnplayed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  reviewWaveBarPlayed: {
    backgroundColor: colors.primary,
  },
  reviewDurationText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  reviewSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  reviewSendIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 28,
    paddingHorizontal: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  recordingPulseDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingTimerText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 10,
    fontVariant: ['tabular-nums'],
  },
  recordingWaveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 3,
    marginRight: 12,
  },
  recordingWaveBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: '#EF4444',
  },
  slideToCancelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  slideToCancelChevron: {
    color: colors.gray,
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  slideToCancelText: {
    color: colors.gray,
    fontSize: 13,
    fontWeight: '500',
  },
  recordingTrashWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.cardBackground,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  recordingTrashIcon: {
    width: 22,
    height: 22,
    tintColor: '#EF4444',
    resizeMode: 'contain',
  },
  recordingTrashText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  inputCustomIconActive: {
    tintColor: colors.primary,
  },
  emojiPickerContainer: {
    height: 270,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  emojiCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(11, 15, 25, 0.6)',
  },
  emojiCategoryTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiCategoryTabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  emojiCategoryIcon: {
    fontSize: 18,
  },
  emojiBackspaceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBackspaceIcon: {
    color: colors.gray,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emojiGridContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  emojiCell: {
    flex: 1 / 7,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 8,
  },
  emojiChar: {
    fontSize: 26,
  },
  olderLoaderContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  loadOlderText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  clockIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    marginLeft: 4,
    tintColor: 'rgba(255, 255, 255, 0.65)',
  },
  retryBubbleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  retryBubbleIcon: {
    width: 11,
    height: 11,
    resizeMode: 'contain',
    tintColor: '#ef4444',
    marginRight: 3,
  },
  retryBubbleText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  headerSelectionCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSelectionBackIcon: {
    width: 22,
    height: 22,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  headerBackBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerBackIcon: {
    width: 22,
    height: 22,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  headerSelectionTitleContainer: {
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerSelectionCountText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSelectionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSelectionActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerSelectionActionIcon: {
    width: 22,
    height: 22,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  bubbleRowSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  bubbleSelected: {
    borderColor: '#818cf8',
    borderWidth: 1.5,
  },
  starIconText: {
    color: '#fbbf24',
    fontSize: 12,
    marginRight: 2,
    fontWeight: 'bold',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    marginHorizontal: spacing.md,
    marginBottom: 6,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    overflow: 'hidden',
  },
  replyBarAccent: {
    width: 4,
    height: 38,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarName: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBarText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
  },
  replyBarThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 6,
  },
  replyBarCloseBtn: {
    padding: 6,
    marginLeft: 4,
  },
  replyBarCloseIcon: {
    width: 16,
    height: 16,
    tintColor: colors.gray,
    resizeMode: 'contain',
  },
  quotedReplyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  quotedReplyBannerMine: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderLeftWidth: 3.5,
    borderLeftColor: '#ffffff',
  },
  quotedReplyBannerTheirs: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
  },
  quotedReplyContent: {
    flex: 1,
    paddingHorizontal: 4,
  },
  quotedReplySender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  quotedReplySenderMine: {
    color: '#ffffff',
  },
  quotedReplySenderTheirs: {
    color: colors.primary,
  },
  quotedReplySnippet: {
    fontSize: 12,
    lineHeight: 16,
  },
  quotedReplySnippetMine: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  quotedReplySnippetTheirs: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  quotedReplyThumbnail: {
    width: 34,
    height: 34,
    borderRadius: 4,
    marginLeft: 6,
  },
  /* Call Log Message Styles */
  callLogCard: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 190,
  },
  callLogContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callLogIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  callLogIconCircleMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  callLogIconCircleTheirs: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  callLogIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  callLogIconMine: {
    tintColor: '#ffffff',
  },
  callLogIconTheirs: {
    tintColor: colors.primary,
  },
  callLogDetails: {
    flex: 1,
  },
  callLogTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  callLogTitleMine: {
    color: '#ffffff',
  },
  callLogTitleTheirs: {
    color: '#ffffff',
  },
  callLogSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  callLogSubtextMine: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  callLogSubtextTheirs: {
    color: colors.gray,
  },

  /* Forward Modal Styles */
  forwardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  forwardModalContainer: {
    backgroundColor: colors.darkBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forwardModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  forwardModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  forwardModalCloseIcon: {
    width: 16,
    height: 16,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  forwardModalTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  forwardSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    marginHorizontal: spacing.md,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  forwardSearchIcon: {
    width: 18,
    height: 18,
    tintColor: colors.gray,
    marginRight: 8,
    resizeMode: 'contain',
  },
  forwardSearchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    paddingVertical: 0,
  },
  forwardChatListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
  },
  forwardChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  forwardChatItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  forwardChatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  forwardChatAvatarImg: {
    width: '100%',
    height: '100%',
  },
  forwardChatAvatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  forwardChatInfo: {
    flex: 1,
  },
  forwardChatName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  forwardChatSub: {
    color: colors.gray,
    fontSize: 12,
  },
  forwardCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  forwardCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  forwardCheckIcon: {
    width: 14,
    height: 14,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  forwardEmptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  forwardEmptyText: {
    color: colors.gray,
    fontSize: 14,
  },
  forwardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forwardSelectionCounter: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  forwardSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forwardSendIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
});


