import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ImageBackground,
  Image,
  Alert,
  Platform,
} from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSizes } from '../theme/theme';

const TaskDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { task } = route.params || {};
  const [currentTask, setCurrentTask] = useState(task);
  const [updating, setUpdating] = useState(false);

  // Fetch freshest task data on mount/focus
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    if (currentTask?._id) {
      api
        .get(`/tasks/${currentTask._id}`)
        .then(({ data }) => setCurrentTask(data))
        .catch((err) => console.warn('Could not refresh task detail:', err.message));
    }
  }, [navigation, currentTask?._id]);

  // Real-time live countdown timer
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    overdueText: '',
  });

  useEffect(() => {
    if (!currentTask?.deadline) return;

    const calculateTime = () => {
      if (currentTask.status === 'completed') {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isOverdue: false,
          overdueText: '',
        });
        return;
      }

      const now = Date.now();
      const deadlineTime = new Date(currentTask.deadline).getTime();
      const diff = deadlineTime - now;

      if (diff <= 0) {
        const absDiff = Math.abs(diff);
        const hours = Math.floor(absDiff / (1000 * 60 * 60));
        const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
        setCountdown({
          days: 0,
          hours,
          minutes,
          seconds,
          isOverdue: true,
          overdueText: `${hours}h ${minutes}m ${seconds}s overdue`,
        });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({
          days,
          hours,
          minutes,
          seconds,
          isOverdue: false,
          overdueText: '',
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [currentTask?.deadline, currentTask?.status]);

  if (!currentTask) return null;

  // Status visual configuration
  const normalizeStatus = (s) => (s ? s.toLowerCase().replace(/_/g, ' ').trim() : '');
  const statusNorm = normalizeStatus(currentTask.status);

  const getStatusConfig = () => {
    if (statusNorm === 'completed') {
      return { bgColor: 'rgba(16, 185, 129, 0.15)', textColor: colors.success, label: 'Completed', step: 3 };
    } else if (statusNorm === 'in progress') {
      return { bgColor: 'rgba(245, 158, 11, 0.15)', textColor: colors.warning, label: 'In Progress', step: 2 };
    }
    return { bgColor: 'rgba(225, 29, 72, 0.15)', textColor: colors.danger, label: 'Pending', step: 1 };
  };

  const { bgColor, textColor, label, step } = getStatusConfig();

  // Role checks
  const assignees = currentTask.assignedTo || [];
  const isAssignee = assignees.some((u) => {
    const uId = u?._id || u;
    return uId?.toString() === user?._id?.toString();
  });
  const isBossOrManager =
    user?.role === 'boss' ||
    user?.role === 'manager' ||
    (currentTask.assignedBy?._id || currentTask.assignedBy)?.toString() === user?._id?.toString();

  // Optimistic Status Update
  const handleUpdateStatus = async (newStatus) => {
    if (updating || currentTask.status === newStatus) return;

    const prevTask = { ...currentTask };

    // 1. Optimistic Local State Update
    setCurrentTask((prev) => ({
      ...prev,
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : prev.completedAt,
    }));

    try {
      setUpdating(true);
      const { data } = await api.patch(`/tasks/${currentTask._id}/status`, { status: newStatus });
      setCurrentTask(data);
    } catch (err) {
      // 2. Roll back on error
      setCurrentTask(prevTask);
      Alert.alert('Update Failed', err.response?.data?.message || 'Could not update task status. Changes rolled back.');
    } finally {
      setUpdating(false);
    }
  };

  // Date formatting
  const dateObj = new Date(currentTask.deadline);
  const formattedDate = !isNaN(dateObj)
    ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No Date';
  const formattedTime = !isNaN(dateObj)
    ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Completed date formatting if available
  const completedDateObj = currentTask.completedAt ? new Date(currentTask.completedAt) : null;
  const completedText = completedDateObj && !isNaN(completedDateObj)
    ? `${completedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${completedDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  // Deduction math for boss/manager view
  const calculateAssigneeDeduction = (assignee) => {
    let amount = currentTask.deductionAmount || 0;
    if (currentTask.deductionPercent && assignee?.baseSalary) {
      amount += (currentTask.deductionPercent / 100) * assignee.baseSalary;
    }
    return amount;
  };

  const totalDeductionAmount = assignees.reduce((sum, a) => sum + calculateAssigneeDeduction(a), 0);

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
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Main Info Card */}
          <View style={styles.mainCard}>
            <Text style={styles.taskTitle}>{currentTask.title}</Text>
            
            <View style={styles.pillRow}>
              <View style={[styles.statusPill, { backgroundColor: bgColor }]}>
                <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
              </View>
              {countdown.isOverdue && statusNorm !== 'completed' && (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                </View>
              )}
            </View>

            {currentTask.description ? (
              <Text style={styles.taskDescription}>{currentTask.description}</Text>
            ) : (
              <Text style={styles.noDescriptionText}>No description provided.</Text>
            )}
          </View>

          {/* Live Deadline Countdown Card */}
          <View style={styles.cardBlock}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>DEADLINE COUNTDOWN</Text>
              <Text style={styles.dateSubtext}>{formattedDate} • {formattedTime}</Text>
            </View>

            {statusNorm === 'completed' ? (
              <View style={styles.completedBanner}>
                <Text style={styles.completedEmoji}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedBannerTitle}>Task Completed</Text>
                  {completedText && (
                    <Text style={styles.completedBannerSub}>Finished on {completedText}</Text>
                  )}
                </View>
              </View>
            ) : countdown.isOverdue ? (
              <View style={styles.overdueBanner}>
                <Text style={styles.overdueEmoji}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueBannerTitle}>Deadline Missed</Text>
                  <Text style={styles.overdueBannerSub}>{countdown.overdueText}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.timerRow}>
                <View style={styles.timerBox}>
                  <Text style={styles.timerNumber}>{String(countdown.days).padStart(2, '0')}</Text>
                  <Text style={styles.timerUnit}>DAYS</Text>
                </View>
                <Text style={styles.timerColon}>:</Text>
                <View style={styles.timerBox}>
                  <Text style={styles.timerNumber}>{String(countdown.hours).padStart(2, '0')}</Text>
                  <Text style={styles.timerUnit}>HRS</Text>
                </View>
                <Text style={styles.timerColon}>:</Text>
                <View style={styles.timerBox}>
                  <Text style={styles.timerNumber}>{String(countdown.minutes).padStart(2, '0')}</Text>
                  <Text style={styles.timerUnit}>MIN</Text>
                </View>
                <Text style={styles.timerColon}>:</Text>
                <View style={styles.timerBox}>
                  <Text style={styles.timerNumber}>{String(countdown.seconds).padStart(2, '0')}</Text>
                  <Text style={styles.timerUnit}>SEC</Text>
                </View>
              </View>
            )}
          </View>

          {/* Deduction Terms Card */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardLabel}>DEDUCTION TERMS</Text>
            
            <View style={styles.termsGrid}>
              <View style={styles.termItem}>
                <Text style={styles.termLabel}>Flat Penalty</Text>
                <Text style={styles.termValue}>
                  {currentTask.deductionAmount ? `Rs ${currentTask.deductionAmount.toLocaleString()}` : 'None'}
                </Text>
              </View>
              <View style={styles.termDivider} />
              <View style={styles.termItem}>
                <Text style={styles.termLabel}>Percent Penalty</Text>
                <Text style={styles.termValue}>
                  {currentTask.deductionPercent ? `${currentTask.deductionPercent}% of Salary` : 'None'}
                </Text>
              </View>
            </View>

            <Text style={styles.termsNote}>
              {currentTask.deductionAmount || currentTask.deductionPercent
                ? 'Penalty is automatically deducted from base salary if not completed before the deadline.'
                : 'No monetary salary deduction configured for this task.'}
            </Text>
          </View>

          {/* Task Penalty & Deduction Overview Card */}
          <View style={[styles.cardBlock, styles.managerCard]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.managerCardLabel}>TASK PENALTY & DEDUCTION OVERVIEW</Text>
                <View
                  style={[
                    styles.penaltyStatusPill,
                    currentTask.penaltyApplied
                      ? styles.penaltyAppliedBg
                      : countdown.isOverdue && statusNorm !== 'completed'
                      ? styles.penaltyPendingBg
                      : styles.penaltyNoneBg,
                  ]}
                >
                  <Text
                    style={[
                      styles.penaltyStatusText,
                      currentTask.penaltyApplied
                        ? styles.penaltyAppliedText
                        : countdown.isOverdue && statusNorm !== 'completed'
                        ? styles.penaltyPendingText
                        : styles.penaltyNoneText,
                    ]}
                  >
                    {currentTask.penaltyApplied
                      ? 'Penalty Applied'
                      : countdown.isOverdue && statusNorm !== 'completed'
                      ? 'Penalty Pending'
                      : 'No Penalty'}
                  </Text>
                </View>
              </View>

              <View style={styles.managerDeductionBlock}>
                <Text style={styles.managerSubtext}>Resulting Salary Deduction:</Text>
                {assignees.map((assignee) => {
                  const ded = calculateAssigneeDeduction(assignee);
                  return (
                    <View key={assignee._id || assignee.name} style={styles.assigneeDeductionRow}>
                      <Text style={styles.assigneeDeductionName}>{assignee.name || 'Assignee'}:</Text>
                      <Text style={styles.assigneeDeductionAmount}>
                        {ded > 0 ? `Rs ${ded.toLocaleString()}` : 'Rs 0'}
                        {currentTask.deductionPercent > 0 && assignee.baseSalary ? (
                          <Text style={styles.assigneeBaseText}> ({currentTask.deductionPercent}% of Rs {assignee.baseSalary.toLocaleString()})</Text>
                        ) : null}
                      </Text>
                    </View>
                  );
                })}

                {assignees.length > 1 && (
                  <View style={styles.totalDeductionRow}>
                    <Text style={styles.totalDeductionLabel}>Total Deduction:</Text>
                    <Text style={styles.totalDeductionAmount}>
                      Rs {totalDeductionAmount.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

          {/* Assigned By Section */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardLabel}>ASSIGNED BY</Text>
            <View style={styles.issuerRow}>
              <View style={styles.avatarCircle}>
                {currentTask.assignedBy?.avatar ? (
                  <Image source={{ uri: currentTask.assignedBy.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {currentTask.assignedBy?.name?.[0]?.toUpperCase() || 'M'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.issuerName}>{currentTask.assignedBy?.name || 'Task Creator'}</Text>
                <Text style={styles.issuerRole}>
                  {(currentTask.assignedBy?.role || 'Manager').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Assigned To Section */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardLabel}>ASSIGNED TO ({assignees.length})</Text>
            {assignees.map((assignee, idx) => {
              const isCurrentUser = (assignee?._id || assignee)?.toString() === user?._id?.toString();
              return (
                <View
                  key={assignee._id || idx}
                  style={[styles.assigneeRow, idx === assignees.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.avatarCircle}>
                    {assignee.avatar ? (
                      <Image source={{ uri: assignee.avatar }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarInitials}>{assignee.name?.[0]?.toUpperCase() || 'U'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.assigneeName}>{assignee.name || 'Team Member'}</Text>
                      {isCurrentUser && <Text style={styles.youBadge}>(You)</Text>}
                    </View>
                    <Text style={styles.assigneeRole}>{assignee.role || 'Employee'}</Text>
                  </View>
                </View>
              );
            })}
            {assignees.length === 0 && (
              <Text style={styles.emptyText}>No assignees listed.</Text>
            )}
          </View>

          {/* Status Progression Timeline */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardLabel}>PROGRESSION</Text>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineStep}>
                <View style={[styles.node, step >= 1 && styles.nodeActive]}>
                  {step >= 1 && <Text style={styles.nodeCheck}>✓</Text>}
                </View>
                <Text style={styles.stepLabel}>Assigned</Text>
              </View>

              <View style={[styles.line, step >= 2 && styles.lineActive]} />

              <View style={styles.timelineStep}>
                <View style={[styles.node, step >= 2 && styles.nodeActive]}>
                  {step >= 2 && <Text style={styles.nodeCheck}>✓</Text>}
                </View>
                <Text style={styles.stepLabel}>In Progress</Text>
              </View>

              <View style={[styles.line, step >= 3 && styles.lineActive]} />

              <View style={styles.timelineStep}>
                <View style={[styles.node, step >= 3 && styles.nodeActive]}>
                  {step >= 3 && <Text style={styles.nodeCheck}>✓</Text>}
                </View>
                <Text style={styles.stepLabel}>Completed</Text>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* Universal Action Controls - Visible to all authorized task viewers */}
        <View style={styles.footer}>
          {statusNorm === 'completed' ? (
            <View style={styles.completedNoticeRow}>
              <View style={styles.completedNoticeBadge}>
                <Text style={styles.completedNoticeText}>✓ Task Completed</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, styles.reopenBtn]}
                onPress={() => handleUpdateStatus('in_progress')}
                disabled={updating}
                activeOpacity={0.8}
              >
                <Text style={styles.reopenBtnText}>↺ Reopen Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionBtnRow}>
              {/* Button 1: Mark In Progress */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.inProgressBtn,
                  statusNorm === 'in progress' && styles.actionBtnCurrent,
                ]}
                onPress={() => handleUpdateStatus('in_progress')}
                disabled={updating || statusNorm === 'in progress'}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    statusNorm === 'in progress' ? styles.inProgressTextActive : styles.inProgressText,
                  ]}
                >
                  {statusNorm === 'in progress' ? '● In Progress' : 'Start Task'}
                </Text>
              </TouchableOpacity>

              {/* Button 2: Mark Completed */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn]}
                onPress={() => handleUpdateStatus('completed')}
                disabled={updating}
                activeOpacity={0.8}
              >
                <Text style={styles.completeBtnText}>✓ Mark Completed</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  mainCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overdueBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overdueBadgeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  taskDescription: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  noDescriptionText: {
    color: colors.gray,
    fontSize: 14,
    fontStyle: 'italic',
  },
  cardBlock: {
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateSubtext: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  timerBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 54,
  },
  timerNumber: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  timerUnit: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  timerColon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
    marginHorizontal: 6,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  completedEmoji: {
    fontSize: 22,
    color: colors.success,
    fontWeight: 'bold',
    marginRight: 12,
  },
  completedBannerTitle: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
  },
  completedBannerSub: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  overdueEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  overdueBannerTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  overdueBannerSub: {
    color: '#FECDD3',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  termsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  termItem: {
    flex: 1,
    alignItems: 'center',
  },
  termDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  termLabel: {
    fontSize: 11,
    color: colors.gray,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  termValue: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '700',
  },
  termsNote: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 10,
    lineHeight: 16,
  },
  managerCard: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  managerCardLabel: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  penaltyStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  penaltyAppliedBg: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  penaltyAppliedText: { color: colors.danger, fontWeight: '700', fontSize: 11 },
  penaltyPendingBg: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  penaltyPendingText: { color: colors.warning, fontWeight: '700', fontSize: 11 },
  penaltyNoneBg: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  penaltyNoneText: { color: colors.success, fontWeight: '700', fontSize: 11 },
  managerDeductionBlock: {
    marginTop: 6,
  },
  managerSubtext: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
    marginBottom: 6,
  },
  assigneeDeductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  assigneeDeductionName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  assigneeDeductionAmount: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  assigneeBaseText: {
    color: colors.gray,
    fontSize: 11,
    fontWeight: '400',
  },
  totalDeductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  totalDeductionLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  totalDeductionAmount: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
  issuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  issuerName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  issuerRole: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  assigneeName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  youBadge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  assigneeRole: {
    color: colors.gray,
    fontSize: 11,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  emptyText: {
    color: colors.gray,
    fontSize: 13,
    paddingVertical: 8,
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 10,
  },
  timelineStep: {
    alignItems: 'center',
  },
  node: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  nodeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeCheck: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepLabel: {
    color: colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 8,
    marginBottom: 20,
  },
  lineActive: {
    backgroundColor: colors.primary,
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
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inProgressBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  inProgressText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnCurrent: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: colors.warning,
  },
  inProgressTextActive: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
  },
  completeBtn: {
    backgroundColor: colors.success,
  },
  completeBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  completedNotice: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  completedNoticeText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  completedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedNoticeBadge: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  reopenBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reopenBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default TaskDetailScreen;