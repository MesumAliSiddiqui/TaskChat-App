import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useCall } from '../context/CallContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const formatDuration = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const OngoingCallScreen = () => {
  const {
    activeCall,
    isMuted,
    isSpeaker,
    callDuration,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = useCall();

  const isGroup = Boolean(activeCall?.isGroup);
  const displayName = isGroup
    ? (activeCall?.groupName || 'Group Voice Call')
    : (activeCall?.otherUser?.name || activeCall?.callerName || 'Contact');
  const displayAvatar = isGroup
    ? activeCall?.groupAvatar
    : (activeCall?.otherUser?.avatar || activeCall?.callerAvatar);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Audio Call Centered Display */}
      <View style={styles.audioCenterSection}>
        <View style={styles.audioAvatarContainer}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.audioAvatarInitial}>
              {displayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <Text style={styles.audioContactName} numberOfLines={1}>
          {displayName}
        </Text>
        {isGroup && (
          <Text style={styles.groupCallBadge}>Group Voice Call</Text>
        )}
        <Text style={styles.audioTimerBadge}>{formatDuration(callDuration)}</Text>
      </View>

      {/* Top Header Overlay */}
      <SafeAreaView style={styles.headerOverlay}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.timerBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Controls Bar */}
      <SafeAreaView style={styles.controlsOverlay}>
        <View style={styles.controlBar}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            activeOpacity={0.8}
            onPress={toggleMute}
          >
            <Image
              source={
                isMuted
                  ? require('../assets/icons/notifications-off.png')
                  : require('../assets/icons/mic.png')
              }
              style={[styles.controlIcon, isMuted && styles.controlIconActive]}
            />
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Speaker Button */}
          <TouchableOpacity
            style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
            activeOpacity={0.8}
            onPress={toggleSpeaker}
          >
            <Image
              source={require('../assets/icons/speaker.png')}
              style={[styles.controlIcon, isSpeaker && styles.controlIconActive]}
            />
            <Text style={styles.controlLabel}>
              {isSpeaker ? 'Speaker On' : 'Speaker'}
            </Text>
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn]}
            activeOpacity={0.8}
            onPress={endCall}
          >
            <Image
              source={require('../assets/icons/call.png')}
              style={styles.endCallIcon}
            />
            <Text style={[styles.controlLabel, styles.endCallLabel]}>End</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  headerOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(11, 15, 25, 0.65)',
    marginHorizontal: spacing.xl,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  timerText: {
    color: colors.gray,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  audioCenterSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  audioAvatarContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.cardBackground,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    marginBottom: spacing.lg,
  },
  audioAvatarInitial: {
    color: colors.white,
    fontSize: 52,
    fontWeight: '700',
  },
  audioContactName: {
    color: colors.white,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  groupCallBadge: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  audioTimerBadge: {
    color: colors.gray,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '700',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '90%',
    backgroundColor: 'rgba(19, 27, 46, 0.92)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 14,
  },
  controlIcon: {
    width: 26,
    height: 26,
    tintColor: colors.white,
    marginBottom: 4,
  },
  controlIconActive: {
    tintColor: colors.danger,
  },
  controlLabel: {
    color: colors.gray,
    fontSize: 10,
    fontWeight: '600',
  },
  endCallBtn: {
    backgroundColor: colors.danger,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallIcon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
    transform: [{ rotate: '135deg' }],
    marginBottom: 0,
  },
  endCallLabel: {
    display: 'none',
  },
});

export default OngoingCallScreen;
