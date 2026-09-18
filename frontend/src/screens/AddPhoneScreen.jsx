import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ImageBackground,
  Image,
  Keyboard,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSizes } from '../theme/theme';

// Validates plausible E.164 phone numbers (e.g. +923219164878)
const validateAndSanitizePhone = (input) => {
  if (!input || !input.trim()) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  const raw = input.trim();
  // Strip spaces, dashes, and parentheses
  let sanitized = raw.replace(/[\s\-()]/g, '');

  if (sanitized.startsWith('0')) {
    return {
      isValid: false,
      error: 'Please include your country code (e.g. +923219164878) instead of starting with 0.',
    };
  }

  // Auto-prepend + if missing but otherwise matches international number format
  if (!sanitized.startsWith('+')) {
    if (/^[1-9]\d{7,14}$/.test(sanitized)) {
      sanitized = `+${sanitized}`;
    }
  }

  // E.164 pattern: + followed by 8 to 15 digits (first digit 1-9)
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(sanitized)) {
    return {
      isValid: false,
      error: 'Please enter a valid phone number with country code (e.g. +923219164878).',
    };
  }

  return { isValid: true, phone: sanitized };
};

const AddPhoneScreen = ({ navigation }) => {
  const { savePhoneNumber, setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    const validation = validateAndSanitizePhone(phone);
    if (!validation.isValid) {
      return Alert.alert('Invalid Phone Number', validation.error);
    }

    try {
      setLoading(true);
      const updatedUser = await savePhoneNumber(validation.phone);

      Alert.alert(
        'Success',
        'Phone number added successfully!',
        [
          {
            text: 'Continue',
            onPress: () => {
              if (updatedUser) {
                setUser((prev) => ({
                  ...(prev || {}),
                  ...updatedUser,
                  phone: updatedUser.phone,
                }));
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to save phone number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/chat_background.png')}
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
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={require('../assets/icons/Phone.png')}
                style={styles.illustrationImage}
              />
            </View>

            <Text style={styles.title}>One last step</Text>
            <Text style={styles.subtitle}>
              Add your phone number so your teammates can find and message you, just like on WhatsApp.
            </Text>

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

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Continue'}</Text>
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
    marginBottom: spacing.md,
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
    lineHeight: 22,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
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
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '700' },
});

export default AddPhoneScreen;