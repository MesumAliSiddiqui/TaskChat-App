import { useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, Keyboard, Platform, ToastAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { createSound } from 'react-native-nitro-sound';

const CANCEL_THRESHOLD = 60;
const LOCK_UP_THRESHOLD = 40;

export const useVoiceRecorder = ({
  text,
  setShowEmojiPicker,
  chatId,
  socket,
  connected,
  onSendVoiceNote,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voicePlaybackProgress, setVoicePlaybackProgress] = useState(0);
  const audioRecorderPlayer = useRef(createSound()).current;

  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReviewPlaying, setIsReviewPlaying] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedWaveform, setRecordedWaveform] = useState([10, 16, 22, 14, 18, 12]);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const isRecordingRef = useRef(false);
  const isLockedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const isSwipingRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const waveformGrowthIntervalRef = useRef(null);
  const lockTimerRef = useRef(null);
  const reviewPlayIntervalRef = useRef(null);

  const recordingPulseAnim = useRef(new Animated.Value(1)).current;
  const recordingPulseScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  const slideCancelAnim = useRef(new Animated.Value(0)).current;
  const slideLoopRef = useRef(null);

  const micDragXAnim = useRef(new Animated.Value(0)).current;
  const trashScaleAnim = useRef(new Animated.Value(0.5)).current;
  const trashOpacityAnim = useRef(new Animated.Value(0)).current;

  const startPulseAnimation = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(recordingPulseAnim, { toValue: 0.25, duration: 500, useNativeDriver: true }),
          Animated.timing(recordingPulseScaleAnim, { toValue: 0.75, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(recordingPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(recordingPulseScaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        ]),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulseAnimation = () => {
    pulseLoopRef.current?.stop();
    recordingPulseAnim.setValue(1);
    recordingPulseScaleAnim.setValue(1);
  };

  const startSlideCancelAnimation = () => {
    slideLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(slideCancelAnim, { toValue: -8, duration: 650, useNativeDriver: true }),
        Animated.timing(slideCancelAnim, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    slideLoopRef.current.start();
  };

  const stopSlideCancelAnimation = () => {
    slideLoopRef.current?.stop();
    slideCancelAnim.setValue(0);
  };

  const stopRecordingTimersAndAnims = () => {
    if (waveformGrowthIntervalRef.current) {
      clearInterval(waveformGrowthIntervalRef.current);
      waveformGrowthIntervalRef.current = null;
    }
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (reviewPlayIntervalRef.current) {
      clearInterval(reviewPlayIntervalRef.current);
      reviewPlayIntervalRef.current = null;
    }
    stopPulseAnimation();
    stopSlideCancelAnimation();
    micDragXAnim.setValue(0);

    if (socket && connected && chatId) {
      socket.emit('typing:stop', { chatId });
    }
  };

  const lockRecording = async () => {
    if (!isRecordingRef.current || isCancelledRef.current || isLockedRef.current) return;
    isLockedRef.current = true;
    setIsLocked(true);
    setIsReviewing(true);
    stopSlideCancelAnimation();
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
    } catch (e) {}
  };

  const handleStartRecording = async () => {
    if (text?.trim()) return;
    if (isRecordingRef.current) return;

    Keyboard.dismiss();
    if (setShowEmojiPicker) setShowEmojiPicker(false);

    isRecordingRef.current = true;
    isLockedRef.current = false;
    isCancelledRef.current = false;
    recordingDurationRef.current = 0;
    setRecordingDuration(0);
    setIsDiscarding(false);
    setIsRecording(true);
    setIsLocked(false);
    setIsReviewing(false);
    setIsReviewPlaying(false);
    setReviewProgress(0);
    setRecordedWaveform([10, 16, 12, 20]);

    const path = `${RNFS.CachesDirectoryPath}/voicenote.mp4`;
    const audioSet = {
      AudioEncoderAndroid: 3,
      OutputFormatAndroid: 2,
      AudioSourceAndroid: 1,
      AVEncoderAudioQualityKeyIOS: 96,
      AVNumberOfChannelsKeyIOS: 2,
      AVFormatIDKeyIOS: 'aac',
    };

    try {
      await audioRecorderPlayer.startRecorder(path, audioSet);
      audioRecorderPlayer.addRecordBackListener((e) => {
        recordingDurationRef.current = Math.floor(e.currentPosition / 1000);
        setRecordingDuration(recordingDurationRef.current);
      });
    } catch (err) {
      console.warn('Failed to start recorder:', err);
    }

    if (waveformGrowthIntervalRef.current) clearInterval(waveformGrowthIntervalRef.current);
    waveformGrowthIntervalRef.current = setInterval(() => {
      const nextH = Math.floor(Math.random() * 22) + 8;
      setRecordedWaveform((prev) => [...prev.slice(-22), nextH]);
    }, 320);

    startPulseAnimation();
    startSlideCancelAnimation();

    if (socket && connected && chatId) {
      socket.emit('typing:start', { chatId });
    }
  };

  const handleStopRecording = async () => {
    if (!isRecordingRef.current) return;
    if (isCancelledRef.current) return;

    isRecordingRef.current = false;
    
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
    } catch (e) {}

    stopRecordingTimersAndAnims();
    setIsRecording(false);
    setIsLocked(false);
    setIsReviewing(false);

    const finalDuration = Math.max(1, recordingDurationRef.current || 1);
    if (onSendVoiceNote) {
      await onSendVoiceNote(finalDuration, recordedWaveform);
    }
  };

  const handlePressOutMic = () => {
    if (!isRecordingRef.current || isCancelledRef.current) return;
    if (isLockedRef.current) return;
    if (isSwipingRef.current) return;
    handleStopRecording();
  };

  const handleCancelRecording = async () => {
    if (!isRecordingRef.current && !isReviewing) return;

    isCancelledRef.current = true;
    isRecordingRef.current = false;
    isLockedRef.current = false;
    stopRecordingTimersAndAnims();

    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      await RNFS.unlink(`${RNFS.CachesDirectoryPath}/voicenote.mp4`);
    } catch (e) {}

    setIsDiscarding(true);

    trashScaleAnim.setValue(0.6);
    trashOpacityAnim.setValue(1);
    Animated.sequence([
      Animated.spring(trashScaleAnim, { toValue: 1.25, friction: 4, useNativeDriver: true }),
      Animated.timing(trashOpacityAnim, { toValue: 0, duration: 320, delay: 180, useNativeDriver: true }),
    ]).start(() => {
      setIsDiscarding(false);
      setIsRecording(false);
      setIsLocked(false);
      setIsReviewing(false);
      setIsReviewPlaying(false);
      setReviewProgress(0);
      micDragXAnim.setValue(0);
    });

    if (Platform.OS === 'android') {
      ToastAndroid.show('Voice note cancelled', ToastAndroid.SHORT);
    }
  };

  const handleToggleReviewPlay = async () => {
    const path = `file://${RNFS.CachesDirectoryPath}/voicenote.mp4`;
    if (isReviewPlaying) {
      try {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        audioRecorderPlayer.removePlaybackEndListener();
      } catch (e) {}
      setIsReviewPlaying(false);
    } else {
      if (waveformGrowthIntervalRef.current) {
        clearInterval(waveformGrowthIntervalRef.current);
        waveformGrowthIntervalRef.current = null;
      }
      setIsReviewPlaying(true);
      try {
        await audioRecorderPlayer.startPlayer(path);
        audioRecorderPlayer.addPlayBackListener((e) => {
          const progress = Math.min(1, e.currentPosition / Math.max(1, e.duration));
          setReviewProgress(progress);
        });
        audioRecorderPlayer.addPlaybackEndListener(() => {
          audioRecorderPlayer.stopPlayer();
          audioRecorderPlayer.removePlayBackListener();
          audioRecorderPlayer.removePlaybackEndListener();
          setIsReviewPlaying(false);
          setReviewProgress(0);
        });
      } catch (err) {
        console.warn('Failed to review audio:', err);
        setIsReviewPlaying(false);
      }
    }
  };

  const handleSendLockedVoiceNote = async () => {
    if (reviewPlayIntervalRef.current) {
      clearInterval(reviewPlayIntervalRef.current);
      reviewPlayIntervalRef.current = null;
    }
    stopRecordingTimersAndAnims();

    const finalDuration = Math.max(1, recordingDurationRef.current || 1);
    if (onSendVoiceNote) {
      await onSendVoiceNote(finalDuration, recordedWaveform);
    }

    setIsRecording(false);
    setIsLocked(false);
    setIsReviewing(false);
    setIsReviewPlaying(false);
    setReviewProgress(0);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          isRecordingRef.current &&
          !isLockedRef.current &&
          (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6)
        );
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isRecordingRef.current || isCancelledRef.current || isLockedRef.current) return;

        if (gestureState.dx < 0) {
          micDragXAnim.setValue(Math.max(gestureState.dx, -120));
          if (gestureState.dx <= -CANCEL_THRESHOLD) {
            handleCancelRecording();
            return;
          }
        }

        if (gestureState.dy < -LOCK_UP_THRESHOLD) {
          lockRecording();
          micDragXAnim.setValue(0);
        }
      },
      onPanResponderRelease: () => {
        micDragXAnim.setValue(0);
        isSwipingRef.current = false;
        
        if (isRecordingRef.current && !isCancelledRef.current) {
          if (!isLockedRef.current) {
            handleStopRecording();
          }
        }
      },
      onPanResponderTerminate: () => {
        micDragXAnim.setValue(0);
        isSwipingRef.current = false;
        if (isRecordingRef.current && !isCancelledRef.current) {
          if (!isLockedRef.current) {
            handleCancelRecording();
          }
        }
      },
    })
  ).current;

  const stopVoicePlayback = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
      audioRecorderPlayer.removePlaybackEndListener();
    } catch (e) {}
    setPlayingVoiceId(null);
    setVoicePlaybackProgress(0);
  };

  const handleTogglePlayVoice = async (item) => {
    const id = (item._id || item.tempId)?.toString();
    if (!id) return;

    if (playingVoiceId === id) {
      await stopVoicePlayback();
      return;
    }

    await stopVoicePlayback();
    setPlayingVoiceId(id);
    setVoicePlaybackProgress(0);

    const url = item.attachmentUrl || item.image;
    if (!url) return;

    try {
      let playUrl = url;
      if (url.startsWith('data:audio')) {
        const base64Data = url.split(',')[1];
        playUrl = `${RNFS.CachesDirectoryPath}/temp_play_${id}.mp4`;
        await RNFS.writeFile(playUrl, base64Data, 'base64');
        playUrl = `file://${playUrl}`;
      }

      await audioRecorderPlayer.startPlayer(playUrl);
      audioRecorderPlayer.addPlayBackListener((e) => {
        const progress = Math.min(1, e.currentPosition / Math.max(1, e.duration));
        setVoicePlaybackProgress(progress);
      });
      audioRecorderPlayer.addPlaybackEndListener(() => {
        stopVoicePlayback();
      });
    } catch (err) {
      console.warn('Failed to play audio:', err);
      stopVoicePlayback();
    }
  };

  useEffect(() => {
    return () => {
      audioRecorderPlayer.stopPlayer().catch(()=>{});
      if (waveformGrowthIntervalRef.current) clearInterval(waveformGrowthIntervalRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (reviewPlayIntervalRef.current) clearInterval(reviewPlayIntervalRef.current);
      stopPulseAnimation();
      stopSlideCancelAnimation();
    };
  }, []);

  return {
    isRecording,
    isLocked,
    isReviewing,
    isReviewPlaying,
    reviewProgress,
    recordingDuration,
    recordedWaveform,
    isDiscarding,
    playingVoiceId,
    voicePlaybackProgress,
    recordingPulseAnim,
    recordingPulseScaleAnim,
    slideCancelAnim,
    micDragXAnim,
    trashScaleAnim,
    trashOpacityAnim,
    panResponder,
    handleStartRecording,
    handlePressOutMic,
    handleCancelRecording,
    handleToggleReviewPlay,
    handleSendLockedVoiceNote,
    handleTogglePlayVoice,
    stopVoicePlayback,
  };
};
