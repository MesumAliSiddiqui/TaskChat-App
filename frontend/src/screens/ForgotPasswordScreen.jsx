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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const initialEmail = route?.params?.initialEmail || '';

  // Step 1: 'request' (enter email) | Step 2: 'reset' (enter OTP + new password)
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const inputs = useRef([]);

  // Live countdown timer for code expiration / resend
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleRequestCode = async () => {
    if (!email || !email.trim()) {
      return Alert.alert('Missing Email', 'Please enter your registered email address.');
    }

    try {
      setLoading(true);
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setSecondsLeft(data.expiresInSeconds || 600);
      setStep('reset');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        inputs.current[0]?.focus();
      }, 300);
      Alert.alert('Code Sent', 'A 6-digit password reset code has been sent to your email.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setResending(true);
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setSecondsLeft(data.expiresInSeconds || 600);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      Alert.alert('New Code Sent', 'A new verification code has been emailed to you.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      return Alert.alert('Incomplete Code', 'Please enter the complete 6-digit verification code.');
    }
    if (!newPassword) {
      return Alert.alert('Missing Password', 'Please enter a new password.');
    }
    if (newPassword.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Mismatch', 'New password and confirmation do not match.');
    }

    try {
      setLoading(true);
      const { data } = await api.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });

      Alert.alert(
        'Password Reset',
        data.message || 'Your password has been reset successfully. Please log in with your new password.',
        [
          {
            text: 'Log In',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Reset Failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <TouchableOpacity
              onPress={() => {
                if (step === 'reset') {
                  setStep('request');
                } else {
                  navigation.goBack();
                }
              }}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'request' ? 'Forgot Password' : 'Reset Password'}
            </Text>
            <View style={styles.backBtn} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'request' ? (
              // Step 1: Request Code
              <View style={styles.stepWrap}>
                <View style={styles.iconCircle}>
                  <Image source={require('../assets/icons/mail.png')} style={styles.headerIcon} />
                </View>
                <Text style={styles.title}>Recover Your Account</Text>
                <Text style={styles.subtitle}>
                  Enter the email associated with your TaskChat account. We'll send you a 6-digit code to reset your password.
                </Text>

                <View style={styles.inputContainer}>
                  <Image source={require('../assets/icons/mail.png')} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.gray}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestCode}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.backToLoginWrap}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backToLoginText}>
                    Remember your password? <Text style={styles.linkBold}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Step 2: Verify Code & Set New Password
              <View style={styles.stepWrap}>
                <View style={styles.iconCircle}>
                  <Image source={require('../assets/icons/security.png')} style={styles.headerIcon} />
                </View>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>

                {/* 6-box OTP Input */}
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      style={[styles.otpInput, digit && styles.otpInputFilled]}
                      keyboardType="numeric"
                      maxLength={1}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                      ref={(ref) => (inputs.current[index] = ref)}
                      selectTextOnFocus
                      placeholderTextColor={colors.gray}
                    />
                  ))}
                </View>

                {/* Countdown / Resend */}
                <View style={styles.resendRow}>
                  {secondsLeft > 0 ? (
                    <Text style={styles.timerText}>
                      Code expires in <Text style={styles.timerBold}>{formatTimer(secondsLeft)}</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={resending}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resendText}>
                        {resending ? 'Sending new code...' : 'Resend verification code'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* New Password Input */}
                <View style={styles.inputContainer}>
                  <Image source={require('../assets/icons/security.png')} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor={colors.gray}
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputContainer}>
                  <Image source={require('../assets/icons/security.png')} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.gray}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('request')}
                  style={styles.backToLoginWrap}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backToLoginText}>
                    Entered the wrong email? <Text style={styles.linkBold}>Change Email</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.86)',
  },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { width: 24, height: 24, tintColor: colors.white, resizeMode: 'contain' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl * 2,
    justifyContent: 'center',
  },
  stepWrap: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 30,
    height: 30,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emailHighlight: {
    color: colors.white,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  inputIcon: {
    width: 20,
    height: 20,
    tintColor: colors.gray,
    marginRight: spacing.sm,
    resizeMode: 'contain',
  },
  input: {
    flex: 1,
    color: colors.white,
    paddingVertical: 15,
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  eyeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backToLoginWrap: {
    marginTop: spacing.xl,
    paddingVertical: 8,
  },
  backToLoginText: {
    color: colors.gray,
    fontSize: 14,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  otpInput: {
    width: 48,
    height: 54,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  resendRow: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  timerText: {
    color: colors.gray,
    fontSize: 13,
  },
  timerBold: {
    color: colors.white,
    fontWeight: '600',
  },
  resendText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
