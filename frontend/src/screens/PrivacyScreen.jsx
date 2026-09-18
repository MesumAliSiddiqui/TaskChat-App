import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSizes } from '../theme/theme';

const PrivacyRow = ({ title, subtitle, value, onValueChange }) => (
  <View style={styles.card}>
    <View style={styles.textWrap}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primary }}
      thumbColor={colors.white}
      ios_backgroundColor="rgba(255,255,255,0.1)"
    />
  </View>
);

const PrivacyScreen = ({ navigation }) => {
  const { user, setUser } = useAuth();

  const [onlineStatus, setOnlineStatus] = useState(user?.privacy?.showOnlineStatus ?? true);
  const [readReceipts, setReadReceipts] = useState(user?.privacy?.readReceipts ?? true);
  const [profilePhoto, setProfilePhoto] = useState(user?.privacy?.publicProfilePhoto ?? true);

  const [savedBanner, setSavedBanner] = useState(false);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadPrivacy = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (data?.privacy) {
          const p = data.privacy;
          if (p.showOnlineStatus !== undefined) setOnlineStatus(p.showOnlineStatus);
          if (p.readReceipts !== undefined) setReadReceipts(p.readReceipts);
          if (p.publicProfilePhoto !== undefined) setProfilePhoto(p.publicProfilePhoto);

          if (setUser) {
            setUser((prev) => {
              const updated = { ...(prev || {}), privacy: p };
              AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => {});
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load privacy settings:', err);
      }
    };
    loadPrivacy();
  }, []);

  const showSavedFeedback = () => {
    setSavedBanner(true);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setSavedBanner(false);
    }, 2000);
  };

  const handleToggle = async (key, val, setter) => {
    setter(val);
    try {
      const { data } = await api.patch('/users/me/privacy', { [key]: val });
      showSavedFeedback();
      if (setUser && data?.privacy) {
        setUser((prev) => {
          const updated = {
            ...(prev || {}),
            privacy: {
              ...(prev?.privacy || {}),
              ...data.privacy,
            },
          };
          AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    } catch (err) {
      setter(!val); // revert on failure
      console.warn(`Failed to update ${key}:`, err);
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy</Text>
          <View style={styles.headerIconBtn} />
        </View>

        {/* Inline Saved Confirmation */}
        {savedBanner && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>✓ Saved</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PrivacyRow
            title="Show Online Status"
            subtitle="Let others see when you are active"
            value={onlineStatus}
            onValueChange={(val) => handleToggle('showOnlineStatus', val, setOnlineStatus)}
          />
          <PrivacyRow
            title="Read Receipts"
            subtitle="Show double checkmarks when messages are read"
            value={readReceipts}
            onValueChange={(val) => handleToggle('readReceipts', val, setReadReceipts)}
          />
          <PrivacyRow
            title="Public Profile Photo"
            subtitle="Allow everyone to view your profile picture"
            value={profilePhoto}
            onValueChange={(val) => handleToggle('publicProfilePhoto', val, setProfilePhoto)}
          />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 15, 25, 0.85)' },
  safeArea: { flex: 1 },
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  textWrap: { flex: 1, marginRight: 12 },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardSubtitle: { color: colors.gray, fontSize: 13 },
  savedBanner: {
    backgroundColor: 'rgba(0, 168, 132, 0.15)',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 8,
  },
  savedBannerText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default PrivacyScreen;