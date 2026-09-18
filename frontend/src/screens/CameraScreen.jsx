import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  TextInput,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import ImagePicker from 'react-native-image-crop-picker';
import { colors, spacing, fontSizes } from '../theme/theme';
import { compressImage } from '../utils/imageCompressor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dynamic safe area status bar offset for Android & iOS
const STATUS_BAR_OFFSET = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

// Default initial gallery thumbnails for cyberpunk horizontal strip
const DEFAULT_GALLERY_THUMBNAILS = [
  { id: 'g1', uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&q=80', type: 'photo' },
  { id: 'g2', uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&q=80', type: 'photo' },
  { id: 'g3', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80', type: 'photo' },
  { id: 'g4', uri: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&q=80', type: 'photo' },
  { id: 'g5', uri: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=80', type: 'photo' },
  { id: 'g6', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80', type: 'photo' },
];

const FILTER_PRESETS = [
  { id: 'none', name: 'Normal', color: 'transparent' },
  { id: 'pop', name: 'Pop', color: 'rgba(99, 102, 241, 0.2)' }, // Primary indigo tint
  { id: 'bw', name: 'B&W', color: 'rgba(11, 15, 25, 0.45)' }, // Dark tint
  { id: 'cool', name: 'Cool', color: 'rgba(139, 92, 246, 0.22)' }, // Accent purple tint
  { id: 'warm', name: 'Warm', color: 'rgba(245, 158, 11, 0.2)' }, // Warning amber tint
  { id: 'chrome', name: 'Chrome', color: 'rgba(255, 255, 255, 0.15)' },
  { id: 'cyber', name: 'Cyber', color: 'rgba(16, 185, 129, 0.2)' }, // Success emerald tint
];

const EMOJI_OPTIONS = ['❤️', '🔥', '😂', '👍', '🎉', '✨', '🤩', '🙌', '💯', '😍', '👏'];

const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const CameraScreen = ({ navigation, route }) => {
  const { chatId } = route.params || {};

  const { hasPermission: hasCamPermission, requestPermission: requestCamPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  const [devicePosition, setDevicePosition] = useState('back');
  const device = useCameraDevice(devicePosition);
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const activeRecorderRef = useRef(null);

  // VisionCamera v5 outputs for capture support
  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({
    enableAudio: hasMicPermission === true,
  });

  const handleCameraInitialized = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  useEffect(() => {
    setIsCameraReady(false);
    const timer = setTimeout(() => {
      if (cameraRef.current) {
        setIsCameraReady(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [devicePosition]);

  // Dual-compatibility bridge: ensure cameraRef.current provides takePhoto, startRecording, and stopRecording
  const setCameraRef = useCallback((instance) => {
    cameraRef.current = instance;
    if (instance) {
      if (typeof instance.takePhoto !== 'function') {
        instance.takePhoto = async (options = {}) => {
          if (!photoOutput || typeof photoOutput.capturePhotoToFile !== 'function') {
            throw new Error('Photo output is not initialized');
          }
          const flashMode = options.flash === 'on' || options.flash === 'auto' ? options.flash : 'off';
          const file = await photoOutput.capturePhotoToFile(
            { flashMode },
            {}
          );
          const rawPath = file?.filePath || file?.path || '';
          return {
            path: rawPath,
            width: file?.width,
            height: file?.height,
          };
        };
      }

      if (typeof instance.startRecording !== 'function') {
        instance.startRecording = async (options = {}) => {
          if (!videoOutput || typeof videoOutput.createRecorder !== 'function') {
            throw new Error('Video output is not initialized');
          }
          if (activeRecorderRef.current) {
            try {
              await activeRecorderRef.current.stopRecording();
            } catch (_) { }
            activeRecorderRef.current = null;
          }

          const recorder = await videoOutput.createRecorder({});
          activeRecorderRef.current = recorder;

          await recorder.startRecording(
            (filePath, reason) => {
              activeRecorderRef.current = null;
              const path = typeof filePath === 'string' ? filePath : (filePath?.path || filePath?.filePath || '');
              options.onRecordingFinished?.({ path, reason });
            },
            (err) => {
              activeRecorderRef.current = null;
              options.onRecordingError?.(err);
            }
          );
        };
      }

      if (typeof instance.stopRecording !== 'function') {
        instance.stopRecording = async () => {
          if (activeRecorderRef.current) {
            const recorder = activeRecorderRef.current;
            activeRecorderRef.current = null;
            await recorder.stopRecording();
          }
        };
      }
    }
  }, [photoOutput, videoOutput]);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordIntervalRef = useRef(null);

  // Flash cycle: 'off' -> 'on' -> 'auto'
  const [flash, setFlash] = useState('off');

  // Media preview state
  const [media, setMedia] = useState(null);
  const [caption, setCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewOnceToast, setViewOnceToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Preview Tools State
  const [rotation, setRotation] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [textOverlay, setTextOverlay] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [isDoodleActive, setIsDoodleActive] = useState(false);

  // Gallery thumbnails strip
  const [galleryThumbnails, setGalleryThumbnails] = useState(DEFAULT_GALLERY_THUMBNAILS);

  useEffect(() => {
    if (!hasCamPermission) requestCamPermission();
    if (!hasMicPermission) requestMicPermission();
  }, [hasCamPermission, hasMicPermission]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const triggerViewOnceToast = (message) => {
    setViewOnceToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setViewOnceToast(null);
    }, 2200);
  };

  const toggleViewOnce = () => {
    const nextState = !isViewOnce;
    setIsViewOnce(nextState);
    if (nextState) {
      triggerViewOnceToast('Photo set to view once');
    } else {
      triggerViewOnceToast('Photo set to view multiple times');
    }
  };

  const cycleFlash = () => {
    if (flash === 'off') setFlash('on');
    else if (flash === 'on') setFlash('auto');
    else setFlash('off');
  };

  const getFlashIcon = () => {
    if (flash === 'on') return '⚡';
    if (flash === 'auto') return '⚡A';
    return '⚡⃠';
  };

  const resetPreviewStates = () => {
    setRotation(0);
    setSelectedFilter('none');
    setShowFilters(false);
    setStickers([]);
    setTextOverlay('');
    setCaption('');
    setIsViewOnce(false);
  };

  const takePhoto = async () => {
    if (isCapturing) return;
    if (!isCameraReady || !cameraRef.current) {
      Alert.alert('Camera Error', 'Camera is not ready yet. Please wait a moment.');
      return;
    }
    try {
      setIsCapturing(true);

      const photoOptions = {};
      if (device?.hasFlash && flash !== 'off') {
        photoOptions.flash = flash;
      }

      const photo = await cameraRef.current.takePhoto(photoOptions);
      const rawPath = typeof photo === 'string' ? photo : (photo?.path || photo?.filePath);
      if (!photo || !rawPath) {
        throw new Error('No photo was returned from camera sensor.');
      }

      const photoPath = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;

      resetPreviewStates();
      setGalleryThumbnails((prev) => [{ id: Date.now().toString(), uri: photoPath, type: 'photo' }, ...prev]);
      setMedia({ uri: photoPath, type: 'photo' });
    } catch (err) {
      console.error('Error capturing live photo:', err);
      Alert.alert('Capture Error', err.message || 'Failed to capture live photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const startRecording = async () => {
    try {
      if (isRecordingRef.current) return;
      if (!isCameraReady || !cameraRef.current) {
        Alert.alert('Camera Error', 'Camera is not ready for recording. Please wait a moment.');
        return;
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordSeconds(0);

      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);

      const options = {};
      if (device?.hasFlash && flash !== 'off') {
        options.flash = flash;
      }

      await cameraRef.current.startRecording({
        ...options,
        onRecordingFinished: (video) => {
          isRecordingRef.current = false;
          setIsRecording(false);
          if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
          const rawPath = typeof video === 'string' ? video : (video?.path || video?.filePath || '');
          if (!rawPath) return;
          const videoPath = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;

          resetPreviewStates();
          setGalleryThumbnails((prev) => [{ id: Date.now().toString(), uri: videoPath, type: 'video' }, ...prev]);
          setMedia({ uri: videoPath, type: 'video' });
        },
        onRecordingError: (error) => {
          console.error('Recording Error', error);
          isRecordingRef.current = false;
          setIsRecording(false);
          if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
          Alert.alert('Recording Error', error?.message || 'Failed to record video.');
        },
      });
    } catch (err) {
      console.error('Camera Error starting recording', err);
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      Alert.alert('Recording Error', err?.message || 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);

    if (cameraRef.current) {
      try {
        await cameraRef.current.stopRecording();
      } catch (e) {
        console.warn('Error stopping recording:', e);
      }
    }
  };

  // Dedicated separated gesture handlers for Pressable
  const handlePress = () => {
    if (!isCameraReady || isCapturing || longPressTriggeredRef.current || isRecordingRef.current) {
      return;
    }
    takePhoto();
  };

  const handleLongPress = () => {
    if (!isCameraReady || isCapturing) {
      return;
    }
    longPressTriggeredRef.current = true;
    startRecording();
  };

  const handlePressOut = () => {
    if (isRecordingRef.current) {
      stopRecording();
    }
    setTimeout(() => {
      longPressTriggeredRef.current = false;
    }, 200);
  };

  const openGallery = async () => {
    try {
      const selected = await ImagePicker.openPicker({
        mediaType: 'any',
        multiple: true,
        maxFiles: 10,
      });

      if (Array.isArray(selected) && selected.length > 1) {
        navigation.navigate('ChatRoom', { capturedImages: selected.map(img => img.path) });
        return;
      }

      const singleSelection = Array.isArray(selected) ? selected[0] : selected;
      const type = singleSelection.mime?.startsWith('video') ? 'video' : 'photo';

      resetPreviewStates();
      setMedia({ uri: singleSelection.path, type });
    } catch (err) {
      if (err.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Unable to open gallery.');
      }
    }
  };

  const rotatePreview = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const addSticker = (emoji) => {
    setStickers((prev) => [...prev, { id: Date.now().toString(), emoji }]);
    setShowEmojiPicker(false);
  };

  // Immediate Send with Validated Parameters & Optimistic Update in ChatRoomScreen
  const sendMedia = async () => {
    try {
      if (!media || !media.uri) {
        Alert.alert('Error', 'No valid image to send.');
        return;
      }

      // Ensure media.uri is resolved and validated as string
      let rawUri = media.uri;
      if (rawUri instanceof Promise) {
        rawUri = await rawUri;
      }

      if (!rawUri || typeof rawUri !== 'string') {
        Alert.alert('Error', 'Invalid media URI.');
        return;
      }

      let validUri = rawUri.trim();
      if (!validUri) {
        Alert.alert('Error', 'Media path is empty.');
        return;
      }

      // If photo, compress to max 1600px and 80% JPEG quality before passing to chat
      if (media.type === 'photo' || !media.type) {
        try {
          const compressed = await compressImage(validUri, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.8,
          });
          if (compressed?.uri) {
            validUri = compressed.uri;
          }
        } catch (compErr) {
          console.warn('Pre-send compression warning in CameraScreen:', compErr);
        }
      }

      const targetChat = route.params?.chat || null;
      const targetTitle = route.params?.title || null;
      const targetChatId = route.params?.chatId || chatId || targetChat?._id;

      navigation.navigate('ChatRoom', {
        chat: targetChat,
        title: targetTitle,
        chatId: targetChatId,
        capturedImage: validUri,
        caption: typeof caption === 'string' ? caption.trim() : '',
        mediaType: media.type || 'photo',
        isViewOnce: !!isViewOnce,
      });
    } catch (err) {
      console.error('Failed to send media from camera:', err);
      Alert.alert('Send Error', 'Failed to navigate and send media.');
    }
  };

  const formatTimer = (sec) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // ----------------------------------------------------
  // PREVIEW UI (Cyberpunk WhatsApp Tools & Preview)
  // ----------------------------------------------------
  if (media) {
    const activeFilterObj = FILTER_PRESETS.find((f) => f.id === selectedFilter) || FILTER_PRESETS[0];

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        {/* Media Preview Area */}
        <View style={styles.previewMediaWrap}>
          {media.type === 'photo' ? (
            <Image
              source={{ uri: media.uri }}
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ rotate: `${rotation}deg` }] },
              ]}
              resizeMode="contain"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.videoPreviewContainer]}>
              <View style={styles.videoPlayCircle}>
                <Image source={require('../assets/icons/videocam.png')} style={styles.videoPreviewIcon} />
              </View>
              <Text style={styles.videoPreviewText}>Video Ready to Send</Text>
            </View>
          )}

          {/* Color Filter Overlay */}
          {activeFilterObj.color !== 'transparent' && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: activeFilterObj.color }]}
            />
          )}

          {/* Placed Stickers Overlay */}
          {stickers.map((stk) => (
            <View key={stk.id} style={styles.stickerBadge}>
              <Text style={styles.stickerText}>{stk.emoji}</Text>
            </View>
          ))}

          {/* Text Overlay */}
          {textOverlay.length > 0 && (
            <View style={styles.textOverlayContainer}>
              <Text style={styles.textOverlayContent}>{textOverlay}</Text>
            </View>
          )}
        </View>

        {/* Top Header Tool Icons */}
        <View style={styles.previewTopBar}>
          <TouchableOpacity
            onPress={() => setMedia(null)}
            style={styles.iconCircleBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.topCloseIcon}>✕</Text>
          </TouchableOpacity>

          <View style={styles.previewToolsRow}>
            {/* WhatsApp Standard Tool 1: Crop / Rotate */}
            <TouchableOpacity
              onPress={rotatePreview}
              style={[styles.toolBtn, rotation > 0 && styles.activeToolBtn]}
              activeOpacity={0.7}
            >
              <Text style={styles.toolIconText}>⟳</Text>
            </TouchableOpacity>

            {/* WhatsApp Standard Tool 2: Emoji / Sticker */}
            <TouchableOpacity
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              style={[styles.toolBtn, showEmojiPicker && styles.activeToolBtn]}
              activeOpacity={0.7}
            >
              <Image source={require('../assets/icons/emoji.png')} style={styles.toolPngIcon} />
            </TouchableOpacity>

            {/* WhatsApp Standard Tool 3: Text 'Aa' */}
            <TouchableOpacity
              onPress={() => setIsEditingText(!isEditingText)}
              style={[styles.toolBtn, (isEditingText || textOverlay) && styles.activeToolBtn]}
              activeOpacity={0.7}
            >
              <Text style={styles.toolAaText}>Aa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inline Emoji Selector Tray */}
        {showEmojiPicker && (
          <View style={styles.emojiPickerTray}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScrollContent}>
              {EMOJI_OPTIONS.map((emoji, index) => (
                <TouchableOpacity key={index} style={styles.emojiBtn} onPress={() => addSticker(emoji)}>
                  <Text style={styles.emojiChar}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Text Input Modal / Tray when 'Aa' is active */}
        {isEditingText && (
          <View style={styles.textEditOverlay}>
            <TextInput
              style={styles.textEditInput}
              placeholder="Add text sticker..."
              placeholderTextColor={colors.gray}
              value={textOverlay}
              onChangeText={setTextOverlay}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => setIsEditingText(false)}
            />
            <TouchableOpacity style={styles.textDoneBtn} onPress={() => setIsEditingText(false)}>
              <Text style={styles.textDoneBtnLabel}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View Once Toast Notification */}
        {viewOnceToast && (
          <View style={styles.viewOnceToastPill}>
            <View style={styles.viewOnceActiveIconSmall}>
              <Text style={styles.viewOnceNumberSmall}>1</Text>
            </View>
            <Text style={styles.viewOnceToastText}>{viewOnceToast}</Text>
          </View>
        )}

        {/* Swipe Up for Filters Section */}
        <View style={styles.filtersSection}>
          <TouchableOpacity
            style={styles.swipeUpContainer}
            activeOpacity={0.8}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.chevronIcon}>{showFilters ? '⌵' : '⌃'}</Text>
            <Text style={styles.swipeUpText}>Swipe up for filters</Text>
          </TouchableOpacity>

          {showFilters && (
            <View style={styles.filtersListContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {FILTER_PRESETS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.filterItem,
                      selectedFilter === item.id && styles.filterItemActive,
                    ]}
                    onPress={() => setSelectedFilter(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.filterSwatch, { backgroundColor: item.color === 'transparent' ? colors.border : item.color }]} />
                    <Text
                      style={[
                        styles.filterName,
                        selectedFilter === item.id && styles.filterNameActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* WhatsApp Cyberpunk Caption Bar & Floating Green Send Button */}
        <View style={styles.captionBar}>
          <View style={styles.captionInputPill}>
            <TouchableOpacity onPress={openGallery} activeOpacity={0.7}>
              <Image source={require('../assets/icons/gallery.png')} style={styles.captionLeadingIcon} />
            </TouchableOpacity>

            <TextInput
              style={styles.captionTextInput}
              placeholder="Add a caption..."
              placeholderTextColor={colors.gray}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={300}
            />
          </View>

          {/* Floating Send Button */}
          <TouchableOpacity
            style={styles.floatingSendBtn}
            onPress={sendMedia}
            activeOpacity={0.85}
          >
            <Image source={require('../assets/icons/send.png')} style={styles.sendPaperPlane} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // LIVE CAMERA UI
  // ----------------------------------------------------
  if (!hasCamPermission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera not available on this device</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Camera Live Feed */}
      <Camera
        ref={setCameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        video={true}
        outputs={[photoOutput, videoOutput]}
        audio={hasMicPermission === true}
        onInitialized={handleCameraInitialized}
        onStarted={handleCameraInitialized}
        onPreviewStarted={handleCameraInitialized}
        onError={(err) => {
          console.error('CameraSession error:', err);
        }}
      />

      {/* Top Bar: Close, Flash, and Active Recording Timer */}
      <View style={styles.liveTopBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconCircleBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.topCloseIcon}>✕</Text>
        </TouchableOpacity>

        {isRecording ? (
          <View style={styles.recordingTimerBadge}>
            <View style={styles.recordingPulsingDot} />
            <Text style={styles.recordingTimerText}>{formatTimer(recordSeconds)}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {device?.hasFlash ? (
          <TouchableOpacity onPress={cycleFlash} style={styles.iconCircleBtn} activeOpacity={0.7}>
            <Text style={styles.flashIconText}>{getFlashIcon()}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      {/* Bottom Area: Shutter Controls */}
      <View style={styles.bottomSection}>
        {/* Shutter Row Controls */}
        <View style={styles.shutterControlsRow}>
          {/* Gallery Button on left */}
          <TouchableOpacity style={styles.sideControlBtn} onPress={openGallery} activeOpacity={0.7}>
            <Image source={require('../assets/icons/gallery.png')} style={styles.sideIcon} />
          </TouchableOpacity>

          {/* Main Cyberpunk Capture Button: Single Tap for Photo, Long Press & Hold for Video */}
          <View style={styles.captureButtonContainer}>
            <Pressable
              onPress={handlePress}
              onLongPress={handleLongPress}
              delayLongPress={250}
              onPressOut={handlePressOut}
              disabled={!isCameraReady || isCapturing}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.captureOuterRing,
                !isCameraReady && styles.captureOuterRingDisabled,
                isRecording && styles.captureOuterRingRecording,
                pressed && !isRecording && isCameraReady && styles.captureOuterRingPressed,
              ]}
            >
              {!isCameraReady ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View
                  style={[
                    styles.captureInnerCircle,
                    isRecording && styles.captureInnerCircleRecording,
                  ]}
                  pointerEvents="none"
                />
              )}
            </Pressable>
          </View>

          {/* Flip Camera Button on right */}
          <TouchableOpacity
            style={styles.sideControlBtn}
            onPress={() => setDevicePosition((prev) => (prev === 'back' ? 'front' : 'back'))}
            activeOpacity={0.7}
          >
            <Image source={require('../assets/icons/sync.png')} style={styles.sideIcon} />
          </TouchableOpacity>
        </View>

        {/* Cyberpunk Shutter Instruction Label */}
        <View style={styles.captureHintContainer}>
          <Text style={styles.captureHintText}>
            Tap for photo
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.darkBackground,
  },
  permissionText: {
    color: colors.gray,
    marginTop: spacing.md,
    fontSize: fontSizes.md,
  },
  errorText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },

  // Top Bar on Live Camera
  liveTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: STATUS_BAR_OFFSET,
    zIndex: 20,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19, 27, 46, 0.75)',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
  },
  topCloseIcon: {
    color: colors.white,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
  },
  flashIconText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    includeFontPadding: false,
    textAlign: 'center',
  },

  // Active Video Recording Timer Badge
  recordingTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    elevation: 4,
    shadowColor: colors.danger,
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  recordingPulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    marginRight: spacing.xs + 2,
  },
  recordingTimerText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Bottom Area
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    zIndex: 20,
  },

  // Horizontal Gallery Thumbnail Strip
  galleryStripContainer: {
    marginBottom: spacing.md,
  },
  galleryStripContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  galleryPickerTile: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  galleryTileIcon: {
    width: 22,
    height: 22,
    tintColor: colors.primary,
    marginBottom: 2,
  },
  galleryTileLabel: {
    color: colors.gray,
    fontSize: fontSizes.sm - 2,
    fontWeight: '600',
  },
  galleryThumbnailCard: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  galleryThumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoBadgeOverlay: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  videoBadgeText: {
    color: colors.white,
    fontSize: fontSizes.sm - 3,
  },

  // Shutter Row Controls
  shutterControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sideControlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(19, 27, 46, 0.75)',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideIcon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
  },

  // Main Cyberpunk Capture Button: Ring & Inner Circle
  captureButtonContainer: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  captureOuterRingPressed: {
    transform: [{ scale: 0.94 }],
    borderColor: colors.accent,
  },
  captureOuterRingRecording: {
    borderColor: colors.danger,
    shadowColor: colors.danger,
    transform: [{ scale: 1.08 }],
  },
  captureOuterRingDisabled: {
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  captureInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.white,
  },
  captureInnerCircleRecording: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  captureInnerCircleDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },

  // Shutter Instruction Label
  captureHintContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  captureHintText: {
    color: colors.gray,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // -------------------------
  // PREVIEW STYLES
  // -------------------------
  previewMediaWrap: {
    flex: 1,
    backgroundColor: colors.darkBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewContainer: {
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  videoPreviewIcon: {
    width: 36,
    height: 36,
    tintColor: colors.white,
  },
  videoPreviewText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },

  // Top Bar in Preview UI
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: STATUS_BAR_OFFSET,
    zIndex: 30,
  },
  previewToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19, 27, 46, 0.75)',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeToolBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  toolIconText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    includeFontPadding: false,
    textAlign: 'center',
  },
  toolAaText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
  },
  toolPngIcon: {
    width: 22,
    height: 22,
    tintColor: colors.white,
  },

  // Emoji Tray
  emojiPickerTray: {
    position: 'absolute',
    top: STATUS_BAR_OFFSET + 54,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    zIndex: 40,
    elevation: 6,
  },
  emojiScrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  emojiBtn: {
    padding: spacing.xs,
  },
  emojiChar: {
    fontSize: fontSizes.xxl + 2,
  },

  // Text Sticker Modal
  textEditOverlay: {
    position: 'absolute',
    top: STATUS_BAR_OFFSET + 54,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    zIndex: 40,
    elevation: 6,
  },
  textEditInput: {
    flex: 1,
    color: colors.white,
    fontSize: fontSizes.lg,
    padding: 0,
  },
  textDoneBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 14,
  },
  textDoneBtnLabel: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },

  // Placed Stickers
  stickerBadge: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  stickerText: {
    fontSize: 48,
  },
  textOverlayContainer: {
    position: 'absolute',
    top: '45%',
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  textOverlayContent: {
    color: colors.white,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
  },

  // View Once Toast
  viewOnceToastPill: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: colors.cardBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    zIndex: 50,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  viewOnceActiveIconSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  viewOnceNumberSmall: {
    color: colors.white,
    fontSize: fontSizes.sm - 1,
    fontWeight: '900',
  },
  viewOnceToastText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },

  // Swipe up for filters
  filtersSection: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  swipeUpContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chevronIcon: {
    color: colors.gray,
    fontSize: fontSizes.lg,
    lineHeight: 18,
  },
  swipeUpText: {
    color: colors.gray,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  filtersListContainer: {
    marginTop: spacing.xs,
    width: '100%',
    backgroundColor: 'rgba(11, 15, 25, 0.92)',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  filtersScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 4,
  },
  filterItem: {
    alignItems: 'center',
    padding: spacing.xs + 2,
    borderRadius: 8,
  },
  filterItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filterName: {
    color: colors.gray,
    fontSize: fontSizes.sm - 1,
    fontWeight: '500',
  },
  filterNameActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Caption Bar & Floating Send Button
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: 'transparent',
    zIndex: 35,
  },
  captionInputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    backgroundColor: colors.cardBackground,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.xs,
    marginRight: spacing.sm + 2,
  },
  captionLeadingIcon: {
    width: 20,
    height: 20,
    tintColor: colors.gray,
    marginRight: spacing.sm + 2,
  },
  captionTextInput: {
    flex: 1,
    color: colors.white,
    fontSize: fontSizes.md + 1,
    maxHeight: 90,
    padding: 0,
  },

  // Cyberpunk 'View once' (1) Toggle inside input
  viewOnceBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  viewOnceBtnInactive: {
    borderWidth: 1.5,
    borderColor: colors.gray,
    backgroundColor: 'transparent',
  },
  viewOnceBtnActive: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  viewOnceText: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
  },
  viewOnceTextInactive: {
    color: colors.gray,
  },
  viewOnceTextActive: {
    color: colors.white,
  },

  // Floating Cyberpunk Send Button
  floatingSendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sendPaperPlane: {
    width: 22,
    height: 22,
    tintColor: colors.white,
    marginLeft: 2,
  },
});

export default CameraScreen;