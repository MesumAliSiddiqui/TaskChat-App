import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';

const EmojiPicker = ({
  EMOJI_CATEGORIES,
  activeEmojiCategory,
  setActiveEmojiCategory,
  handleEmojiBackspace,
  handleSelectEmoji,
  styles,
}) => {
  return (
    <View style={styles.emojiPickerContainer}>
      <View style={styles.emojiCategoryRow}>
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.emojiCategoryTab, activeEmojiCategory === idx && styles.emojiCategoryTabActive]}
            onPress={() => setActiveEmojiCategory(idx)}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiCategoryIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.emojiBackspaceBtn}
          onPress={handleEmojiBackspace}
          activeOpacity={0.7}
        >
          <Text style={styles.emojiBackspaceIcon}>⌫</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={EMOJI_CATEGORIES[activeEmojiCategory].emojis}
        keyExtractor={(item, index) => `${item}_${index}`}
        numColumns={7}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.emojiGridContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.emojiCell}
            onPress={() => handleSelectEmoji(item)}
            activeOpacity={0.6}
          >
            <Text style={styles.emojiChar}>{item}</Text>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default EmojiPicker;
