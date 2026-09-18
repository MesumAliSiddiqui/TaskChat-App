import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  ImageBackground,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const MenuItem = ({ icon, title, onPress, isLast }) => (
  <TouchableOpacity
    style={[styles.menuItem, isLast && styles.lastMenuItem]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.menuIconBox}>
      <Image source={icon} style={styles.menuIcon} />
    </View>
    <Text style={styles.menuText}>{title}</Text>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [salary, setSalary] = useState(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    if (user?.id) {
      api.get(`/users/${user.id}/salary`).then(({ data }) => setSalary(data));
    }
  }, [user, navigation]);

  const navigateToSecurity = () => {
    try {
      navigation.navigate('Security');
    } catch (err) {
      console.warn('Navigation error:', err);
      Alert.alert('Error', 'Unable to open security settings.');
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
        
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={navigateToSecurity}>
            <Image source={require('../assets/icons/settings.png')} style={styles.settingsIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {/* Profile Header Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.cameraBadge} activeOpacity={0.8} onPress={() => navigation.navigate('EditProfile')}>
                <Image source={require('../assets/icons/camera.png')} style={styles.cameraIcon} />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName} numberOfLines={1}>{user?.name || 'User'}</Text>
            
            <View style={styles.rolePill}>
              <Image source={require('../assets/icons/profile.png')} style={styles.roleIcon} />
              <Text style={styles.roleText}>{user?.role || 'Employee'}</Text>
            </View>

            <View style={styles.emailRow}>
              <Image source={require('../assets/icons/mail.png')} style={styles.emailIcon} />
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>

          {/* Salary Card */}
          {salary && (
            <View style={styles.salaryCard}>
              <View style={styles.salaryRow}>
                <View style={styles.salaryCol}>
                  <Text style={styles.salaryLabel}>Base Salary</Text>
                  <Text style={styles.salaryValue}>Rs {salary.baseSalary}</Text>
                </View>
                
                <View style={styles.salaryDivider} />
                
                <TouchableOpacity style={styles.salaryCol} activeOpacity={0.7}>
                  <Text style={styles.salaryLabel}>Current Salary</Text>
                  <View style={styles.currentSalaryRow}>
                    <Text style={styles.salaryValueCurrent}>Rs {salary.currentSalary}</Text>
                    <Text style={styles.salaryChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {salary.totalDeducted > 0 && (
                <Text style={styles.deductedText}>
                  Total deducted this cycle: Rs {salary.totalDeducted}
                </Text>
              )}
            </View>
          )}

          {/* Menu Sections */}
          <View style={styles.cardGroup}>
            <MenuItem
              icon={require('../assets/icons/profile.png')}
              title="Edit profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <MenuItem
              icon={require('../assets/icons/security.png')}
              title="Security"
              onPress={navigateToSecurity}
            />
            <MenuItem
              icon={require('../assets/icons/notification.png')}
              title="Notifications"
              onPress={() => navigation.navigate('Notifications')}
            />
            <MenuItem
              icon={require('../assets/icons/privacy.png')}
              title="Privacy"
              onPress={() => navigation.navigate('Privacy')}
              isLast
            />
          </View>

          <Text style={styles.sectionHeader}>Support & About</Text>
          <View style={styles.cardGroup}>
            <MenuItem
              icon={require('../assets/icons/info.png')}
              title="Help & Support"
              onPress={() => navigation.navigate('HelpSupport')}
            />
            <MenuItem
              icon={require('../assets/icons/info.png')}
              title="About App"
              onPress={() => navigation.navigate('AboutApp')}
              isLast
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.85}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>

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
  settingsIcon: {
    width: 22,
    height: 22,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 32, fontWeight: 'bold' },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
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
    width: 14,
    height: 14,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 8,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  roleIcon: {
    width: 12,
    height: 12,
    tintColor: colors.primary,
    resizeMode: 'contain',
    marginRight: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailIcon: {
    width: 14,
    height: 14,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 6,
  },
  userEmail: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  salaryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  salaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  salaryLabel: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '500',
    marginBottom: 6,
  },
  salaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  currentSalaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salaryValueCurrent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C4B5FD', 
  },
  salaryChevron: {
    color: '#10B981', 
    fontSize: 20,
    fontWeight: '400',
    marginLeft: 6,
    lineHeight: 20,
  },
  deductedText: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 12,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIconBox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    flex: 1,
  },
  chevron: {
    color: colors.gray,
    fontSize: 22,
    fontWeight: '300',
  },
  logoutBtn: {
    backgroundColor: '#9F1239', 
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: spacing.md,
  },
  logoutBtnText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});

export default ProfileScreen;