import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ImageBackground,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import ImagePicker from 'react-native-image-crop-picker';
import { compressAndConvertToBase64 } from '../utils/imageCompressor';
import { colors, spacing, fontSizes } from '../theme/theme';

const ActionButton = ({ icon, label, onPress }) => (
  <View style={styles.actionBtnWrapper}>
    <TouchableOpacity style={styles.actionBtnCircle} onPress={onPress} activeOpacity={0.7}>
      <Image source={icon} style={styles.actionBtnIcon} />
    </TouchableOpacity>
    <Text style={styles.actionBtnLabel}>{label}</Text>
  </View>
);

const ListItem = ({ icon, title, subtitle, onPress, hideChevron, isLast }) => (
  <TouchableOpacity
    style={[styles.listItemRow, isLast && styles.lastItemRow]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={styles.listItemIconBox}>
      <Image source={icon} style={styles.listItemIcon} />
    </View>
    <View style={styles.listItemTextWrap}>
      <Text style={styles.listItemTitle}>{title}</Text>
      {subtitle ? <Text style={styles.listItemSubtitle}>{subtitle}</Text> : null}
    </View>
    {!hideChevron && <Text style={styles.chevron}>›</Text>}
  </TouchableOpacity>
);

const MemberItem = ({ member, isLast, onPress }) => (
  <TouchableOpacity
    style={[styles.listItemRow, isLast && styles.lastItemRow]}
    activeOpacity={0.7}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.memberAvatarBox}>
      {member.avatar ? (
        <Image source={{ uri: member.avatar }} style={styles.memberAvatarImage} />
      ) : (
        <Text style={styles.memberAvatarText}>{member.name?.[0]?.toUpperCase()}</Text>
      )}
    </View>
    <View style={styles.listItemTextWrap}>
      <Text style={styles.listItemTitle}>{member.name}</Text>
      <Text style={styles.listItemSubtitle}>{member.role || 'Member'}</Text>
    </View>
    {onPress && <Text style={styles.chevron}>›</Text>}
  </TouchableOpacity>
);

