import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { colors, spacing, fontSizes } from '../theme/theme';

const SecurityCard = ({ icon, title, subtitle, onPress, isToggle, toggleValue, onToggle }) => (
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
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
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

const SecurityScreen = ({ navigation }) => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
          <Text style={styles.headerTitle}>Security</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <View style={styles.content}>
          <SecurityCard
            icon={require('../assets/icons/privacy.png')} 
            title="Change Password"
            subtitle="Update your password"
            onPress={() => navigation.navigate('ChangePassword')}
          />

          <SecurityCard
            icon={require('../assets/icons/security.png')} 
            title="Two-Factor Authentication"
            subtitle="Add extra security layer"
            isToggle={true}
            toggleValue={is2FAEnabled}
            onToggle={(val) => setIs2FAEnabled(val)}
          />
        </View>

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
});

export default SecurityScreen;