import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  ImageBackground,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const OTPVerificationScreen = ({ navigation, route }) => {
  const { signup } = useAuth();
  const email = route?.params?.email;
  const pendingUserData = route?.params?.pendingUserData;
  const initialExpiry = route?.params?.expiresInSeconds || 30;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialExpiry);
  const inputs = useRef([]);

  // Live countdown - once it hits 0 the code is expired server-side too,
  // so the resend link becomes the only way forward.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      return Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
    }
    if (secondsLeft <= 0) {
      return Alert.alert('Code expired', 'This code has expired. Please tap Resend to get a new one.');
    }

    try {
      setLoading(true);
      await api.post('/auth/verify-otp', { email, code });

      // Only create the actual account once the code is confirmed valid
      if (pendingUserData) {
        await signup(pendingUserData);
      } else {
        Alert.alert('Success', 'Email verified successfully!');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Verification Failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      const { data } = await api.post('/auth/send-otp', { email });
      setSecondsLeft(data.expiresInSeconds || 30);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      Alert.alert('Code sent', 'A new verification code has been emailed to you.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/login_background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            <View style={styles.illustrationContainer}>
              <Image
                source={require('../assets/icons/OTP.png')}
                style={styles.illustrationImage}
              />
            </View>

            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  keyboardType="numeric"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  ref={(ref) => (inputs.current[index] = ref)}
                  selectTextOnFocus
                  editable={secondsLeft > 0}
                  placeholderTextColor={colors.gray}
                />
              ))}
            </View>

            <Text style={secondsLeft > 0 ? styles.timerText : styles.timerTextExpired}>
              {secondsLeft > 0 ? `Code expires in ${secondsLeft}s` : 'Code expired'}
            </Text>

            <TouchableOpacity
              style={[styles.button, (loading || secondsLeft <= 0) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || secondsLeft <= 0}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendWrap} activeOpacity={0.7} onPress={handleResend} disabled={resending}>
              <Text style={styles.resendText}>
                Didn't receive the code?{' '}
                <Text style={styles.resendLink}>{resending ? 'Sending...' : 'Resend'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
  },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  illustrationImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.gray,
    textAlign: 'center',
    fontSize: fontSizes.md,
    lineHeight: 24,
    marginBottom: 24,
  },
  emailHighlight: {
    color: colors.white,
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.cardBackground,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  timerText: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: fontSizes.sm,
    marginBottom: 24,
  },
  timerTextExpired: {
    textAlign: 'center',
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '700' },
  resendWrap: { marginTop: spacing.xl, alignItems: 'center' },
  resendText: { color: colors.gray, fontSize: fontSizes.md },
  resendLink: { color: colors.white, fontWeight: '700' },
});

export default OTPVerificationScreen;