import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, fontSizes } from '../../theme/theme';

const VOICE_WAVEFORM_HEIGHTS = [8, 14, 22, 12, 18, 26, 16, 24, 10, 20, 28, 14, 18, 24, 12, 16, 10, 6];

const MessageBubble = ({
  item,
  user,
  chat,
  selectedMessageIds,
  starredMessageIds,
  failedImageIds,
  playingVoiceId,
  voicePlaybackProgress,
  handleLongPressMessage,
  handlePressMessage,
  handleScrollToQuotedMessage,
  handlePlaceCall,
  handleTogglePlayVoice,
  formatVoiceProgress,
  extractVoiceDuration,
  openLocationLink,
  setFailedImageIds,
  handleRetryMessage,
  styles,
  getImageSource,
  getQuotedReply,
}) => {
  const id = (item._id || item.tempId)?.toString();
  const isSelected = selectedMessageIds.includes(id);
  const isStarred = starredMessageIds.includes(id);
  const isMine = (item.sender?._id || item.sender?.id)?.toString() === (user?._id || user?.id)?.toString();
  const imageSource = getImageSource(item);
  const hasImageError = failedImageIds[item._id || item.tempId];
  const isLocationMessage = typeof item.text === 'string' && item.text.startsWith('📍');
  const quotedReply = getQuotedReply(item);
  const mainText = quotedReply ? quotedReply.cleanText : item.text;
  const isCallLog = typeof mainText === 'string' && mainText.startsWith('📞');
  const isVoiceNote =
    (typeof mainText === 'string' &&
      (mainText.startsWith('🎤') ||
        mainText.startsWith('🎙️') ||
        mainText.toLowerCase().includes('voice note') ||
        mainText.toLowerCase().includes('audio note'))) ||
    item.attachmentType === 'audio';

  return (
    <View
      style={[
        styles.bubbleRow,
        isMine ? styles.rowRight : styles.rowLeft,
        isSelected && styles.bubbleRowSelected,
      ]}
    >
      {chat.isGroup && !isMine && (
        <View style={styles.senderAvatar}>
          {item.sender?.avatar ? (
            <Image source={{ uri: item.sender.avatar }} style={styles.senderAvatarImage} />
          ) : (
            <Text style={styles.senderAvatarText}>{item.sender?.name?.[0]?.toUpperCase()}</Text>
          )}
        </View>
      )}
      <TouchableOpacity
        activeOpacity={0.88}
        onLongPress={() => handleLongPressMessage(item)}
        onPress={() => handlePressMessage(item)}
        delayLongPress={220}
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isSelected && styles.bubbleSelected,
        ]}
      >
        {chat.isGroup && !isMine && (
          <Text style={styles.senderName}>{item.sender?.name}</Text>
        )}

        {/* WhatsApp-Style Quoted Reply Banner Attached Above Message Text */}
        {quotedReply && (
          <TouchableOpacity
            style={[
              styles.quotedReplyBanner,
              isMine ? styles.quotedReplyBannerMine : styles.quotedReplyBannerTheirs,
            ]}
            activeOpacity={0.8}
            onPress={() => (selectedMessageIds.length > 0 ? handlePressMessage(item) : handleScrollToQuotedMessage(quotedReply))}
            onLongPress={() => handleLongPressMessage(item)}
          >
            <View style={styles.quotedReplyContent}>
              <Text
                style={[
                  styles.quotedReplySender,
                  isMine ? styles.quotedReplySenderMine : styles.quotedReplySenderTheirs,
                ]}
                numberOfLines={1}
              >
                {quotedReply.senderName}
              </Text>
              <Text
                style={[
                  styles.quotedReplySnippet,
                  isMine ? styles.quotedReplySnippetMine : styles.quotedReplySnippetTheirs,
                ]}
                numberOfLines={2}
              >
                {quotedReply.text}
              </Text>
            </View>
            {quotedReply.image ? (
              <Image
                source={getImageSource({ image: quotedReply.image })}
                style={styles.quotedReplyThumbnail}
                resizeMode="cover"
              />
            ) : null}
          </TouchableOpacity>
        )}

        {isCallLog ? (
          <TouchableOpacity
            style={styles.callLogCard}
            activeOpacity={0.8}
            onPress={() => {
              if (selectedMessageIds.length > 0) {
                handlePressMessage(item);
              } else {
                handlePlaceCall();
              }
            }}
            onLongPress={() => handleLongPressMessage(item)}
          >
            <View style={styles.callLogContent}>
              <View style={[styles.callLogIconCircle, isMine ? styles.callLogIconCircleMine : styles.callLogIconCircleTheirs]}>
                <Image
                  source={require('../../assets/icons/call.png')}
                  style={[styles.callLogIcon, isMine ? styles.callLogIconMine : styles.callLogIconTheirs]}
                />
              </View>
              <View style={styles.callLogDetails}>
                <Text style={[styles.callLogTitle, isMine ? styles.callLogTitleMine : styles.callLogTitleTheirs]}>
                  {mainText.includes('Group') ? 'Group voice call' : 'Voice call'}
                </Text>
                <Text style={[styles.callLogSubtext, isMine ? styles.callLogSubtextMine : styles.callLogSubtextTheirs]}>
                  {isMine ? 'Outgoing call' : 'Incoming call'} • Tap to call back
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : isVoiceNote ? (
          <TouchableOpacity
            style={styles.voiceNoteCard}
            activeOpacity={0.85}
            onPress={() => {
              if (selectedMessageIds.length > 0) {
                handlePressMessage(item);
              } else {
                handleTogglePlayVoice(item);
              }
            }}
            onLongPress={() => handleLongPressMessage(item)}
          >
            <View style={styles.voiceNoteContent}>
              <TouchableOpacity
                style={[
                  styles.voicePlayBtn,
                  isMine ? styles.voicePlayBtnMine : styles.voicePlayBtnTheirs,
                ]}
                onPress={() => handleTogglePlayVoice(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.voicePlayIconText}>
                  {playingVoiceId === id ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>

              <View style={styles.voiceWaveWrap}>
                <View style={styles.voiceWaveformRow}>
                  {(item.waveform || VOICE_WAVEFORM_HEIGHTS).map((h, wIdx, arr) => {
                    const isPlayed =
                      playingVoiceId === id &&
                      wIdx / arr.length <= voicePlaybackProgress;
                    return (
                      <View
                        key={wIdx}
                        style={[
                          styles.voiceWaveBar,
                          { height: Math.min(26, Math.max(6, h)) },
                          isPlayed
                            ? (isMine ? styles.voiceWaveBarPlayedMine : styles.voiceWaveBarPlayedTheirs)
                            : (isMine ? styles.voiceWaveBarMine : styles.voiceWaveBarTheirs),
                        ]}
                      />
                    );
                  })}
                </View>
                <View style={styles.voiceMetaRow}>
                  <Text style={[styles.voiceDurationText, isMine ? styles.voiceDurationMine : styles.voiceDurationTheirs]}>
                    {playingVoiceId === id
                      ? formatVoiceProgress(item, voicePlaybackProgress)
                      : extractVoiceDuration(mainText)}
                  </Text>
                  <View style={styles.voiceBadge}>
                    <Image
                      source={require('../../assets/icons/mic.png')}
                      style={[styles.voiceMicBadgeIcon, isMine ? styles.voiceMicBadgeMine : styles.voiceMicBadgeTheirs]}
                    />
                    <Text style={[styles.voiceBadgeText, isMine ? styles.voiceDurationMine : styles.voiceDurationTheirs]}>
                      Voice note
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.voiceAvatarContainer}>
                {(() => {
                  const avatarUri = isMine
                    ? (user?.avatar || user?.profilePic)
                    : (item.sender?.avatar || item.sender?.profilePic);
                  const displayName = isMine
                    ? (user?.name || 'You')
                    : (item.sender?.name || 'User');
                  return (
                    <>
                      <View style={[styles.voiceAvatarCircle, isMine ? styles.voiceAvatarCircleMine : styles.voiceAvatarCircleTheirs]}>
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.voiceAvatarImage} />
                        ) : (
                          <Text style={styles.voiceAvatarInitials}>
                            {(displayName?.[0] || 'U').toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.voiceAvatarBadge, isMine ? styles.voiceAvatarBadgeMine : styles.voiceAvatarBadgeTheirs]}>
                        <Image
                          source={require('../../assets/icons/mic.png')}
                          style={styles.voiceAvatarBadgeIcon}
                        />
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
          </TouchableOpacity>
        ) : isLocationMessage ? (
          hasImageError || !imageSource ? (
            <TouchableOpacity
              style={styles.mapFallbackCard}
              activeOpacity={0.8}
              onPress={() => (selectedMessageIds.length > 0 ? handlePressMessage(item) : openLocationLink(item.text))}
              onLongPress={() => handleLongPressMessage(item)}
            >
              <View style={styles.mapFallbackContent}>
                <View style={styles.mapFallbackIconCircle}>
                  <Image
                    source={require('../../assets/icons/pin.png')}
                    style={styles.mapFallbackPinIcon}
                  />
                </View>
                <View style={styles.mapFallbackTextWrap}>
                  <Text style={styles.mapFallbackTitle}>Map preview unavailable</Text>
                  <Text style={styles.mapFallbackSubtitle}>Tap to open in Google Maps ↗</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (selectedMessageIds.length > 0 ? handlePressMessage(item) : openLocationLink(item.text))}
              onLongPress={() => handleLongPressMessage(item)}
            >
              <Image
                source={imageSource}
                style={styles.mapThumbnail}
                resizeMode="cover"
                onError={() => {
                  setFailedImageIds((prev) => ({
                    ...prev,
                    [item._id || item.tempId]: true,
                  }));
                }}
              />
            </TouchableOpacity>
          )
        ) : imageSource ? (
          hasImageError ? (
            <View style={styles.imageErrorContainer}>
              <Text style={styles.imageErrorIcon}>⚠️</Text>
              <Text style={styles.imageErrorText}>Failed to load image</Text>
            </View>
          ) : (
            <Image
              source={imageSource}
              style={styles.messageImage}
              resizeMode="cover"
              onError={() => {
                setFailedImageIds((prev) => ({
                  ...prev,
                  [item._id || item.tempId]: true,
                }));
              }}
            />
          )
        ) : null}

        {mainText && !isCallLog && !isVoiceNote ? (
          isLocationMessage ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => (selectedMessageIds.length > 0 ? handlePressMessage(item) : openLocationLink(mainText))}
              onLongPress={() => handleLongPressMessage(item)}
            >
              <Text
                style={[
                  styles.messageText,
                  isMine ? styles.messageTextMine : styles.messageTextTheirs,
                  imageSource && { marginTop: 4 },
                  { textDecorationLine: 'underline' },
                ]}
              >
                {mainText}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={[
                styles.messageText,
                isMine ? styles.messageTextMine : styles.messageTextTheirs,
                imageSource && { marginTop: 4 },
              ]}
            >
              {mainText}
            </Text>
          )
        ) : null}

        <View style={styles.timeRow}>
          {isStarred && <Text style={styles.starIconText}>★ </Text>}
          <Text style={[styles.time, isMine ? styles.timeMine : styles.timeTheirs]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMine && (
            item.status === 'failed' ? (
              <TouchableOpacity
                style={styles.retryBubbleBtn}
                activeOpacity={0.7}
                onPress={() => handleRetryMessage(item)}
              >
                <Image source={require('../../assets/icons/sync.png')} style={styles.retryBubbleIcon} />
                <Text style={styles.retryBubbleText}>Retry</Text>
              </TouchableOpacity>
            ) : item.status === 'sending' || item._isOptimistic ? (
              <Image source={require('../../assets/icons/time.png')} style={styles.clockIcon} />
            ) : (
              <Image source={require('../../assets/icons/double-check.png')} style={styles.checkIcon} />
            )
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default MessageBubble;
