import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../theme/theme';

// Plain styled buttons (no icon-font dependency). The "G" and "f" marks use 
// each brand's real color so they're instantly recognizable.
const SocialButtons = ({ onGooglePress, onFacebookPress, loading }) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.socialBtn, styles.googleBtn]}
        onPress={onGooglePress}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.googleG}>G</Text>
        </View>
        <Text style={styles.socialBtnText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.socialBtn, styles.facebookBtn]}
        onPress={onFacebookPress}
        disabled={loading}
        activeOpacity={0.8}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#FFFFFF' }]}>
          <Text style={styles.facebookF}>f</Text>
        </View>
        <Text style={[styles.socialBtnText, { color: colors.white }]}>Continue with Facebook</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { 
    marginTop: spacing.md 
  },
  dividerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: spacing.lg 
  },
  dividerLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: colors.border 
  },
  dividerText: { 
    marginHorizontal: spacing.md, 
    color: colors.gray, 
    fontSize: fontSizes.sm,
    fontWeight: '600'
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: spacing.md,
  },
  googleBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  facebookBtn: {
    backgroundColor: '#1877F2',
    borderWidth: 1.5,
    borderColor: '#1877F2',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  googleG: { 
    color: '#4285F4', 
    fontWeight: 'bold', 
    fontSize: fontSizes.md 
  },
  facebookF: { 
    color: '#1877F2', 
    fontWeight: 'bold', 
    fontSize: fontSizes.md 
  },
  socialBtnText: { 
    fontSize: fontSizes.md, 
    fontWeight: '700', 
    color: colors.black 
  },
});

export default SocialButtons;