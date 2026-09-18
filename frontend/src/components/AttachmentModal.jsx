import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../theme/theme';

const ATTACHMENT_OPTIONS = [
  { id: 'gallery', label: 'Gallery', icon: require('../assets/icons/gallery.png') },
  { id: 'camera', label: 'Camera', icon: require('../assets/icons/camera.png') },
  { id: 'location', label: 'Location', icon: require('../assets/icons/pin.png') },
  { id: 'document', label: 'Document', icon: require('../assets/icons/document.png') },
];

const AttachmentModal = ({ visible, onClose, onSelectOption }) => {
  const navigation = useNavigation();

  const handlePressOption = (optionId) => {
    onClose();
    if (optionId === 'location') {
      navigation.navigate('LocationPicker');
    } else if (onSelectOption) {
      onSelectOption(optionId);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Drag Handle Indicator */}
              <View style={styles.dragHandle} />

              <View style={styles.gridContainer}>
                {ATTACHMENT_OPTIONS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionItem}
                    activeOpacity={0.7}
                    onPress={() => handlePressOption(item.id)}
                  >
                    <View style={styles.iconCircle}>
                      <Image source={item.icon} style={styles.optionIcon} />
                    </View>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    tintColor: colors.white,
  },
  optionLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default AttachmentModal;