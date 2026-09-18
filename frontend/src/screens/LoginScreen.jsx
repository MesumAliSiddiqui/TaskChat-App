import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ImageBackground,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import SocialButtons from '../components/SocialButtons';
import { colors, spacing, fontSizes } from '../theme/theme';

const LoginScreen = ({ navigation }) => {
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Missing info', 'Enter email and password');
    try {
      setLoading(true);
      await login(email, password);
    } catch (err) {
      Alert.alert('Login failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
        'Google sign-in failed',
        err.response?.data?.message || err.message || 'Make sure Google Sign-In is configured.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      setLoading(true);
      const { LoginManager, AccessToken } = require('react-native-fbsdk-next');
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      if (result.isCancelled) return;
      const data = await AccessToken.getCurrentAccessToken();
      await loginWithFacebook(data.accessToken);
    } catch (err) {
      Alert.alert(
        'Facebook sign-in failed',
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoSquircle}>
              <Text style={styles.logoLetter}>T</Text>
            </View>
            <Text style={styles.logo}>TaskChat</Text>
            <Text style={styles.subtitle}>Chat with your team. Get things done.</Text>
          </View>

          <View style={styles.form}>
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

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword', { initialEmail: email })}
              style={styles.forgotPasswordWrap}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Log In'}</Text>
            </TouchableOpacity>

            <SocialButtons
              onGooglePress={handleGoogleLogin}
              onFacebookPress={handleFacebookLogin}
              loading={loading}
            />

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.linkWrap} activeOpacity={0.7}>
              <Text style={styles.link}>
                Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
              </Text>
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
    backgroundColor: 'rgba(11, 15, 25, 0.75)', // Slightly lighter overlay so the wave image accents show through
  },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoSquircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  logoLetter: { color: colors.white, fontSize: 38, fontWeight: 'bold' },
  logo: { fontSize: 28, fontWeight: '800', color: colors.white },
  subtitle: { color: colors.gray, marginTop: spacing.xs, textAlign: 'center', fontSize: fontSizes.md },
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
  linkWrap: { marginTop: spacing.xl, alignItems: 'center' },
  link: { color: colors.gray, fontSize: fontSizes.md },
  linkBold: { color: colors.primary, fontWeight: '700' },
  forgotPasswordWrap: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default LoginScreen;