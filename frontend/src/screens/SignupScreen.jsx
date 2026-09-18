import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import SocialButtons from '../components/SocialButtons';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const ROLES = ['employee', 'manager', 'boss'];

const SignupScreen = ({ navigation }) => {
  const { loginWithGoogle, loginWithFacebook } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [baseSalary, setBaseSalary] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      return Alert.alert('Missing info', 'Name, email and password are required');
    }
    if (!phone.trim()) {
      return Alert.alert('Missing info', 'Phone number is required so teammates can find you, like on WhatsApp');
    }

    try {
      setLoading(true);
      // Send the OTP to their email before letting them proceed to verification
      const { data } = await api.post('/auth/send-otp', { email: email.trim() });

      navigation.navigate('OTPVerification', {
        email: email.trim(),
        expiresInSeconds: data.expiresInSeconds || 30,
        pendingUserData: {
          name,
          email,
          password,
          phone: phone.trim(),
          role,
          baseSalary: Number(baseSalary) || 0,
        },
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) {
        throw new Error('Google did not return an idToken. Check your webClientId configuration.');
      }
      await loginWithGoogle(idToken);
    } catch (err) {
      Alert.alert(
        'Google sign-up failed',
        err.response?.data?.message || err.message || 'Make sure Google Sign-In is configured.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignup = async () => {
    try {
      setLoading(true);
      const { LoginManager, AccessToken } = require('react-native-fbsdk-next');
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      if (result.isCancelled) return;
      const data = await AccessToken.getCurrentAccessToken();
      await loginWithFacebook(data.accessToken);
    } catch (err) {
      Alert.alert(
        'Facebook sign-up failed',
        err.response?.data?.message || err.message || 'Make sure Facebook SDK is configured.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/login_background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join your team on TaskChat</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Image source={require('../assets/icons/user.png')} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.gray}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Image source={require('../assets/icons/mail.png')} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.gray}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputContainer}>
              <Image source={require('../assets/icons/call.png')} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone number (e.g. +923219164878)"
                placeholderTextColor={colors.gray}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.inputContainer}>
              <Image source={require('../assets/icons/security.png')} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <Image source={require('../assets/icons/wallet.png')} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Base monthly salary (optional)"
                placeholderTextColor={colors.gray}
                keyboardType="numeric"
                value={baseSalary}
                onChangeText={setBaseSalary}
              />
            </View>

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? 'Sending code...' : 'Sign Up'}</Text>
            </TouchableOpacity>

            <SocialButtons
              onGooglePress={handleGoogleSignup}
              onFacebookPress={handleFacebookSignup}
              loading={loading}
            />

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkWrap} activeOpacity={0.7}>
              <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Log in</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
  },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl },
  title: { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center' },
  subtitle: { color: colors.gray, textAlign: 'center', marginTop: spacing.xs, marginBottom: 28, fontSize: fontSizes.md },
  form: { width: '100%' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
  },
  inputIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: colors.gray,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  label: { fontSize: fontSizes.md, fontWeight: '700', marginBottom: spacing.xs, color: colors.white, marginLeft: 4 },
  roleRow: { flexDirection: 'row', marginBottom: spacing.lg },
  roleChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    marginRight: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleText: { color: colors.gray, textTransform: 'capitalize', fontWeight: '600' },
  roleTextActive: { color: colors.white },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '700' },
  linkWrap: { marginTop: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  link: { color: colors.gray, fontSize: fontSizes.md },
  linkBold: { color: colors.primary, fontWeight: '700' },
});

export default SignupScreen;