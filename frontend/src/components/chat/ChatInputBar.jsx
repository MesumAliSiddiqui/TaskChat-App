import React from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, Animated, FlatList } from 'react-native';
import { colors, spacing, fontSizes } from '../../theme/theme';
import EmojiPicker from './EmojiPicker';

const ChatInputBar = ({
  isReviewing,
  isReviewPlaying,
  handleCancelRecording,
  handleToggleReviewPlay,
  recordedWaveform,
  reviewProgress,
  setReviewProgress,
  recordingDuration,
  formatRecordingTime,
  handleSendLockedVoiceNote,
  isDiscarding,
  trashScaleAnim,
  trashOpacityAnim,
  isRecording,
  recordingPulseAnim,
  recordingPulseScaleAnim,
  slideCancelAnim,
  toggleEmojiPicker,
  inputRef,
  text,
  handleTyping,
  setCursorSelection,
  setShowEmojiPicker,
  onAttachmentPress,
  navigation,
  chat,
  title,
  micDragXAnim,
  panResponder,
  sendMessage,
  handleVoiceRecord,
  handleStartRecording,
  handlePressOutMic,
  showEmojiPicker,
  EMOJI_CATEGORIES,
  activeEmojiCategory,
  setActiveEmojiCategory,
  handleEmojiBackspace,
  handleSelectEmoji,
  styles
}) => {
  return (
    <View style={{ width: '100%', backgroundColor: 'transparent' }}>
      <View style={styles.inputContainer}>
      {isReviewing ? (
        /* Locked Review State */
        <View style={styles.reviewBarContainer}>
          <TouchableOpacity
            style={styles.reviewTrashBtn}
            onPress={handleCancelRecording}
            activeOpacity={0.7}
          >
            <Image
              source={require('../../assets/icons/delete.png')}
              style={styles.reviewTrashIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewPlayPauseBtn}
            onPress={handleToggleReviewPlay}
            activeOpacity={0.7}
          >
            <Text style={styles.reviewPlayPauseIconText}>
              {isReviewPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>

          <View style={styles.reviewWaveformWrap}>
            <View style={styles.reviewWaveformRow}>
              {recordedWaveform.slice(-22).map((h, wIdx, arr) => {
                const isPlayed = isReviewPlaying && (wIdx / arr.length) <= reviewProgress;
                return (
                  <TouchableOpacity
                    key={wIdx}
                    activeOpacity={0.8}
                    onPress={() => {
                      const prog = (wIdx + 1) / arr.length;
                      setReviewProgress(prog);
                      if (!isReviewPlaying) {
                        handleToggleReviewPlay();
                      }
                    }}
                    style={styles.reviewWaveBarTouch}
                  >
                    <View
                      style={[
                        styles.reviewWaveBar,
                        { height: Math.min(24, Math.max(6, h)) },
                        isPlayed ? styles.reviewWaveBarPlayed : styles.reviewWaveBarUnplayed,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.reviewDurationText}>
              {isReviewPlaying
                ? `${formatRecordingTime(Math.floor(reviewProgress * (recordingDuration || 1)))} / ${formatRecordingTime(recordingDuration || 1)}`
                : formatRecordingTime(recordingDuration || 1)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.reviewSendBtn}
            onPress={handleSendLockedVoiceNote}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../assets/icons/send.png')}
              style={styles.reviewSendIcon}
            />
          </TouchableOpacity>

          {isDiscarding && (
            <Animated.View
              style={[
                styles.recordingTrashWrap,
                {
                  transform: [{ scale: trashScaleAnim }],
                  opacity: trashOpacityAnim,
                },
              ]}
            >
              <Image
                source={require('../../assets/icons/delete.png')}
                style={styles.recordingTrashIcon}
              />
              <Text style={styles.recordingTrashText}>Cancelled</Text>
            </Animated.View>
          )}
        </View>
      ) : (
        <>
          {isRecording ? (
            /* Dynamic Recording UI */
            <View style={styles.recordingWrapper}>
              <View style={styles.recordingContainer}>
                <Animated.View
                  style={[
                    styles.recordingPulseDot,
                    {
                      opacity: recordingPulseAnim,
                      transform: [{ scale: recordingPulseScaleAnim }],
                    },
                  ]}
                />
                <Text style={styles.recordingTimerText}>
                  {formatRecordingTime(recordingDuration)}
                </Text>

                <View style={styles.recordingWaveformContainer}>
                  {recordedWaveform.slice(-14).map((h, i) => (
                    <View
                      key={i}
                      style={[
                        styles.recordingWaveBar,
                        { height: Math.min(24, Math.max(6, h)) },
                      ]}
                    />
                  ))}
                </View>

                <Animated.View
                  style={[
                    styles.slideToCancelContainer,
                    {
                      transform: [{ translateX: slideCancelAnim }],
                    },
                  ]}
                >
                  <Text style={styles.slideToCancelChevron}>‹</Text>
                  <Text style={styles.slideToCancelText}>Slide to cancel</Text>
                </Animated.View>

                {isDiscarding && (
                  <Animated.View
                    style={[
                      styles.recordingTrashWrap,
                      {
                        transform: [{ scale: trashScaleAnim }],
                        opacity: trashOpacityAnim,
                      },
                    ]}
                  >
                    <Image
                      source={require('../../assets/icons/delete.png')}
                      style={styles.recordingTrashIcon}
                    />
                    <Text style={styles.recordingTrashText}>Cancelled</Text>
                  </Animated.View>
                )}
              </View>

              <View style={styles.lockHintFloating}>
                <Text style={styles.lockHintChevron}>▲</Text>
                <Text style={styles.lockHintText}>Lock</Text>
              </View>
            </View>
          ) : (
            /* Default Input State */
            <View style={styles.inputPill}>
              <TouchableOpacity
                style={styles.inputActionBtn}
                onPress={toggleEmojiPicker}
                activeOpacity={0.7}
              >
                <Image source={require('../../assets/icons/emoji.png')} style={styles.inputCustomIcon} />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={handleTyping}
                onSelectionChange={(e) => {
                  setCursorSelection(e.nativeEvent.selection);
                }}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder="Type a message..."
                placeholderTextColor={colors.gray}
                multiline
              />

              <TouchableOpacity
                style={styles.inputActionBtn}
                onPress={() => {
                  setShowEmojiPicker(false);
                  if (onAttachmentPress) onAttachmentPress();
                }}
              >
                <Image source={require('../../assets/icons/attach.png')} style={styles.inputCustomIcon} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputActionBtn}
                onPress={() => {
                  setShowEmojiPicker(false);
                  navigation.navigate('CameraScreen', { chatId: chat._id, chat, title });
                }}
              >
                <Image source={require('../../assets/icons/camera.png')} style={styles.inputCustomIcon} />
              </TouchableOpacity>
            </View>
          )}

          <Animated.View
            style={{ transform: [{ translateX: micDragXAnim }] }}
            {...(!text.trim() ? panResponder.panHandlers : {})}
          >
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !text.trim() && styles.micBtn,
                isRecording && styles.micBtnRecording,
              ]}
              onPress={text.trim() ? sendMessage : handleVoiceRecord}
              onLongPress={!text.trim() ? handleStartRecording : undefined}
              onPressOut={!text.trim() ? handlePressOutMic : undefined}
              delayLongPress={180}
              activeOpacity={0.8}
            >
              <Image
                source={
                  text.trim()
                    ? require('../../assets/icons/send.png')
                    : require('../../assets/icons/mic.png')
                }
                style={[
                  styles.sendCustomIcon,
                  isRecording && styles.sendCustomIconRecording,
                ]}
              />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      </View>

      {/* Emoji Picker Tray naturally rendered below the text input */}
      {showEmojiPicker && (
        <EmojiPicker
          EMOJI_CATEGORIES={EMOJI_CATEGORIES}
          activeEmojiCategory={activeEmojiCategory}
          setActiveEmojiCategory={setActiveEmojiCategory}
          handleEmojiBackspace={handleEmojiBackspace}
          handleSelectEmoji={handleSelectEmoji}
          styles={styles}
        />
      )}
    </View>
  );
};

export default ChatInputBar;
