import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ImageBackground,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const FILTERS = ['All', 'Pending', 'In Progress', 'Completed'];

const TaskListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection mode state for selective task deletion
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hide the native header to use our custom dark theme header
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Handle hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (selectedTaskIds.length > 0) {
        setSelectedTaskIds([]);
        return true;
      }
      if (isSearchActive) {
        setIsSearchActive(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedTaskIds, isSearchActive]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [])
  );

  const normalizeStatus = (status) => (status ? status.toLowerCase().replace(/_/g, ' ').trim() : '');
  const isTaskCompleted = (task) => normalizeStatus(task?.status) === 'completed';

  // Combined filtering: Filter Tab + Real-time Search by title or description
  const filteredTasks = tasks.filter((task) => {
    // 1. Status Filter tab matching
    if (activeFilter !== 'All' && normalizeStatus(task.status) !== normalizeStatus(activeFilter)) {
      return false;
    }

    // 2. Real-time Search query matching (title or description)
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const titleMatch = (task.title || '').toLowerCase().includes(query);
    const descMatch = (task.description || '').toLowerCase().includes(query);
    return titleMatch || descMatch;
  });

  const getStatusConfig = (status, deadline) => {
    const isOverdue = new Date(deadline) < new Date() && status !== 'completed';
    const statusLower = normalizeStatus(status);

    let config = {
      bgColor: 'rgba(225, 29, 72, 0.15)', // Default Pending (Red)
      textColor: colors.danger,
      label: 'Pending',
    };

    if (statusLower === 'completed') {
      config = { bgColor: 'rgba(16, 185, 129, 0.15)', textColor: colors.success, label: 'Completed' };
    } else if (statusLower === 'in progress') {
      config = { bgColor: 'rgba(245, 158, 11, 0.15)', textColor: colors.warning, label: 'In Progress' };
    }

    return { ...config, isOverdue };
  };

  // Selection handlers
  const handleTaskLongPress = (item) => {
    const taskId = (item._id || item.id)?.toString();
    if (!taskId) return;

    // Strict validation: Only completed tasks can be selected for deletion
    if (!isTaskCompleted(item)) {
      Alert.alert(
        'Cannot Delete Task',
        'Only tasks with a "completed" status can be deleted. Active or pending tasks cannot be removed via this interface.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Toggle selection
    setSelectedTaskIds((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId);
      }
      return [...prev, taskId];
    });
  };

  const handleTaskPress = (item) => {
    const taskId = (item._id || item.id)?.toString();
    if (!taskId) return;

    const isSelectionMode = selectedTaskIds.length > 0;

    if (isSelectionMode) {
      // In selection mode, tapping toggles selection
      if (!isTaskCompleted(item)) {
        Alert.alert(
          'Cannot Select Task',
          'Only tasks with a "completed" status can be deleted. Active or pending tasks cannot be removed via this interface.',
          [{ text: 'OK' }]
        );
        return;
      }

      setSelectedTaskIds((prev) => {
        if (prev.includes(taskId)) {
          return prev.filter((id) => id !== taskId);
        }
        return [...prev, taskId];
      });
    } else {
      // Normal mode: navigate to detail screen
      navigation.navigate('TaskDetail', { task: item });
    }
  };

  // Deletion execution with strict validation
  const confirmDeleteSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;

    // Enforce strict validation: ensure all selected items are actually completed
    const selectedTasks = tasks.filter((t) => selectedTaskIds.includes((t._id || t.id)?.toString()));
    const nonCompleted = selectedTasks.filter((t) => !isTaskCompleted(t));

    if (nonCompleted.length > 0) {
      Alert.alert(
        'Validation Error',
        'Only tasks with a "completed" status can be deleted. Active or pending tasks cannot be removed.',
        [{ text: 'OK' }]
      );
      return;
    }

    const count = selectedTaskIds.length;
    Alert.alert(
      count === 1 ? 'Delete Completed Task' : 'Delete Selected Tasks',
      count === 1
        ? 'Are you sure you want to delete this completed task? This action cannot be undone.'
        : `Are you sure you want to delete ${count} selected completed tasks? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: executeDeleteSelectedTasks,
        },
      ]
    );
  };

  const executeDeleteSelectedTasks = async () => {
    const idsToDelete = [...selectedTaskIds];
    if (idsToDelete.length === 0) return;

    try {
      setIsDeleting(true);

      // Optimistically remove from state
      setTasks((prev) => prev.filter((t) => !idsToDelete.includes((t._id || t.id)?.toString())));
      setSelectedTaskIds([]);

      // Call backend bulk deletion
      await api.delete('/tasks', { data: { taskIds: idsToDelete } });

      if (Platform.OS === 'android') {
        ToastAndroid.show(
          idsToDelete.length === 1 ? 'Completed task deleted' : `${idsToDelete.length} completed tasks deleted`,
          ToastAndroid.SHORT
        );
      }
    } catch (err) {
      console.warn('Failed to delete tasks:', err);
      fetchTasks(); // Revert on failure
      Alert.alert(
        'Delete Failed',
        err.response?.data?.message || err.message || 'Failed to delete task(s).'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTaskCard = ({ item }) => {
    const taskId = (item._id || item.id)?.toString();
    const isSelectionMode = selectedTaskIds.length > 0;
    const isSelected = selectedTaskIds.includes(taskId);
    const completed = isTaskCompleted(item);

    const { bgColor, textColor, label, isOverdue } = getStatusConfig(item.status, item.deadline);
    const dateObj = new Date(item.deadline);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={[
          styles.taskCard,
          isSelected && styles.taskCardSelected,
          isSelectionMode && !completed && styles.taskCardDisabled,
        ]}
        activeOpacity={0.7}
        onPress={() => handleTaskPress(item)}
        onLongPress={() => handleTaskLongPress(item)}
        delayLongPress={250}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            {/* Dynamic Radio / Selection Indicator */}
            {isSelectionMode ? (
              completed ? (
                isSelected ? (
                  <View style={styles.selectedCheckBadge}>
                    <Image source={require('../assets/icons/mark.png')} style={styles.selectedCheckIcon} />
                  </View>
                ) : (
                  <View style={styles.selectionRadioCircle} />
                )
              ) : (
                <View style={styles.disabledRadioCircle}>
                  <Text style={styles.disabledDash}>✕</Text>
                </View>
              )
            ) : completed ? (
              <View style={styles.completedRadioBadge}>
                <Image source={require('../assets/icons/mark.png')} style={styles.completedCheckIcon} />
              </View>
            ) : (
              <View style={styles.radioCircle} />
            )}

            <Text
              style={[
                styles.taskTitle,
                isSelectionMode && !completed && styles.taskTitleDisabled,
                completed && !isSelectionMode && styles.taskTitleCompleted,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
          </View>
        </View>

        <View style={styles.cardMiddle}>
          <View style={[styles.statusPill, { backgroundColor: bgColor }]}>
            <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
          </View>

          {isOverdue && (
            <View style={styles.overduePill}>
              <Text style={styles.overdueText}>Overdue</Text>
            </View>
          )}

          {isSelectionMode && !completed && (
            <View style={styles.lockedPill}>
              <Text style={styles.lockedPillText}>Cannot Delete (Active)</Text>
            </View>
          )}
        </View>

        {item.description ? (
          <View style={styles.cardDescRow}>
            <Text
              style={[
                styles.descText,
                isSelectionMode && !completed && styles.descTextDisabled,
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Image source={require('../assets/icons/task.png')} style={styles.calendarIcon} />
          <Text style={[styles.dateText, isOverdue && styles.dateTextOverdue]}>
            {formattedDate} • {formattedTime}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isSelectionMode = selectedTaskIds.length > 0;

  return (
    <ImageBackground
      source={require('../assets/images/chat_background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header Switch: Selection Mode vs Active Search vs Standard Header */}
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <View style={styles.selectionLeft}>
              <TouchableOpacity
                onPress={() => setSelectedTaskIds([])}
                style={styles.selectionCloseBtn}
                activeOpacity={0.7}
              >
                <Image source={require('../assets/icons/close.png')} style={styles.selectionCloseIcon} />
              </TouchableOpacity>
              <Text style={styles.selectionCountText}>
                {selectedTaskIds.length} {selectedTaskIds.length === 1 ? 'task' : 'tasks'} selected
              </Text>
            </View>
            <TouchableOpacity
              style={styles.selectionDeleteBtn}
              activeOpacity={0.7}
              onPress={confirmDeleteSelectedTasks}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Image source={require('../assets/icons/delete.png')} style={styles.selectionDeleteIcon} />
              )}
            </TouchableOpacity>
          </View>
        ) : isSearchActive ? (
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>

            <View style={styles.searchInputWrapper}>
              <Image source={require('../assets/icons/search.png')} style={styles.searchInnerIcon} />
              <TextInput
                style={styles.headerSearchInput}
                placeholder="Search tasks by title or description..."
                placeholderTextColor={colors.gray}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                  activeOpacity={0.7}
                >
                  <Image source={require('../assets/icons/close.png')} style={styles.clearSearchIcon} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
              style={styles.cancelSearchBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Tasks</Text>
            <TouchableOpacity
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              onPress={() => setIsSearchActive(true)}
            >
              <Image source={require('../assets/icons/search.png')} style={styles.searchIcon} />
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterPill, activeFilter === item && styles.filterPillActive]}
                onPress={() => setActiveFilter(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Task List */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} size="large" />
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => (item._id || item.id || Math.random()).toString()}
            renderItem={renderTaskCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim()
                    ? `No tasks found matching "${searchQuery.trim()}"`
                    : 'No tasks found for this filter.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Floating Action Button (for Boss/Managers to assign tasks - hidden during selection) */}
        {!isSelectionMode && (user?.role === 'boss' || user?.role === 'manager') && (
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AssignTask')}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
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

  // Header Styles
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
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: colors.white,
    resizeMode: 'contain',
  },

  // Active Search Header Styles
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 4,
  },
  searchInnerIcon: {
    width: 16,
    height: 16,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 8,
  },
  headerSearchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchIcon: {
    width: 14,
    height: 14,
    tintColor: colors.gray,
    resizeMode: 'contain',
  },
  cancelSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelSearchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Selection Mode Header Styles
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectionCloseIcon: {
    width: 16,
    height: 16,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  selectionCountText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  selectionDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  selectionDeleteIcon: {
    width: 20,
    height: 20,
    tintColor: colors.danger,
    resizeMode: 'contain',
  },

  // Filter Bar Styles
  filterContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.md,
  },
  filterPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.white,
  },

  // Task Card Styles
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120, // Extra padding for FAB and bottom nav
  },
  taskCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  taskCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  taskCardDisabled: {
    opacity: 0.55,
  },
  cardHeader: {
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray,
    marginRight: 10,
  },
  selectionRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: 10,
  },
  selectedCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedCheckIcon: {
    width: 11,
    height: 11,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  completedRadioBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1.5,
    borderColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  completedCheckIcon: {
    width: 10,
    height: 10,
    tintColor: colors.success,
    resizeMode: 'contain',
  },
  disabledRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  disabledDash: {
    color: colors.gray,
    fontSize: 9,
    fontWeight: '700',
  },
  taskTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  taskTitleDisabled: {
    color: colors.gray,
  },
  taskTitleCompleted: {
    color: '#E2E8F0',
  },
  cardMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 30, // Aligned with text, skipping radio button
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  overduePill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overdueText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
  },
  lockedPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  lockedPillText: {
    color: colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  cardDescRow: {
    paddingLeft: 30,
    marginBottom: 10,
  },
  descText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  descTextDisabled: {
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 30,
  },
  calendarIcon: {
    width: 14,
    height: 14,
    tintColor: colors.gray,
    resizeMode: 'contain',
    marginRight: 6,
  },
  dateText: {
    color: colors.gray,
    fontSize: 13,
    fontWeight: '500',
  },
  dateTextOverdue: {
    color: '#F43F5E',
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 15,
    lineHeight: 22,
  },

  // FAB Style
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 90,
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
  fabText: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
  },
});

export default TaskListScreen;