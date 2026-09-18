import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const getChatTitle = (chat, myId) => {
  if (chat.isGroup) return chat.name;
  const other = chat.members.find((m) => m._id !== myId);
  return other?.name || 'Unknown';
};

const getChatSortTime = (chat) => {
  if (!chat) return 0;
  const lastMsgTime = chat.lastMessage?.createdAt ? new Date(chat.lastMessage.createdAt).getTime() : 0;
  const updateTime = chat.updatedAt ? new Date(chat.updatedAt).getTime() : 0;
  const createTime = chat.createdAt ? new Date(chat.createdAt).getTime() : 0;
  return Math.max(lastMsgTime, updateTime, createTime);
};

const sortChats = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => getChatSortTime(b) - getChatSortTime(a));
};

const getMessagePreview = (lastMsg) => {
  if (!lastMsg) return 'Say hello 👋';
  if (typeof lastMsg === 'string') return lastMsg;
  if (lastMsg.text) {
    if (lastMsg.text.startsWith('📞')) {
      return lastMsg.text;
    }
    if (lastMsg.text.startsWith('📍')) {
      const firstLine = lastMsg.text.split('\n')[0];
      return firstLine || '📍 Location';
    }
    const cleanText = lastMsg.text.replace(/^💬 \[Reply to .*?: ".*?"\]\n/, '');
    return cleanText || lastMsg.text;
  }
  if (lastMsg.attachmentUrl || lastMsg.image) {
    return '📷 Photo';
  }
  return 'Say hello 👋';
};

const formatChatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
};

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [chats, setChats] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskStats, setTaskStats] = useState(null);
  const [taskStatsLoading, setTaskStatsLoading] = useState(true);
  const [taskStatsError, setTaskStatsError] = useState(false);

  // Hardware Back button handling on Android to exit selection mode
  useEffect(() => {
    const onBackPress = () => {
      if (selectedChatIds.length > 0) {
        setSelectedChatIds([]);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedChatIds]);

  const PAGE_LIMIT = 30;

  const loadChats = async () => {
    try {
      const { data } = await api.get('/chats', {
        params: { skip: 0, limit: PAGE_LIMIT },
      });
      const newChats = Array.isArray(data) ? data : data.chats || [];
      setChats(sortChats(newChats));
      setHasMore(data.hasMore !== undefined ? data.hasMore : newChats.length >= PAGE_LIMIT);
    } catch (err) {
      console.warn('Failed to load chats:', err);
    }
  };

  const loadMoreChats = async () => {
    if (!hasMore || loadingMore || refreshing) return;
    try {
      setLoadingMore(true);
      const skip = chats.length;
      const { data } = await api.get('/chats', {
        params: { skip, limit: PAGE_LIMIT },
      });
      const nextChats = Array.isArray(data) ? data : data.chats || [];
      if (nextChats.length > 0) {
        setChats((prev) => {
          const existingIds = new Set(prev.map((c) => (c._id || c.id)?.toString()));
          const uniqueNext = nextChats.filter((c) => !existingIds.has((c._id || c.id)?.toString()));
          return sortChats([...prev, ...uniqueNext]);
        });
      }
      setHasMore(data.hasMore !== undefined ? data.hasMore : nextChats.length >= PAGE_LIMIT);
    } catch (err) {
      console.warn('Failed to load more chats:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadTaskStats = async () => {
    try {
      setTaskStatsLoading(true);
      setTaskStatsError(false);
      const { data } = await api.get('/tasks');
      if (Array.isArray(data)) {
        let done = 0;
        let remaining = 0;
        data.forEach((task) => {
          const norm = task.status ? task.status.toLowerCase().replace(/_/g, ' ').trim() : '';
          if (norm === 'completed') {
            done++;
          } else {
            remaining++;
          }
        });
        setTaskStats({ done, remaining });
      }
    } catch (err) {
      // Hide stats row silently if request errors
      console.warn('Failed to fetch task stats:', err);
      setTaskStatsError(true);
    } finally {
      setTaskStatsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
      loadTaskStats();
    }, [])
  );

  // Real-time listener for incoming/outgoing messages, deletes, and unread counts
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const msgChatId = (msg.chat?._id || msg.chat)?.toString();
      if (!msgChatId) return;

      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => (c._id || c.id)?.toString() === msgChatId);
        if (chatIndex === -1) {
          api.get('/chats', { params: { skip: 0, limit: PAGE_LIMIT } })
            .then(({ data }) => {
              const fresh = Array.isArray(data) ? data : data.chats || [];
              setChats(sortChats(fresh));
            })
            .catch(() => {});
          return prevChats;
        }

        const existingChat = prevChats[chatIndex];
        const updatedChat = {
          ...existingChat,
          lastMessage: msg,
          updatedAt: msg.createdAt || new Date().toISOString(),
        };

        // Increment unread count if message is from another user
        const senderId = (msg.sender?._id || msg.sender)?.toString();
        const myUserId = (user?._id || user?.id)?.toString();
        if (senderId && myUserId && senderId !== myUserId) {
          updatedChat.unreadCount = (existingChat.unreadCount || 0) + 1;
        }

        // Re-order immediately so latest message moves to the very top (index 0)
        const remaining = prevChats.filter((_, idx) => idx !== chatIndex);
        return [updatedChat, ...remaining];
      });
    };

    const handleChatUnread = ({ chatId, unreadCount }) => {
      setChats((prevChats) =>
        prevChats.map((c) =>
          (c._id || c.id)?.toString() === chatId?.toString() ? { ...c, unreadCount } : c
        )
      );
    };

    const handleMessageDelete = ({ chatId, messageIds }) => {
      if (!chatId) return;
      setChats((prevChats) =>
        prevChats.map((c) => {
          if ((c._id || c.id)?.toString() !== chatId?.toString()) return c;
          if (c.lastMessage?._id && messageIds?.includes(c.lastMessage._id)) {
            loadChats();
          }
          return c;
        })
      );
    };

    const handleChatDeleted = ({ chatIds }) => {
      if (Array.isArray(chatIds)) {
        setChats((prevChats) =>
          prevChats.filter((c) => !chatIds.includes((c._id || c.id)?.toString()))
        );
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('chat:unread', handleChatUnread);
    socket.on('message:delete', handleMessageDelete);
    socket.on('chat:deleted', handleChatDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('chat:unread', handleChatUnread);
      socket.off('message:delete', handleMessageDelete);
      socket.off('chat:deleted', handleChatDeleted);
    };
  }, [socket, user?.id, user?._id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadChats(), loadTaskStats()]);
    setRefreshing(false);
  };

  const handleToggleSelectChat = (chatId) => {
    setSelectedChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      } else {
        return [...prev, chatId];
      }
    });
  };

  const handleChatPress = (item, title) => {
    const chatId = (item._id || item.id)?.toString();
    if (selectedChatIds.length > 0) {
      handleToggleSelectChat(chatId);
    } else {
      // Optimistically reset unread badge on tap
      setChats((prev) =>
        prev.map((c) => (c._id === item._id ? { ...c, unreadCount: 0 } : c))
      );
      navigation.navigate('ChatRoom', { chat: item, title });
    }
  };

  const handleChatLongPress = (item) => {
    const chatId = (item._id || item.id)?.toString();
    if (!selectedChatIds.includes(chatId)) {
      setSelectedChatIds((prev) => [...prev, chatId]);
    }
  };

  const confirmDeleteSelectedChats = () => {
    if (selectedChatIds.length === 0) return;
    const count = selectedChatIds.length;
    Alert.alert(
      count === 1 ? 'Delete Chat' : 'Delete Selected Chats',
      count === 1
        ? 'Are you sure you want to delete this chat?'
        : `Are you sure you want to delete ${count} selected chats?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: executeDeleteSelectedChats,
        },
      ]
    );
  };

  const executeDeleteSelectedChats = async () => {
    const idsToDelete = [...selectedChatIds];
    // Optimistically remove from list immediately
    setChats((prev) =>
      prev.filter((c) => !idsToDelete.includes((c._id || c.id)?.toString()))
    );
    setSelectedChatIds([]);

    try {
      await api.delete('/chats', { data: { chatIds: idsToDelete } });
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          idsToDelete.length === 1 ? 'Chat deleted' : `${idsToDelete.length} chats deleted`,
          ToastAndroid.SHORT
        );
      }
    } catch (err) {
      console.warn('Failed to delete chats:', err);
      loadChats();
      Alert.alert(
        'Delete Failed',
        err.response?.data?.message || err.message || 'Failed to delete chat(s)'
      );
    }
  };

  const filteredChats = chats.filter((chat) => {
    const title = getChatTitle(chat, user.id) || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderItem = ({ item }) => {
    const title = getChatTitle(item, user.id);
    const preview = getMessagePreview(item.lastMessage);
    const timeText = formatChatTimestamp(item.lastMessage?.createdAt || item.updatedAt);
    const otherUser = item.isGroup ? null : item.members?.find((m) => (m._id || m.id)?.toString() !== user?.id?.toString());
    const avatarUrl = item.isGroup ? item.avatar : otherUser?.avatar;
    const isOnline = otherUser?.isOnline;
    const isSelected = selectedChatIds.includes((item._id || item.id)?.toString());

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        activeOpacity={0.7}
        onPress={() => handleChatPress(item, title)}
        onLongPress={() => handleChatLongPress(item)}
        delayLongPress={250}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{title?.[0]?.toUpperCase()}</Text>
            )}
          </View>
          {isSelected ? (
            <View style={styles.selectedCheckBadge}>
              <Image
                source={require('../assets/icons/mark.png')}
                style={styles.selectedCheckIcon}
              />
            </View>
          ) : (
            !item.isGroup && isOnline && <View style={styles.onlineBadge} />
          )}
        </View>

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{title}</Text>
          <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
        </View>

        <View style={styles.rightInfo}>
          <Text style={styles.timeText}>{timeText}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header Bar / Selection Toolbar */}
        {selectedChatIds.length > 0 ? (
          <View style={styles.selectionHeader}>
            <View style={styles.selectionLeft}>
              <TouchableOpacity
                style={styles.selectionCloseBtn}
                activeOpacity={0.7}
                onPress={() => setSelectedChatIds([])}
              >
                <Image
                  source={require('../assets/icons/close.png')}
                  style={styles.selectionCloseIcon}
                />
              </TouchableOpacity>
              <Text style={styles.selectionCountText}>
                {selectedChatIds.length}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.selectionDeleteBtn}
              activeOpacity={0.7}
              onPress={confirmDeleteSelectedChats}
            >
              <Image
                source={require('../assets/icons/delete.png')}
                style={styles.selectionDeleteIcon}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <View>
              <Text style={styles.appTitle}>TaskChat</Text>
              <Text style={styles.appSubtitle}>Chat • Collaborate • Get things done</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.userAvatarBtn} 
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.8}
              >
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.headerUserImage} />
                ) : (
                  <Text style={styles.headerUserInitial}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                )}
                <View style={styles.headerOnlineDot} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.settingsIconBtn} 
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.8}
              >
                <Image source={require('../assets/icons/settings.png')} style={styles.settingsIcon} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search Bar - hidden during selection */}
        {selectedChatIds.length === 0 && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor={colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {/* "Your Tasks" Banner Card - hidden during selection */}
        {selectedChatIds.length === 0 && (
          <TouchableOpacity 
            style={styles.taskCard} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Tasks')}
          >
            <View style={styles.taskCardLeft}>
              <View style={styles.taskCardIconBox}>
                <Image source={require('../assets/icons/task.png')} style={styles.taskCardIcon} />
              </View>
              <View>
                <Text style={styles.taskCardTitle}>Your Tasks ›</Text>
                {taskStatsLoading ? (
                  <View style={styles.taskStatsRow}>
                    <View style={styles.statPillLoading}>
                      <ActivityIndicator size="small" color={colors.primary} style={styles.loadingSpinner} />
                      <Text style={styles.statTextLoading}>Loading counts...</Text>
                    </View>
                  </View>
                ) : !taskStatsError && taskStats ? (
                  <View style={styles.taskStatsRow}>
                    <View style={styles.statPillDone}>
                      <Image source={require('../assets/icons/mark.png')} style={styles.statDotDone} />
                      <Text style={styles.statTextDone}>{taskStats.done} Done</Text>
                    </View>
                    <View style={styles.statPillRemain}>
                      <Image source={require('../assets/icons/hour.png')} style={styles.statDotRemain} />
                      <Text style={styles.statTextRemain}>{taskStats.remaining} Remaining</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.taskCardCalendarIconBox}>
              <Image source={require('../assets/icons/calender.png')} style={styles.calendarIcon} />
            </View>
          </TouchableOpacity>
        )}

        {/* Chat List */}
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreChats}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadChats} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No chats found.</Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.footerLoader}
              />
            ) : null
          }
        />

        {/* Glowing Floating Action Button - hidden during selection */}
        {selectedChatIds.length === 0 && (
          <TouchableOpacity 
            style={styles.fab} 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.darkBackground 
  },
  container: { 
    flex: 1, 
    backgroundColor: colors.darkBackground,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  headerUserImage: { width: '100%', height: '100%' },
  headerUserInitial: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.darkBackground,
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: fontSizes.md,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  taskCardIcon: { width: 24, height: 24, tintColor: colors.white, resizeMode: 'contain' },
  taskCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
  },
  taskStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statPillLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginRight: 6,
    transform: [{ scale: 0.75 }],
  },
  statTextLoading: {
    color: colors.gray,
    fontSize: 12,
    fontWeight: '500',
  },
  statPillDone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statDotDone: { width: 12, height: 12, marginRight: 4, resizeMode: 'contain' },
  statTextDone: { color: colors.gray, fontSize: 12, fontWeight: '600' },
  statPillRemain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDotRemain: { width: 12, height: 12, marginRight: 4, resizeMode: 'contain' },
  statTextRemain: { color: colors.gray, fontSize: 12, fontWeight: '600' },
  taskCardCalendarIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIcon: { width: 20, height: 20, tintColor: colors.primary, resizeMode: 'contain' },
  listContent: {
    paddingBottom: 110,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.5)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.darkBackground,
  },
  middle: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 4 },
  preview: { fontSize: 14, color: colors.gray },
  rightInfo: { alignItems: 'flex-end', justifyContent: 'center' },
  timeText: { fontSize: 12, color: colors.gray, fontWeight: '500', marginBottom: 6 },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: colors.gray, marginTop: spacing.xl },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  fabText: { color: colors.white, fontSize: 32, lineHeight: 34, fontWeight: '300' },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  selectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  selectionCloseIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  selectionCountText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  selectionDeleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionDeleteIcon: {
    width: 22,
    height: 22,
    tintColor: colors.danger,
    resizeMode: 'contain',
  },
  rowSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  selectedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.darkBackground,
  },
  selectedCheckIcon: {
    width: 12,
    height: 12,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
});

export default ChatListScreen;