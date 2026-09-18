import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { getMatchedContacts, requestContactsPermission, normalizePhone } from '../utils/contactsService';
import { colors, spacing, fontSizes } from '../theme/theme';

const NewChatScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [contactMatches, setContactMatches] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Group creation state
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [startingChatId, setStartingChatId] = useState(null);

  // Manual phone search
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneSearchResult, setPhoneSearchResult] = useState(null);
  const [phoneSearchUser, setPhoneSearchUser] = useState(null);
  const [searchingPhone, setSearchingPhone] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    api
      .get('/users')
      .then(({ data }) => setUsers(data))
      .catch((err) => console.warn('Could not fetch registered users:', err.message));
  }, [navigation]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { matches, permissionDenied: denied } = await getMatchedContacts();
      setContactMatches(matches || []);
      setPermissionDenied(!!denied);
    } catch (err) {
      console.warn('Failed to load contacts:', err);
      setContactMatches([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const handleRequestPermission = async () => {
    try {
      const granted = await requestContactsPermission();
      if (granted) {
        await loadContacts();
      } else {
        Alert.alert(
          'Permission Required',
          'Contacts access was denied. You can still search by phone number or enable permissions in device settings.'
        );
      }
    } catch (err) {
      console.warn('Error requesting permission:', err);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startPrivateChat = async (userId, name) => {
    if (startingChatId) return;
    try {
      setStartingChatId(userId);
      const { data } = await api.post('/chats/private', { userId });
      navigation.replace('ChatRoom', { chat: data, title: name });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to start chat');
    } finally {
      setStartingChatId(null);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      return Alert.alert('Group Name Required', 'Please enter a name for the new group.');
    }
    if (selected.length < 1) {
      return Alert.alert('Members Required', 'Please select at least one contact to join the group.');
    }

    try {
      setCreatingGroup(true);
      const { data } = await api.post('/chats/group', {
        name: groupName.trim(),
        memberIds: selected,
      });
      navigation.replace('ChatRoom', { chat: data, title: data.name });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handlePhoneSearch = async (text) => {
    setPhoneSearch(text);
    setPhoneSearchResult(null);
    setPhoneSearchUser(null);

    const normalized = normalizePhone(text);
    if (normalized.length < 8) return;

    try {
      setSearchingPhone(true);
      const { data } = await api.post('/users/lookup', { phones: [normalized] });
      if (data.length > 0) {
        setPhoneSearchResult('found');
        setPhoneSearchUser(data[0]);
      } else {
        setPhoneSearchResult('not_found');
      }
    } catch (err) {
      console.warn('Phone lookup failed:', err);
    } finally {
      setSearchingPhone(false);
    }
  };

  const handleInvite = () => {
    Alert.alert('Invite', `Invitation link ready to be sent to ${phoneSearch}.`);
  };

  // Filter list by search query
  const rawData = permissionDenied || (contactMatches.length === 0 && !loadingContacts)
    ? users
    : contactMatches;

  const listData = rawData.filter((u) => {
    const term = searchQuery.toLowerCase();
    const name = (u.displayName || u.name || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    return name.includes(term) || phone.includes(term);
  });

  const renderContactRow = ({ item }) => {
    const isSelected = selected.includes(item._id);
    const displayName = item.displayName || item.name || 'TaskChat User';
    const isStarting = startingChatId === item._id;

    return (
      <TouchableOpacity
        style={[styles.userRow, isSelected && groupMode && styles.userRowSelected]}
        activeOpacity={0.7}
        onPress={() => {
          if (groupMode) {
            toggleSelect(item._id);
          } else {
            startPrivateChat(item._id, displayName);
          }
        }}
        disabled={isStarting}
      >
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{displayName[0]?.toUpperCase() || 'U'}</Text>
          )}
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            {item.isSavedContact === true && (
              <View style={styles.savedContactBadge}>
                <Text style={styles.savedContactText}>Saved</Text>
              </View>
            )}
          </View>
          <Text style={styles.userSubtitle} numberOfLines={1}>
            {item.isSavedContact === false
              ? `Not in contacts • ${item.phone || item.role || 'User'}`
              : item.about || item.phone || item.role || 'On TaskChat'}
          </Text>
        </View>

        {groupMode ? (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Image source={require('../assets/icons/double-check.png')} style={styles.checkIcon} />
            )}
          </View>
        ) : isStarting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.chatArrow}>›</Text>
        )}
      </TouchableOpacity>
    );
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
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (groupMode) {
                  setGroupMode(false);
                  setSelected([]);
                  setGroupName('');
                } else {
                  navigation.goBack();
                }
              }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {groupMode ? 'New Group' : 'Select Contact'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {groupMode
                  ? `${selected.length} selected`
                  : `${listData.length} contacts available`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={loadContacts}
              disabled={loadingContacts}
              activeOpacity={0.7}
            >
              {loadingContacts ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Image source={require('../assets/icons/sync.png')} style={styles.syncIcon} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>

            {/* Group Subject Card (Shown only in Group Mode) */}
            {groupMode && (
              <View style={styles.groupSubjectCard}>
                <View style={styles.groupSubjectIconCircle}>
                  <Image source={require('../assets/icons/groups.png')} style={styles.groupSubjectIcon} />
                </View>
                <TextInput
                  style={styles.groupSubjectInput}
                  placeholder="Type group subject / name..."
                  placeholderTextColor={colors.gray}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={40}
                />
              </View>
            )}

            {/* Direct Phone Search (Private Mode Only) */}
            {!groupMode && (
              <View style={styles.phoneSearchBar}>
                <Image source={require('../assets/icons/call.png')} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search phone (+923219164878)"
                  placeholderTextColor={colors.gray}
                  keyboardType="phone-pad"
                  value={phoneSearch}
                  onChangeText={handlePhoneSearch}
                />
                {searchingPhone && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                )}
              </View>
            )}

            {/* Phone Lookup Result */}
            {!groupMode && phoneSearchResult === 'found' && phoneSearchUser && (
              <TouchableOpacity
                style={styles.searchResultRow}
                onPress={() => startPrivateChat(phoneSearchUser._id, phoneSearchUser.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.searchResultText}>
                  ✓ {phoneSearchUser.name} is on TaskChat — tap to chat
                </Text>
              </TouchableOpacity>
            )}
            {!groupMode && phoneSearchResult === 'not_found' && (
              <TouchableOpacity style={styles.inviteRow} onPress={handleInvite} activeOpacity={0.7}>
                <Text style={styles.inviteText}>Number not found — Tap to send invite</Text>
              </TouchableOpacity>
            )}

            {/* Contacts Search Bar */}
            <View style={styles.searchBar}>
              <Image source={require('../assets/icons/search.png')} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={groupMode ? "Search contacts to add..." : "Search contacts..."}
                placeholderTextColor={colors.gray}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Permission Denied Inline Banner */}
            {permissionDenied && (
              <View style={styles.permissionBanner}>
                <View style={styles.permissionIconCircle}>
                  <Image source={require('../assets/icons/info.png')} style={styles.permissionIcon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionBannerTitle}>Contacts Permission Denied</Text>
                  <Text style={styles.permissionBannerText}>
                    Grant access to see your phone contacts on TaskChat. Showing all registered users as a fallback.
                  </Text>
                  <TouchableOpacity
                    style={styles.grantBtn}
                    onPress={handleRequestPermission}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.grantBtnText}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Top 'New Group' Entry Point (Shown in Private Mode when not searching) */}
            {!groupMode && searchQuery.length === 0 && (
              <TouchableOpacity
                style={styles.newGroupEntryRow}
                onPress={() => {
                  setGroupMode(true);
                  setSelected([]);
                  setGroupName('');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.newGroupIconCircle}>
                  <Image source={require('../assets/icons/groups.png')} style={styles.newGroupIcon} />
                </View>
                <View style={styles.newGroupTextContainer}>
                  <Text style={styles.newGroupTitle}>New Group</Text>
                  <Text style={styles.newGroupSubtitle}>Create a team or project chat</Text>
                </View>
                <Text style={styles.newGroupArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Contacts / Users List */}
            {loadingContacts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loadingText}>Matching device contacts with TaskChat...</Text>
              </View>
            ) : (
              <FlatList
                data={listData}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={renderContactRow}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {permissionDenied
                        ? 'No users found matching your search.'
                        : 'None of your contacts are on TaskChat yet.'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>

          {/* Footer Create Group Button (Group Mode Only) */}
          {groupMode && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!groupName.trim() || selected.length === 0 || creatingGroup) && styles.createBtnDisabled,
                ]}
                onPress={createGroup}
                disabled={!groupName.trim() || selected.length === 0 || creatingGroup}
                activeOpacity={0.8}
              >
                <Text style={styles.createBtnText}>
                  {creatingGroup ? 'Creating Group...' : `Create Group (${selected.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.88)',
  },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
  headerTitleContainer: {
    flex: 1,
    paddingLeft: spacing.xs,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 1,
  },
  syncIcon: {
    width: 18,
    height: 18,
    tintColor: colors.gray,
    resizeMode: 'contain',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  groupSubjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  groupSubjectIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  groupSubjectIcon: {
    width: 18,
    height: 18,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  groupSubjectInput: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  phoneSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchIcon: {
    width: 16,
    height: 16,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
  },
  searchResultRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  searchResultText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 14,
  },
  inviteRow: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  inviteText: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 14,
  },
  permissionBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  permissionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionIcon: {
    width: 16,
    height: 16,
    tintColor: colors.warning,
    resizeMode: 'contain',
  },
  permissionBannerTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  permissionBannerText: {
    color: '#E5E7EB',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  grantBtn: {
    backgroundColor: colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  grantBtnText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: '800',
  },
  newGroupEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  newGroupIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  newGroupIcon: {
    width: 20,
    height: 20,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  newGroupTextContainer: {
    flex: 1,
  },
  newGroupTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  newGroupSubtitle: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 2,
  },
  newGroupArrow: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '300',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    color: colors.gray,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 110,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  userRowSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  savedContactBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savedContactText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  userSubtitle: {
    color: colors.gray,
    fontSize: 12,
  },
  chatArrow: {
    color: colors.gray,
    fontSize: 22,
    fontWeight: '300',
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkIcon: {
    width: 12,
    height: 12,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  createBtn: {
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
  createBtnDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
  },
  createBtnText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});

export default NewChatScreen;