import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { colors, spacing, fontSizes } from '../theme/theme';

const HelpCard = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.iconWrap}>
      <Image source={icon} style={styles.cardIcon} />
    </View>
    <View style={styles.textWrap}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const HelpSupportScreen = ({ navigation }) => {
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
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HelpCard
            icon={require('../assets/icons/chat.png')}
            title="Contact Support"
            subtitle="Get direct assistance from our team"
            onPress={() => Alert.alert('Support', 'Email us at support@taskchat.com')}
          />
          <HelpCard
            icon={require('../assets/icons/info.png')}
            title="FAQs"
            subtitle="Read frequently asked questions"
            onPress={() => Alert.alert('FAQs', 'Opening documentation...')}
          />
          <HelpCard
            icon={require('../assets/icons/security.png')}
            title="Terms of Service"
            subtitle="Review user agreement and legal policies"
            onPress={() => Alert.alert('Terms', 'Opening Terms of Service...')}
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
  iconWrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardIcon: { width: 22, height: 22, tintColor: colors.white, resizeMode: 'contain' },
  textWrap: { flex: 1, justifyContent: 'center' },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardSubtitle: { color: colors.gray, fontSize: 13 },
  chevron: { color: colors.gray, fontSize: 22, fontWeight: '300', marginLeft: 8 },
});

export default HelpSupportScreen;