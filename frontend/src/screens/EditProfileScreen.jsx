import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ImageBackground,
  Image,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import api, { BASE_URL } from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';
import { compressAndConvertToBase64 } from '../utils/imageCompressor';

const InputCard = ({ topIcon, label, bottomIcon, value, onChangeText, editable = true, multiline = false, keyboardType = 'default' }) => (
  <View style={styles.inputCard}>
    <View style={styles.inputCardTop}>
      <Image source={topIcon} style={styles.inputCardTopIcon} />
      <Text style={styles.inputCardLabel}>{label}</Text>
    </View>
    <View style={styles.inputCardBottom}>
      <Image source={bottomIcon} style={styles.inputCardBottomIcon} />
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputDisabled]}
        value={String(value)}
        onChangeText={onChangeText}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.gray}
      />
    </View>
  </View>
);

const EditProfileScreen = ({ navigation }) => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [about, setAbout] = useState(user?.about || '');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const getAvatarUri = (raw) => {
    if (!raw) return null;
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('file://') ||
      raw.startsWith('data:')
    ) {
      return raw;
    }
    return `${BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name cannot be empty');
    if (!phone.trim()) return Alert.alert('Error', 'Phone number is required');

    try {
      setLoading(true);
      
      const { data: profileData } = await api.patch('/users/me', { 
        name: name.trim(), 
        about: about.trim() 
      });

      let updatedUser = { ...user, ...profileData };

      if (phone.trim() !== user.phone) {
        const { data: phoneData } = await api.patch('/users/me/phone', { 
          phone: phone.trim() 
        });
        updatedUser.phone = phoneData.phone;
      }

      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (source) => {
    setPickerModalVisible(false);
    try {
      const options = {
        width: 500,
        height: 500,
        cropping: true,
        cropperCircleOverlay: true,
        includeBase64: true,
        compressImageQuality: 0.8,
        mediaType: 'photo',
      };

      let image;
      if (source === 'camera') {
        image = await ImagePicker.openCamera(options);
      } else {
        image = await ImagePicker.openPicker(options);
      }

      if (!image) return;

      setUploadingAvatar(true);

      // Compress avatar to max 500px on longest side, 80% JPEG quality, and convert to base64
      let base64Payload = null;
      try {
        const result = await compressAndConvertToBase64(image.path, {
          maxWidth: 500,
          maxHeight: 500,
          quality: 0.8,
        });
        base64Payload = result.base64;
      } catch (compErr) {
        console.warn('Avatar compression warning, falling back to direct base64:', compErr);
        if (image.data) {
          base64Payload = `data:${image.mime || 'image/jpeg'};base64,${image.data}`;
        }
      }

      if (!base64Payload) {
        return Alert.alert('Error', 'Could not process selected image.');
      }
      const { data } = await api.post('/users/me/avatar', { image: base64Payload });
      const newAvatar = data.avatar || data.user?.avatar;

      const updatedUser = {
        ...(user || {}),
        avatar: newAvatar,
      };

      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (err) {
      if (
        err.message?.includes('User cancelled') ||
        err.code === 'E_PICKER_CANCELLED' ||
        err.code === 'E_NO_IMAGE_DATA_FOUND'
      ) {
        return;
      }
      Alert.alert('Upload Error', err.response?.data?.message || err.message || 'Failed to update profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarEdit = () => {
    setPickerModalVisible(true);
  };

  return (
    <ImageBackground
      source={require('../assets/images/chat_background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay} />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="large" color={colors.white} />
                  ) : user?.avatar ? (
                    <Image source={{ uri: getAvatarUri(user.avatar) }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{name?.[0]?.toUpperCase() || 'U'}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.cameraBadge}
                  activeOpacity={0.8}
                  onPress={handleAvatarEdit}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Image source={require('../assets/icons/camera.png')} style={styles.cameraIcon} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Input Cards */}
            <InputCard
              topIcon={require('../assets/icons/profile.png')}
              label="Name"
              bottomIcon={require('../assets/icons/user.png')}
              value={name}
              onChangeText={setName}
            />

            <InputCard
              topIcon={require('../assets/icons/call.png')}
              label="Phone Number"
              bottomIcon={require('../assets/icons/call.png')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <InputCard
              topIcon={require('../assets/icons/wallet.png')}
              label="Salary"
              bottomIcon={require('../assets/icons/wallet.png')}
              value={user?.baseSalary || 0}
              editable={false}
            />

            <InputCard
              topIcon={require('../assets/icons/info.png')}
              label="About"
              bottomIcon={require('../assets/icons/chat.png')}
              value={about}
              onChangeText={setAbout}
              multiline={true}
            />

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave} 
              disabled={loading} 
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* Image Picker Choice Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={pickerModalVisible}
          onRequestClose={() => setPickerModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setPickerModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.sheetHandle} />
                  <Text style={styles.modalSheetTitle}>Profile Picture</Text>

                  <View style={styles.pickerOptionsRow}>
                    {/* Camera Option */}
                    <TouchableOpacity
                      style={styles.pickerOptionBtn}
                      activeOpacity={0.7}
                      onPress={() => pickImage('camera')}
                    >
                      <View style={[styles.pickerIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                        <Image source={require('../assets/icons/camera.png')} style={[styles.pickerIcon, { tintColor: colors.primary }]} />
                      </View>
                      <Text style={styles.pickerOptionLabel}>Camera</Text>
                    </TouchableOpacity>

                    {/* Gallery Option */}
                    <TouchableOpacity
                      style={styles.pickerOptionBtn}
                      activeOpacity={0.7}
                      onPress={() => pickImage('gallery')}
                    >
                      <View style={[styles.pickerIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <Image source={require('../assets/icons/gallery.png')} style={[styles.pickerIcon, { tintColor: colors.success }]} />
                      </View>
                      <Text style={styles.pickerOptionLabel}>Gallery</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setPickerModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
  },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    width: 24,
    height: 24,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 36, fontWeight: 'bold' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    borderWidth: 3,
    borderColor: colors.darkBackground,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  cameraIcon: {
    width: 16,
    height: 16,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  inputCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  inputCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputCardTopIcon: {
    width: 14,
    height: 14,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 8,
  },
  inputCardLabel: {
    color: colors.gray,
    fontSize: 13,
    fontWeight: '500',
  },
  inputCardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputCardBottomIcon: {
    width: 18,
    height: 18,
    tintColor: colors.white,
    resizeMode: 'contain',
    marginRight: 10,
    marginTop: Platform.OS === 'ios' ? 0 : 4,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    margin: 0,
  },
  inputMultiline: {
    minHeight: 40,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    color: colors.gray,
  },
  saveBtn: {
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
  saveBtnText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl * 1.5 : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheetTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  pickerOptionBtn: {
    alignItems: 'center',
    minWidth: 80,
  },
  pickerIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pickerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  pickerOptionLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  modalCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.gray,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default EditProfileScreen;