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

const IncomingCallScreen = () => {
  const { activeCall, answerCall, declineCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const callerName = activeCall?.callerName || 'Incoming Caller';
  const callerAvatar = activeCall?.callerAvatar;
  const isGroup = Boolean(activeCall?.isGroup);
  const groupName = activeCall?.groupName || 'Group';

  // Pulsing animation for avatar
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
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

      {/* Top Header info */}
      <View style={styles.topSection}>
        <Text style={styles.callTypeBadge}>
          {isGroup ? `INCOMING GROUP CALL • ${groupName.toUpperCase()}` : 'INCOMING VOICE CALL'}
        </Text>

        <View style={styles.avatarWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [0.5, 0.05],
                }),
              },
            ]}
          />
          <View style={styles.avatarContainer}>
            {callerAvatar ? (
              <Image source={{ uri: callerAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {callerName?.[0]?.toUpperCase() || 'U'}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.callerName} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={styles.ringingText}>
          {isGroup ? `started a group voice call in ${groupName}...` : 'is calling you...'}
        </Text>
      </View>

      {/* Bottom Action Controls (Decline / Accept) */}
      <View style={styles.actionRow}>
        {/* Decline Button */}
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            activeOpacity={0.8}
            onPress={declineCall}
          >
            <Image
              source={require('../assets/icons/call.png')}
              style={[styles.actionIcon, styles.declineIcon]}
            />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        {/* Accept Button */}
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            activeOpacity={0.8}
            onPress={answerCall}
          >
            <Image
              source={require('../assets/icons/call.png')}
              style={styles.actionIcon}
            />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  topSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.xl,
  },
  callTypeBadge: {
    color: colors.success,
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
    width: 160,
    height: 160,
    marginBottom: spacing.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.success,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.cardBackground,
    borderWidth: 3,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: colors.success,
    shadowOpacity: 0.6,
    shadowRadius: 18,
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
  callerName: {
    color: colors.white,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  ringingText: {
    color: colors.gray,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  declineBtn: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  acceptBtn: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
  },
  actionIcon: {
    width: 32,
    height: 32,
    tintColor: colors.white,
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});

export default IncomingCallScreen;