const ContactDetailScreen = ({ route, navigation }) => {
  const { user, isGroup, members, chatId } = route.params || {};
  const { user: currentUser } = useAuth();
  const { startCall } = useCall();
  const [loading, setLoading] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState(user?.avatar);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  const handlePickGroupImage = async (source) => {
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

      setUpdatingAvatar(true);

      let base64Payload = null;
      try {
        const result = await compressAndConvertToBase64(image.path, {
          maxWidth: 500,
          maxHeight: 500,
          quality: 0.8,
        });
        base64Payload = result.base64;
      } catch (compErr) {
        console.warn('Group avatar compression fallback:', compErr);
        if (image.data) {
          base64Payload = `data:${image.mime || 'image/jpeg'};base64,${image.data}`;
        }
      }

      if (!base64Payload) {
        Alert.alert('Error', 'Could not process selected image.');
        setUpdatingAvatar(false);
        return;
      }

      const res = await api.patch(`/chats/${chatId}/avatar`, { avatar: base64Payload });
      const newAvatar = res.data?.avatar;
      if (newAvatar) {
        setGroupAvatar(newAvatar);
      }
      Alert.alert('Success', 'Group profile image updated successfully!');
    } catch (err) {
      if (err?.message !== 'User cancelled image selection') {
        Alert.alert(
          'Update Failed',
          err.response?.data?.message || err.message || 'Failed to update group image'
        );
      }
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleEditGroupPicture = () => {
    Alert.alert(
      'Change Group Icon',
      'Select a source for the group photo:',
      [
        { text: 'Camera', onPress: () => handlePickGroupImage('camera') },
        { text: 'Gallery', onPress: () => handlePickGroupImage('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Salary editing state for boss/manager viewing a direct report
  const [salaryData, setSalaryData] = useState(null);
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [newBaseSalary, setNewBaseSalary] = useState('');
  const [newCurrentSalary, setNewCurrentSalary] = useState('');
  const [salaryReason, setSalaryReason] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);

  const isManagerOrBoss = currentUser?.role === 'boss' || currentUser?.role === 'manager';

  useEffect(() => {
    let isMounted = true;
    const fetchSalary = async () => {
      if (!isGroup && user?._id && isManagerOrBoss) {
        try {
          const res = await api.get(`/users/${user._id}/salary`);
          if (isMounted) {
            setSalaryData(res.data);
          }
        } catch (err) {
          // If not permitted or user not found, simply leave salaryData null
          console.log('Failed to fetch user salary:', err.message);
        }
      }
    };
    fetchSalary();
    return () => {
      isMounted = false;
    };
  }, [user?._id, isGroup, isManagerOrBoss]);

  const handleSaveSalary = async () => {
    if (!newBaseSalary || isNaN(Number(newBaseSalary)) || Number(newBaseSalary) < 0) {
      Alert.alert('Invalid Salary', 'Please enter a valid base salary (0 or greater).');
      return;
    }
    if (newCurrentSalary !== '' && (isNaN(Number(newCurrentSalary)) || Number(newCurrentSalary) < 0)) {
      Alert.alert('Invalid Salary', 'Current salary must be a valid number (0 or greater).');
      return;
    }

    try {
      setSavingSalary(true);
      const payload = {
        baseSalary: Number(newBaseSalary),
        currentSalary: newCurrentSalary !== '' ? Number(newCurrentSalary) : undefined,
        reason: salaryReason.trim(),
      };
      const res = await api.patch(`/users/${user._id}/salary`, payload);

      setSalaryData((prev) => ({
        ...prev,
        baseSalary: res.data.user.baseSalary,
        currentSalary: res.data.user.currentSalary,
        totalDeducted: res.data.user.baseSalary - res.data.user.currentSalary,
        salaryAdjustments: res.data.adjustment
          ? [res.data.adjustment, ...(prev?.salaryAdjustments || [])]
          : prev?.salaryAdjustments,
      }));

      setSalaryModalVisible(false);
      Alert.alert('Success', 'Employee salary updated successfully.');
    } catch (err) {
      Alert.alert(
        'Update Failed',
        err.response?.data?.message || err.message || 'Failed to update salary'
      );
    } finally {
      setSavingSalary(false);
    }
  };

  const title = user?.name || 'Unknown';
  const subtitle = isGroup ? `${members?.length || 0} members` : (user?.phone || 'Online');
  const avatarUrl = isGroup ? (groupAvatar || user?.avatar) : user?.avatar;

  const handleAction = (actionName) => {
    Alert.alert(actionName, `${actionName} action coming soon.`);
  };

  const handleExitGroup = () => {
    Alert.alert(
      'Exit Group',
      `Are you sure you want to exit "${title}"? You will no longer receive messages from this group.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.post(`/chats/${chatId}/leave`);
              navigation.popToTop();
            } catch (err) {
              Alert.alert(
                'Error',
                err.response?.data?.message || err.message || 'Failed to leave group'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${title}? Blocked contacts will no longer be able to message or call you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Blocked', `${title} has been blocked.`, [
              {
                text: 'OK',
                onPress: () => navigation.popToTop(),
              },
            ]);
          },
        },
      ]
    );
  };

  const displayedMembers = isGroup && members ? members.slice(0, 6) : [];
  const hasMoreMembers = isGroup && members && members.length > 6;

  return (
    <ImageBackground
      source={require('../assets/images/chat_background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow}>
                <View style={styles.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{title?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
              </View>
              {isGroup && (
                <TouchableOpacity
                  style={styles.editBadge}
                  activeOpacity={0.8}
                  onPress={handleEditGroupPicture}
                  disabled={updatingAvatar}
                >
                  {updatingAvatar ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Image source={require('../assets/icons/camera.png')} style={styles.editBadgeIcon} />
                  )}
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.nameText}>{title}</Text>
            <Text style={styles.subtitleText}>{subtitle}</Text>
          </View>

          {/* Actions Row */}
          <View style={styles.actionRow}>
            <ActionButton
              icon={require('../assets/icons/call.png')}
              label="Audio Call"
              onPress={() => {
                if (isGroup) {
                  startCall(chatId, null, 'audio', null, true, {
                    name: title,
                    avatar: avatarUrl,
                    members,
                  });
                } else if (user) {
                  startCall(chatId, user._id || user.id, 'audio', user, false);
                }
              }}
            />

            <ActionButton icon={require('../assets/icons/more.png')} label="More" onPress={() => setMoreModalVisible(true)} />
          </View>

          {/* Information Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isGroup ? 'Group Information' : 'Contact Information'}</Text>

            <ListItem
              icon={require('../assets/icons/notification.png')}
              title="Notifications"
              subtitle="Mute"
              onPress={() => handleAction('Notification Settings')}
              isLast={!isGroup && !user?.about && !(salaryData && salaryData.canEdit)}
            />

            {!isGroup && salaryData && salaryData.canEdit && (
              <ListItem
                icon={require('../assets/icons/wallet.png')}
                title="Salary & Compensation"
                subtitle={`Base: $${salaryData.baseSalary || 0} • Current: $${salaryData.currentSalary || 0}`}
                onPress={() => {
                  setNewBaseSalary(String(salaryData.baseSalary ?? ''));
                  setNewCurrentSalary(String(salaryData.currentSalary ?? ''));
                  setSalaryReason('');
                  setSalaryModalVisible(true);
                }}
                isLast={!user?.about}
              />
            )}

            {!isGroup && user?.about && (
              <ListItem
                icon={require('../assets/icons/info.png')}
                title="About"
                subtitle={user.about}
                hideChevron
                isLast={true}
              />
            )}

            {isGroup && (
              <View style={styles.membersSectionHeader}>
                <Text style={styles.membersSectionTitle}>Group Members</Text>
                <Text style={styles.membersSectionSubtitle}>{members?.length || 0} members</Text>
              </View>
            )}

            {/* LIST OF MEMBERS */}
            {isGroup && displayedMembers.map((m, index) => (
              <MemberItem
                key={m._id || index}
                member={m}
                isLast={false} // "Add members" comes next, so this is never the absolute last item
              />
            ))}

            {/* ADD MEMBER BUTTON (Moved After Members) */}
            {isGroup && (
              <TouchableOpacity
                style={[styles.addMemberRow, !hasMoreMembers && styles.lastItemRow]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AddMember', { targetId: chatId || user?._id, targetType: 'chats' })}
              >
                <View style={styles.addMemberIconBox}>
                  <Text style={styles.addMemberIconText}>+</Text>
                </View>
                <Text style={styles.addMemberText}>Add members</Text>
              </TouchableOpacity>
            )}

            {/* SEE ALL BUTTON */}
            {hasMoreMembers && (
              <TouchableOpacity
                style={[styles.seeAllBtn, styles.lastItemRow]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('GroupMembers', { members })}
              >
                <Text style={styles.seeAllBtnText}>See all {members.length} members</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Danger Button */}
          <TouchableOpacity
            style={[styles.dangerBtn, loading && { opacity: 0.6 }]}
            onPress={isGroup ? handleExitGroup : handleBlockUser}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.dangerBtnText}>
              {loading ? (isGroup ? 'Exiting...' : 'Blocking...') : isGroup ? 'Exit Group' : 'Block User'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Salary Adjustment Modal */}
        <Modal
          visible={salaryModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSalaryModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Adjust Salary</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    {title} • {user?.role || 'Employee'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSalaryModalVisible(false)}
                  disabled={savingSalary}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Base Salary ($) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newBaseSalary}
                  onChangeText={setNewBaseSalary}
                  keyboardType="numeric"
                  placeholder="e.g. 5000"
                  placeholderTextColor={colors.gray}
                  editable={!savingSalary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current Cycle Salary ($)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newCurrentSalary}
                  onChangeText={setNewCurrentSalary}
                  keyboardType="numeric"
                  placeholder="e.g. 4800 (optional)"
                  placeholderTextColor={colors.gray}
                  editable={!savingSalary}
                />
                <Text style={styles.formHelper}>
                  Running salary after deductions this cycle
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reason / Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={salaryReason}
                  onChangeText={setSalaryReason}
                  placeholder="e.g. Annual raise, promotion, performance review"
                  placeholderTextColor={colors.gray}
                  multiline={true}
                  numberOfLines={2}
                  editable={!savingSalary}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setSalaryModalVisible(false)}
                  disabled={savingSalary}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveModalBtn, savingSalary && { opacity: 0.7 }]}
                  onPress={handleSaveSalary}
                  disabled={savingSalary}
                  activeOpacity={0.8}
                >
                  {savingSalary ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveModalBtnText}>Update Salary</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* More Options Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={moreModalVisible}
          onRequestClose={() => setMoreModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.moreModalOverlay}
            activeOpacity={1}
            onPress={() => setMoreModalVisible(false)}
          >
            <View style={styles.moreModalContent}>
              <View style={styles.moreModalDragHandle} />

              <TouchableOpacity 
                style={styles.moreModalOption} 
                onPress={() => {
                  setMoreModalVisible(false);
                  setTimeout(() => {
                    setIsMuted(!isMuted);
                    Alert.alert('Success', isMuted ? 'Notifications unmuted' : 'Notifications muted');
                  }, 100);
                }}
              >
                <View style={styles.moreModalIconBox}>
                  <Image source={require('../assets/icons/notifications-off.png')} style={styles.moreModalIcon} />
                </View>
                <Text style={styles.moreModalOptionText}>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreModalOption} 
                onPress={() => {
                  setMoreModalVisible(false);
                  setTimeout(() => {
                    Alert.alert(
                      'Clear Chat',
                      'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Clear', 
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await api.delete(`/chats/${chatId}/messages`, { data: { clearAll: true } });
                              if (Platform.OS === 'android') {
                                ToastAndroid.show('Chat cleared', ToastAndroid.SHORT);
                              } else {
                                Alert.alert('Cleared', 'Chat history has been cleared.');
                              }
                              navigation.goBack(); // Return to the chat room
                            } catch (err) {
                              Alert.alert('Error', err.response?.data?.message || 'Failed to clear chat');
                            }
                          }
                        }
                      ]
                    );
                  }, 100);
                }}
              >
                <View style={styles.moreModalIconBox}>
                  <Image source={require('../assets/icons/delete.png')} style={styles.moreModalIcon} />
                </View>
                <Text style={styles.moreModalOptionText}>Clear Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreModalOption} 
                onPress={() => {
                  setMoreModalVisible(false);
                  setTimeout(() => {
                    Alert.alert(
                      'Report Contact',
                      'This will forward recent messages to TaskChat admins for review. Do you want to proceed?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Report', 
                          style: 'destructive',
                          onPress: () => {
                            Alert.alert('Success', 'Report submitted successfully.');
                          }
                        }
                      ]
                    );
                  }, 100);
                }}
              >
                <View style={styles.moreModalIconBox}>
                  <Image source={require('../assets/icons/report.png')} style={styles.moreModalIcon} />
                </View>
                <Text style={styles.moreModalOptionText}>Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreModalOption}
                onPress={() => {
                  setMoreModalVisible(false);
                  setTimeout(() => {
                    handleBlockUser();
                  }, 100);
                }}
              >
                <View style={[styles.moreModalIconBox, styles.moreModalDangerBox]}>
                  <Image source={require('../assets/icons/blocked.png')} style={[styles.moreModalIcon, styles.moreModalDangerIcon]} />
                </View>
                <Text style={[styles.moreModalOptionText, styles.moreModalDangerText]}>Block User</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  backArrow: {
    width: 24,
    height: 24,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
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
  avatarGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 32, fontWeight: 'bold' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    borderWidth: 3,
    borderColor: colors.darkBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadgeIcon: { width: 12, height: 12, tintColor: colors.white, resizeMode: 'contain' },
  nameText: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4 },
  subtitleText: { fontSize: 14, color: colors.gray },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 32,
    paddingHorizontal: spacing.sm,
  },
  actionBtnWrapper: { alignItems: 'center', width: 70 },
  actionBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionBtnIcon: { width: 20, height: 20, tintColor: colors.primary, resizeMode: 'contain' },
  actionBtnLabel: { color: colors.gray, fontSize: 12, fontWeight: '500', textAlign: 'center' },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lastItemRow: { borderBottomWidth: 0, paddingBottom: 4 },
  listItemIconBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listItemIcon: { width: 22, height: 22, tintColor: colors.white, resizeMode: 'contain' },
  listItemTextWrap: { flex: 1, justifyContent: 'center' },
  listItemTitle: { color: colors.white, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  listItemSubtitle: { color: colors.gray, fontSize: 13, textTransform: 'capitalize' },
  chevron: { color: colors.gray, fontSize: 22, fontWeight: '300', marginLeft: 8 },
  membersSectionHeader: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.xs,
  },
  membersSectionTitle: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  membersSectionSubtitle: { color: colors.gray, fontSize: 13 },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  addMemberIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addMemberIconText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
  addMemberText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  memberAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberAvatarImage: { width: '100%', height: '100%' },
  memberAvatarText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  seeAllBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  dangerBtn: {
    backgroundColor: '#E11D48',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dangerBtnText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E2336',
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  modalHeaderSubtitle: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  modalCloseText: {
    color: colors.gray,
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 6,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formInputMultiline: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  formHelper: {
    color: colors.gray,
    fontSize: 11,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  saveModalBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  saveModalBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  moreModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  moreModalContent: {
    backgroundColor: '#1E2336',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  moreModalDragHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  moreModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  moreModalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moreModalIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  moreModalOptionText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  moreModalDangerBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  moreModalDangerIcon: {
    tintColor: '#FF3B30',
  },
  moreModalDangerText: {
    color: '#FF3B30',
  },
});

export default ContactDetailScreen;