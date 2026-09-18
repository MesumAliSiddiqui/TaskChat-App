import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSizes } from '../theme/theme';

const NotificationCard = ({ icon, title, subtitle, onPress, isToggle, toggleValue, onToggle }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={isToggle ? null : onPress}
    activeOpacity={isToggle ? 1 : 0.7}
  >
    <View style={styles.iconWrap}>
      <Image source={icon} style={styles.cardIcon} />
    </View>
    <View style={styles.textWrap}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
    </View>
    {isToggle ? (
      <Switch
        value={toggleValue}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primary }}
        thumbColor={colors.white}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    ) : (
      <Text style={styles.chevron}>›</Text>
    )}
  </TouchableOpacity>
);

const NotificationScreen = ({ navigation }) => {
  const { user, setUser } = useAuth();

  const [tasksEnabled, setTasksEnabled] = useState(user?.notificationPrefs?.taskAssignments ?? true);
  const [supportEnabled, setSupportEnabled] = useState(user?.notificationPrefs?.contactSupport ?? true);
  const [mentionsEnabled, setMentionsEnabled] = useState(user?.notificationPrefs?.mentions ?? false);
  const [groupActivityEnabled, setGroupActivityEnabled] = useState(user?.notificationPrefs?.groupActivity ?? false);
  const [vibrateEnabled, setVibrateEnabled] = useState(user?.notificationPrefs?.vibrate ?? true);

  const [savedBanner, setSavedBanner] = useState(false);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (data?.notificationPrefs) {
          const np = data.notificationPrefs;
          if (np.taskAssignments !== undefined) setTasksEnabled(np.taskAssignments);
          if (np.contactSupport !== undefined) setSupportEnabled(np.contactSupport);
          if (np.mentions !== undefined) setMentionsEnabled(np.mentions);
          if (np.groupActivity !== undefined) setGroupActivityEnabled(np.groupActivity);
          if (np.vibrate !== undefined) setVibrateEnabled(np.vibrate);

          if (setUser) {
            setUser((prev) => {
              const updated = { ...(prev || {}), notificationPrefs: np };
              AsyncStorage.setItem('user', JSON.stringify(updated)).catch(() => {});
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load notification prefs:', err);
      }
    };
    loadPrefs();
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
      const { data } = await api.patch('/users/me/notification-prefs', { [key]: val });
      showSavedFeedback();
      if (setUser && data?.notificationPrefs) {
        setUser((prev) => {
          const updated = {
            ...(prev || {}),
            notificationPrefs: {
              ...(prev?.notificationPrefs || {}),
              ...data.notificationPrefs,
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

  const handleAction = (actionName) => {
    Alert.alert(actionName, `${actionName} settings coming soon.`);
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
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerIconBtn} />
        </View>

        {/* Inline Saved Confirmation */}
        {savedBanner && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>✓ Saved</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <NotificationCard
            icon={require('../assets/icons/notification.png')} 
            title="Task Assignments"
            subtitle="When you're assigned a task"
            isToggle={true}
            toggleValue={tasksEnabled}
            onToggle={(val) => handleToggle('taskAssignments', val, setTasksEnabled)}
          />

          <NotificationCard
            icon={require('../assets/icons/security.png')} 
            title="Contact Support"
            subtitle="Support@taskchat.com updates"
            isToggle={true}
            toggleValue={supportEnabled}
            onToggle={(val) => handleToggle('contactSupport', val, setSupportEnabled)}
          />

          <NotificationCard
            icon={require('../assets/icons/profile.png')} 
            title="Mentions"
            subtitle="When someone mentions you"
            isToggle={true}
            toggleValue={mentionsEnabled}
            onToggle={(val) => handleToggle('mentions', val, setMentionsEnabled)}
          />

          <NotificationCard
            icon={require('../assets/icons/groups.png')} 
            title="Group Activity"
            subtitle="New members, group changes..."
            isToggle={true}
            toggleValue={groupActivityEnabled}
            onToggle={(val) => handleToggle('groupActivity', val, setGroupActivityEnabled)}
          />

          <TouchableOpacity style={styles.soundRow} activeOpacity={0.7} onPress={() => handleAction('Notification Sound')}>
            <Text style={styles.soundLabel}>Notification Sound</Text>
            <View style={styles.soundRight}>
              <Text style={styles.soundValue}>Default</Text>
              <Text style={styles.soundChevron}>›</Text>
            </View>
          </TouchableOpacity>

          <NotificationCard
            icon={require('../assets/icons/devices.png')} 
            title="Vibrate"
            isToggle={true}
            toggleValue={vibrateEnabled}
            onToggle={(val) => handleToggle('vibrate', val, setVibrateEnabled)}
          />

        </ScrollView>

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
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
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
  iconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardIcon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    color: colors.gray,
    fontSize: 13,
  },
  chevron: {
    color: colors.gray,
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  soundLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  soundRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soundValue: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '500',
  },
  soundChevron: {
    color: '#8B5CF6',
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 6,
    lineHeight: 20,
  },
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

export default NotificationScreen;