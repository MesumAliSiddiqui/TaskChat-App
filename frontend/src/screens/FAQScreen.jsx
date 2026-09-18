import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  ScrollView,
  Image,
} from 'react-native';
import { colors, spacing, fontSizes } from '../theme/theme';

const FAQ_ITEMS = [
  {
    question: 'How do task assignments work?',
    answer:
      'Managers and bosses can create and assign tasks to individual employees or entire teams from the Tasks tab or Assign Task screen. Tasks include a title, description, deadline, and optional penalty terms.',
  },
  {
    question: 'How are salary deductions calculated?',
    answer:
      'If a task is missed past its deadline without completion, the penalty system calculates deductions using either a flat penalty amount (Rs) or a percentage of the employee’s base salary.',
  },
  {
    question: 'How do read receipts and online status work?',
    answer:
      'You can control your privacy in Profile > Privacy. When Read Receipts are disabled, others won’t see blue ticks when you read messages. When Show Online Status is disabled, your online and last seen status are hidden.',
  },
  {
    question: 'How do I start a 1:1 chat or create a group?',
    answer:
      'Tap the '+' icon on the Chats tab. Tap any contact to instantly start a private conversation, or tap "New Group" at the top to select multiple participants and name your group.',
  },
  {
    question: 'How do I change my profile picture?',
    answer:
      'Go to Profile > Edit Profile and tap the camera badge over your avatar. You can take a new photo with your camera or select an existing picture from your gallery.',
  },
  {
    question: 'Is my data secure on TaskChat?',
    answer:
      'TaskChat uses secure authenticated API endpoints, encrypted JWT sessions, and isolated socket rooms to ensure your messages and company tasks remain confidential.',
  },
];

const FAQItem = ({ item, isExpanded, onToggle }) => (
  <TouchableOpacity style={styles.faqCard} onPress={onToggle} activeOpacity={0.7}>
    <View style={styles.questionRow}>
      <Text style={styles.questionText}>{item.question}</Text>
      <Text style={[styles.accordionChevron, isExpanded && styles.accordionChevronExpanded]}>
        {isExpanded ? '−' : '+'}
      </Text>
    </View>
    {isExpanded && <Text style={styles.answerText}>{item.answer}</Text>}
  </TouchableOpacity>
);

const FAQScreen = ({ navigation }) => {
  const [expandedIndex, setExpandedIndex] = useState(0);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const toggleItem = (index) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn} activeOpacity={0.7}>
            <Image source={require('../assets/icons/back.png')} style={styles.backArrow} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <View style={styles.introIconCircle}>
              <Image source={require('../assets/icons/info.png')} style={styles.introIcon} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>How can we help?</Text>
              <Text style={styles.introSubtitle}>
                Find quick answers to common questions about tasks, chat, and settings.
              </Text>
            </View>
          </View>

          {FAQ_ITEMS.map((item, index) => (
            <FAQItem
              key={index}
              item={item}
              isExpanded={expandedIndex === index}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: colors.darkBackground },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 15, 25, 0.88)' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { width: 24, height: 24, tintColor: colors.white, resizeMode: 'contain' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  introIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  introIcon: { width: 20, height: 20, tintColor: colors.primary, resizeMode: 'contain' },
  introTitle: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  introSubtitle: { color: colors.gray, fontSize: 13, lineHeight: 18 },
  faqCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionText: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  accordionChevron: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  accordionChevronExpanded: {
    color: colors.warning,
  },
  answerText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
});

export default FAQScreen;
