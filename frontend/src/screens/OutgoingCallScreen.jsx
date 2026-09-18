import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
} from 'react-native';
import { useCall } from '../context/CallContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const OutgoingCallScreen = () => {
  const { activeCall, endCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isGroup = Boolean(activeCall?.isGroup);
  const groupName = activeCall?.groupName || 'Group';
  const calleeName = activeCall?.otherUser?.name || activeCall?.callerName || (isGroup ? groupName : 'Contact');
  const calleeAvatar = activeCall?.otherUser?.avatar || activeCall?.callerAvatar;

  // Pulsing ring animation for the avatar
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Overlay to ensure text & buttons remain high contrast */}
      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <Text style={styles.callTypeLabel}>
            {isGroup ? `OUTGOING GROUP CALL • ${groupName.toUpperCase()}` : 'OUTGOING VOICE CALL'}
          </Text>

          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.25],
                    outputRange: [0.6, 0.1],
                  }),
                },
              ]}
            />
            <View style={styles.avatarContainer}>
              {calleeAvatar ? (
                <Image source={{ uri: calleeAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {calleeName?.[0]?.toUpperCase() || 'U'}
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.calleeName} numberOfLines={1}>
            {calleeName}
          </Text>
          <Text style={styles.ringingStatus}>Ringing...</Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.endCallBtn}
            activeOpacity={0.8}
            onPress={endCall}
          >
            <Image
              source={require('../assets/icons/call.png')}
              style={styles.endCallIcon}
            />
          </TouchableOpacity>
          <Text style={styles.endCallLabel}>Cancel</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.darkBackground,
  },
  videoOverlay: {
    backgroundColor: 'rgba(11, 15, 25, 0.55)',
  },
  topSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.xl,
  },
  callTypeLabel: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
    marginBottom: spacing.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primary,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.cardBackground,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: 42,
    fontWeight: '700',
  },
  calleeName: {
    color: colors.white,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  ringingStatus: {
    color: colors.gray,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  bottomSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.danger,
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  endCallIcon: {
    width: 32,
    height: 32,
    tintColor: colors.white,
    transform: [{ rotate: '135deg' }],
  },
  endCallLabel: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});

export default OutgoingCallScreen;
