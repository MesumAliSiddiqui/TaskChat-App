import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const ChangePasswordScreen = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleUpdate = async () => {
    if (!currentPassword?.trim() || !newPassword?.trim() || !confirmPassword?.trim()) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'New passwords do not match.');
    }

    try {
      setLoading(true);
      const { data } = await api.patch('/auth/update-password', {
        currentPassword,
        newPassword,
      });
      Alert.alert('Success', data?.message || 'Password updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || 'Failed to update password.';
      Alert.alert('Error', errorMessage);
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
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={styles.headerIconBtn} />
          </View>

          <View style={styles.content}>
            <View style={styles.inputCard}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleUpdate} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.btnText}>{loading ? 'Updating...' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 15, 25, 0.85)' },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { width: 24, height: 24, tintColor: colors.white, resizeMode: 'contain' },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  inputCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  label: { color: colors.gray, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: { color: colors.white, fontSize: 16, fontWeight: '600', padding: 0 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: spacing.md,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '700' },
});

export default ChangePasswordScreen;