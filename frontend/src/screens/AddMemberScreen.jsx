import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const AddMemberScreen = ({ navigation, route }) => {
  // If you are passing a specific group or task ID to add members to
  const { targetId, targetType } = route.params || {}; 
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Hide native header
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users');
      // Filter out the current user from the list
      const currentUserId = currentUser?._id || currentUser?.id;
      const filtered = data.filter((u) => u._id !== currentUserId);
      setUsers(filtered);
    } catch (err) {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddMembers = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      setSubmitting(true);
      await api.post(`/chats/${targetId}/members`, { memberIds: selectedIds });
      
      const count = selectedIds.length;
      Alert.alert(
        'Success',
        `${count} ${count === 1 ? 'member' : 'members'} added successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to add members');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserRow = ({ item }) => {
    const isSelected = selectedIds.includes(item._id);

    return (
      <TouchableOpacity 
        style={styles.userRow} 
        activeOpacity={0.7}
        onPress={() => toggleSelect(item._id)}
      >
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{item.name?.[0]?.toUpperCase()}</Text>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userRole}>{item.role || 'Member'}</Text>
        </View>

        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <Image source={require('../assets/icons/double-check.png')} style={styles.checkIcon} />
          )}
        </View>
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
          
          {/* Custom Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Members</Text>
            <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
              <Text style={styles.moreDots}>⋮</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Image source={require('../assets/icons/search.png')} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor={colors.gray}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* User List */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} size="large" />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item._id}
              renderItem={renderUserRow}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No users found.</Text>
              }
            />
          )}

          {/* Sticky Footer Button */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.addBtn, selectedIds.length === 0 && styles.addBtnDisabled]} 
              onPress={handleAddMembers}
              disabled={selectedIds.length === 0 || submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>
                {submitting ? 'Adding...' : `Add ${selectedIds.length} Members (${selectedIds.length})`}
              </Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
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
  moreDots: {
    color: colors.gray,
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100, // Make room for footer
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userRole: {
    color: colors.gray,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
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
  emptyText: {
    textAlign: 'center',
    color: colors.gray,
    marginTop: spacing.xl,
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    backgroundColor: 'transparent',
  },
  addBtn: {
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
  addBtnDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
  },
  addBtnText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});

export default AddMemberScreen;