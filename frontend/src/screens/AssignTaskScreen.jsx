import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  SafeAreaView,
  ImageBackground,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api/client';
import { colors, spacing, fontSizes } from '../theme/theme';

const AssignTaskScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  // Default deadline set to 24 hours from now
  const [deadline, setDeadline] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionPercent, setDeductionPercent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    api.get('/users').then(({ data }) => setUsers(data.filter((u) => u.role === 'employee' || u.role === 'manager')));
  }, [navigation]);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelected(users.map((u) => u._id));

  // Quick preset buttons as shortcuts that update the exact same deadline state
  const addHours = (hours) => {
    setDeadline(new Date(Date.now() + hours * 60 * 60 * 1000));
  };

  const handleOpenPicker = () => {
    setPickerMode('date');
    setShowPicker(true);
  };

  const handlePickerChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }

    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (pickerMode === 'date' && selectedDate) {
        const updated = new Date(deadline);
        updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        setDeadline(updated);
        setTimeout(() => {
          setPickerMode('time');
          setShowPicker(true);
        }, 150);
      } else if (pickerMode === 'time' && selectedDate) {
        const updated = new Date(deadline);
        updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
        setDeadline(updated);
      }
    } else {
      if (selectedDate) {
        setDeadline(selectedDate);
      }
      setShowPicker(false);
    }
  };

  const handleAssign = async () => {
    if (!title.trim()) return Alert.alert('Title is required');
    if (selected.length === 0) return Alert.alert('Select at least one person or the whole team');

    try {
      setSaving(true);
      await api.post('/tasks', {
        title,
        description,
        assignedTo: selected,
        deadline,
        deductionAmount: Number(deductionAmount) || 0,
        deductionPercent: Number(deductionPercent) || 0,
      });
      Alert.alert('Task assigned', 'The team has been notified.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Assign Task</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.label}>Task Title</Text>
          <TextInput 
            style={styles.input} 
            value={title} 
            onChangeText={setTitle} 
            placeholder="e.g. Fix login bug" 
            placeholderTextColor={colors.gray}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Details about the task..."
            placeholderTextColor={colors.gray}
            multiline
          />

          <Text style={styles.label}>Deadline</Text>
          <TouchableOpacity 
            style={styles.dateDisplayCard} 
            onPress={handleOpenPicker}
            activeOpacity={0.7}
          >
            <View style={styles.dateDisplayRow}>
              <View style={styles.calendarIconCircle}>
                <Text style={styles.calendarEmoji}>📅</Text>
              </View>
              <View style={styles.dateTextContainer}>
                <Text style={styles.datePickerSubtext}>Exact Deadline (Tap to customize)</Text>
                <Text style={styles.dateText}>
                  {deadline instanceof Date && !isNaN(deadline) 
                    ? deadline.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) 
                    : 'Select Deadline'}
                </Text>
              </View>
              <View style={styles.pickBadge}>
                <Text style={styles.pickBadgeText}>Pick</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Quick Deadline Presets */}
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetBtn} onPress={() => addHours(2)}>
              <Text style={styles.presetText}>+2 Hours</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => addHours(24)}>
              <Text style={styles.presetText}>+1 Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => addHours(72)}>
              <Text style={styles.presetText}>+3 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => addHours(168)}>
              <Text style={styles.presetText}>+1 Week</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Penalty if Missed (Optional)</Text>
          <View style={styles.penaltyRow}>
            <View style={styles.penaltyInputWrap}>
              <TextInput
                style={styles.input}
                value={deductionAmount}
                onChangeText={setDeductionAmount}
                placeholder="Flat (Rs)"
                placeholderTextColor={colors.gray}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.orText}>OR</Text>
            <View style={styles.penaltyInputWrap}>
              <TextInput
                style={styles.input}
                value={deductionPercent}
                onChangeText={setDeductionPercent}
                placeholder="Percent (%)"
                placeholderTextColor={colors.gray}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.assignHeader}>
            <Text style={styles.sectionTitle}>Assign To</Text>
            <TouchableOpacity onPress={selectAll} activeOpacity={0.7}>
              <Text style={styles.selectAll}>Select all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.userListCard}>
            {users.map((u, index) => (
              <TouchableOpacity 
                key={u._id} 
                style={[styles.userRow, index === users.length - 1 && { borderBottomWidth: 0 }]} 
                onPress={() => toggleSelect(u._id)}
                activeOpacity={0.7}
              >
                <View style={styles.userAvatar}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={styles.userAvatarImage} />
                  ) : (
                    <Text style={styles.userAvatarText}>{u.name[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userRole}>{u.role}</Text>
                </View>
                <View style={[styles.checkbox, selected.includes(u._id) && styles.checkboxActive]}>
                  {selected.includes(u._id) && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}
            {users.length === 0 && (
              <Text style={styles.emptyText}>No assignable users found.</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.assignBtn} onPress={handleAssign} disabled={saving} activeOpacity={0.8}>
            <Text style={styles.assignBtnText}>{saving ? 'Assigning...' : 'Assign Task'}</Text>
          </TouchableOpacity>
        </View>

        {/* Native DateTimePicker for Android */}
        {showPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={deadline instanceof Date && !isNaN(deadline) ? deadline : new Date()}
            mode={pickerMode}
            is24Hour={false}
            display="default"
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            onChange={handlePickerChange}
          />
        )}

        {/* Modal DateTimePicker for iOS */}
        {showPicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="fade" visible={showPicker} onRequestClose={() => setShowPicker(false)}>
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Select Deadline</Text>
                  <TouchableOpacity onPress={() => setShowPicker(false)} activeOpacity={0.7}>
                    <Text style={styles.pickerModalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={deadline instanceof Date && !isNaN(deadline) ? deadline : new Date()}
                  mode="datetime"
                  display="spinner"
                  textColor={colors.white}
                  themeVariant="dark"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (date) setDeadline(date);
                  }}
                />
              </View>
            </View>
          </Modal>
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
  scrollContent: { 
    padding: spacing.md, 
    paddingBottom: 120,
  },
  label: { 
    fontSize: fontSizes.md, 
    fontWeight: '700', 
    color: colors.white, 
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateDisplayCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 16,
    padding: 14,
    justifyContent: 'center',
  },
  dateDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  calendarEmoji: {
    fontSize: 18,
  },
  dateTextContainer: {
    flex: 1,
  },
  datePickerSubtext: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: fontSizes.md,
    color: colors.white,
    fontWeight: '700',
  },
  pickBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  pickBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerModalTitle: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  pickerModalDone: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  presetText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  penaltyInputWrap: {
    flex: 1,
  },
  orText: {
    marginHorizontal: spacing.md,
    color: colors.gray,
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  assignHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end',
  },
  selectAll: { 
    color: colors.primary, 
    fontWeight: '700', 
    marginBottom: spacing.sm,
    fontSize: fontSizes.md,
  },
  userListCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  userAvatarImage: { width: '100%', height: '100%' },
  userAvatarText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, color: colors.white, fontWeight: '600', marginBottom: 2 },
  userRole: { color: colors.gray, fontSize: 12, textTransform: 'capitalize' },
  checkbox: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { 
    backgroundColor: '#10B981', 
    borderColor: '#10B981',
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    paddingVertical: spacing.md,
    textAlign: 'center',
    color: colors.gray,
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
  assignBtn: {
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
  assignBtnText: { 
    color: colors.white, 
    fontWeight: '700', 
    fontSize: fontSizes.lg 
  },
});

export default AssignTaskScreen;