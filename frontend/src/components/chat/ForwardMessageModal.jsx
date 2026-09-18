import React from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, FlatList, Modal, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSizes } from '../../theme/theme';

const ForwardMessageModal = ({
  forwardModalVisible,
  setForwardModalVisible,
  forwardSearch,
  setForwardSearch,
  forwardChats,
  currentUserId,
  forwardSelectedChatIds,
  toggleForwardChatSelection,
  executeForwardMessages,
  forwarding,
  styles
}) => {
  return (
    <Modal
      visible={forwardModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setForwardModalVisible(false)}
    >
      <View style={styles.forwardModalOverlay}>
        <View style={styles.forwardModalContainer}>
          <View style={styles.forwardModalHeader}>
            <TouchableOpacity
              style={styles.forwardModalCloseBtn}
              onPress={() => setForwardModalVisible(false)}
              activeOpacity={0.7}
            >
              <Image source={require('../../assets/icons/close.png')} style={styles.forwardModalCloseIcon} />
            </TouchableOpacity>
            <Text style={styles.forwardModalTitle}>Forward to...</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Search Input */}
          <View style={styles.forwardSearchRow}>
            <Image source={require('../../assets/icons/search.png')} style={styles.forwardSearchIcon} />
            <TextInput
              style={styles.forwardSearchInput}
              placeholder="Search chats..."
              placeholderTextColor={colors.gray}
              value={forwardSearch}
              onChangeText={setForwardSearch}
            />
          </View>

          {/* Chat selection list */}
          <FlatList
            data={forwardChats.filter((c) => {
              const chatTitle = c.isGroup
                ? c.name
                : c.members?.find((m) => (m._id || m.id)?.toString() !== currentUserId)?.name || 'Chat';
              return (chatTitle || '').toLowerCase().includes(forwardSearch.toLowerCase());
            })}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.forwardChatListContent}
            renderItem={({ item }) => {
              const chatTitle = item.isGroup
                ? item.name
                : item.members?.find((m) => (m._id || m.id)?.toString() !== currentUserId)?.name || 'Chat';
              const isSelected = forwardSelectedChatIds.includes(item._id);
              const avatarUrl = item.isGroup
                ? item.avatar
                : item.members?.find((m) => (m._id || m.id)?.toString() !== currentUserId)?.avatar;

              return (
                <TouchableOpacity
                  style={[styles.forwardChatItem, isSelected && styles.forwardChatItemSelected]}
                  activeOpacity={0.7}
                  onPress={() => toggleForwardChatSelection(item._id)}
                >
                  <View style={styles.forwardChatAvatar}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.forwardChatAvatarImg} />
                    ) : (
                      <Text style={styles.forwardChatAvatarText}>{chatTitle?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.forwardChatInfo}>
                    <Text style={styles.forwardChatName} numberOfLines={1}>{chatTitle}</Text>
                    <Text style={styles.forwardChatSub} numberOfLines={1}>
                      {item.isGroup ? `${item.members?.length || 0} members` : 'Direct message'}
                    </Text>
                  </View>
                  <View style={[styles.forwardCheckbox, isSelected && styles.forwardCheckboxActive]}>
                    {isSelected && (
                      <Image source={require('../../assets/icons/mark.png')} style={styles.forwardCheckIcon} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.forwardEmptyWrap}>
                <Text style={styles.forwardEmptyText}>No chats found</Text>
              </View>
            }
          />

          {/* Send Action Footer */}
          {forwardSelectedChatIds.length > 0 && (
            <View style={styles.forwardFooter}>
              <Text style={styles.forwardSelectionCounter}>
                {forwardSelectedChatIds.length} {forwardSelectedChatIds.length === 1 ? 'chat' : 'chats'} selected
              </Text>
              <TouchableOpacity
                style={styles.forwardSendBtn}
                onPress={executeForwardMessages}
                disabled={forwarding}
                activeOpacity={0.8}
              >
                {forwarding ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Image source={require('../../assets/icons/send.png')} style={styles.forwardSendIcon} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ForwardMessageModal;
