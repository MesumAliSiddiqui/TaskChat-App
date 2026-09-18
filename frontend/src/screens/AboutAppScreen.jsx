import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image,
} from 'react-native';
import { colors, spacing, fontSizes } from '../theme/theme';

const AboutAppScreen = ({ navigation }) => {
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
          <Text style={styles.headerTitle}>About App</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Image source={require('../assets/icons/chat.png')} style={styles.logoIcon} />
            </View>
            <Text style={styles.appName}>TaskChat</Text>
            <Text style={styles.appVersion}>Version 1.0.0 (Build 2026)</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>
              TaskChat is a secure, real-time collaboration and task management platform tailored for modern development teams.
            </Text>
          </View>
        </View>
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
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xxl, alignItems: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  logoIcon: { width: 40, height: 40, tintColor: colors.white, resizeMode: 'contain' },
  appName: { color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  appVersion: { color: colors.gray, fontSize: 14 },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cardText: { color: colors.gray, fontSize: 14, lineHeight: 22, textAlign: 'center' },
});

export default AboutAppScreen;