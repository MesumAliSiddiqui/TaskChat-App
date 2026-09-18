import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import RNCallKeep from 'react-native-callkeep';
import notifee, { AndroidCategory, AndroidImportance } from '@notifee/react-native';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const requestCallPermissions = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'TaskChat requires microphone access for audio calls.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[CallContext] Permission request error:', err);
    return false;
  }
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // Call state machine: 'idle' | 'ringing_outgoing' | 'ringing_incoming' | 'connected' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
  const [activeCall, setActiveCall] = useState(null); // { callId, chatId, callerId, calleeId, callerName, callerAvatar, otherUser }

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoCamOff, setIsVideoCamOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const candidateQueueRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const activeCallRef = useRef(null);
  activeCallRef.current = activeCall;

  // Trigger RNCallKeep setup ONLY after the user successfully logs in
  useEffect(() => {
    if (user) {
      const options = {
        ios: {
          appName: 'TaskChat',
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'TaskChat needs to access your phone accounts to receive and display full-screen calls.',
          cancelButton: 'Cancel',
          okButton: 'OK',
          imageName: 'phone_account_icon',
        }
      };

      RNCallKeep.setup(options)
        .then(accepted => console.log('[CallContext] RNCallKeep setup complete, accepted:', accepted))
        .catch(err => console.warn('[CallContext] RNCallKeep setup error:', err));
    }
  }, [user]);

  // Duration timer for ongoing connected call
  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Clean up all media tracks and WebRTC peer connection
  const cleanupCall = useCallback(() => {
    console.log('[CallContext] Cleaning up media streams and peer connection...');

    // Clear the Notifee incoming call alert
    notifee.cancelNotification('incoming_call');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) { }
      });
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) { }
      });
      remoteStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) { }
      pcRef.current = null;
    }

    candidateQueueRef.current = [];
    pendingOfferRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoCamOff(false);
    setIsSpeaker(false);
    setCallDuration(0);
  }, []);

  const transitionToEnded = useCallback(
    (reason) => {
      console.log(`[CallContext] Call ended: ${reason || 'normal'}`);
      setCallState('ended');
      cleanupCall();

      // Stops the continuous native Android ringing instantly
      RNCallKeep.endAllCalls();

      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
      }, 800);
    },
    [cleanupCall]
  );

  // Initialize RTCPeerConnection instance and configure event listeners
  const createPeerConnection = useCallback(
    (targetUserId, currentCallId) => {
      console.log('[CallContext] Creating RTCPeerConnection...');
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            callId: currentCallId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Standard W3C ontrack
      pc.ontrack = (event) => {
        console.log('[CallContext] ontrack received remote track');
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      // Legacy fallback onaddstream
      pc.onaddstream = (event) => {
        console.log('[CallContext] onaddstream received remote stream');
        if (event.stream) {
          remoteStreamRef.current = event.stream;
          setRemoteStream(event.stream);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[CallContext] ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState('connected');
        } else if (
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'closed'
        ) {
          transitionToEnded(pc.iceConnectionState);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[CallContext] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          transitionToEnded(pc.connectionState);
        }
      };

      return pc;
    },
    [socket, transitionToEnded]
  );

  // Drain buffered ICE candidates after setRemoteDescription
  const flushCandidateQueue = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription) return;
    const queued = [...candidateQueueRef.current];
    candidateQueueRef.current = [];
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[CallContext] Error adding queued ICE candidate:', err);
      }
    }
  }, []);

  // Place an outgoing audio call (1:1 or Group)
  const startCall = useCallback(
    async (chatId, calleeId, type = 'audio', otherUser = null, isGroup = false, groupInfo = null) => {
      try {
        if (callState !== 'idle') {
          console.warn('[CallContext] Cannot start call: already in state', callState);
          return;
        }

        const hasPermission = await requestCallPermissions();
        if (!hasPermission) {
          Alert.alert(
            'Permission Denied',
            'Microphone access is required to place audio calls.'
          );
          return;
        }

        setCallType('audio');
        setCallState('ringing_outgoing');

        const callMeta = {
          chatId,
          calleeId,
          callerId: user?._id || user?.id,
          type: 'audio',
          isGroup: Boolean(isGroup),
          groupName: groupInfo?.name || '',
          otherUser: isGroup
            ? {
              _id: chatId,
              name: groupInfo?.name || 'Group Voice Call',
              avatar: groupInfo?.avatar,
            }
            : otherUser,
        };
        setActiveCall(callMeta);

        // 1. Capture local audio media stream (video always false)
        const streamConstraints = {
          audio: true,
          video: false,
        };

        const stream = await mediaDevices.getUserMedia(streamConstraints);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // 2. Emit call:invite to server to notify recipient(s) and create call record
        socket?.emit(
          'call:invite',
          {
            chatId,
            calleeId,
            callType: 'audio',
            isGroup: Boolean(isGroup),
            groupName: groupInfo?.name || '',
          },
          async (response) => {
            if (response?.error) {
              console.warn('[CallContext] call:invite error:', response.error);
              Alert.alert('Call Failed', response.error);
              transitionToEnded('invite-failed');
              return;
            }

            const currentCallId = response?.callId;
            setActiveCall((prev) => ({ ...prev, callId: currentCallId }));

            if (!isGroup && calleeId) {
              // 3. Create WebRTC Peer Connection and attach local tracks for 1:1 call
              const pc = createPeerConnection(calleeId, currentCallId);
              stream.getTracks().forEach((track) => {
                if (pc.addTrack) {
                  pc.addTrack(track, stream);
                }
              });
              if (pc.addStream) {
                pc.addStream(stream);
              }

              // 4. Generate and send WebRTC SDP offer
              try {
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: false,
                });
                await pc.setLocalDescription(offer);

                socket.emit('call:offer', {
                  callId: currentCallId,
                  targetUserId: calleeId,
                  sdp: offer,
                });
              } catch (offerErr) {
                console.error('[CallContext] Error creating SDP offer:', offerErr);
                transitionToEnded('offer-error');
              }
            }
          }
        );
      } catch (err) {
        console.error('[CallContext] Error in startCall:', err);
        Alert.alert('Call Error', err.message || 'Could not initiate call');
        transitionToEnded('start-call-exception');
      }
    },
    [callState, createPeerConnection, socket, user, transitionToEnded]
  );

  // Answer an incoming call
  const answerCall = useCallback(async () => {
    try {
      if (callState !== 'ringing_incoming' || !activeCallRef.current) {
        console.warn('[CallContext] Cannot answer: not ringing_incoming');
        return;
      }

      const active = activeCallRef.current;

      const hasPermission = await requestCallPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Microphone access is required to answer this call.'
        );
        declineCall();
        return;
      }

      // 1. Capture local audio media stream (video always false)
      const streamConstraints = {
        audio: true,
        video: false,
      };

      const stream = await mediaDevices.getUserMedia(streamConstraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Clear the Notifee notification because the call has been answered
      notifee.cancelNotification('incoming_call');

      if (active.callerId) {
        // 2. Create WebRTC Peer Connection
        const pc = createPeerConnection(active.callerId, active.callId);
        stream.getTracks().forEach((track) => {
          if (pc.addTrack) {
            pc.addTrack(track, stream);
          }
        });
        if (pc.addStream) {
          pc.addStream(stream);
        }

        // 3. Set remote SDP offer if already received
        if (pendingOfferRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
          await flushCandidateQueue(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket?.emit('call:answer', {
            callId: active.callId,
            targetUserId: active.callerId,
            sdp: answer,
          });

          setCallState('connected');
        } else {
          console.log('[CallContext] Pending offer not yet received; waiting for call:offer event...');
          socket?.emit('call:answer', {
            callId: active.callId,
            targetUserId: active.callerId,
          });
          setCallState('connected');
        }
      } else {
        setCallState('connected');
      }
    } catch (err) {
      console.error('[CallContext] Error in answerCall:', err);
      transitionToEnded('answer-call-exception');
    }
  }, [callState, createPeerConnection, declineCall, flushCandidateQueue, socket, transitionToEnded]);

  // Decline an incoming call
  const declineCall = useCallback(() => {
    const active = activeCallRef.current;
    if (active && socket) {
      socket.emit('call:decline', {
        callId: active.callId,
        targetUserId: active.callerId,
      });
    }
    transitionToEnded('declined');
  }, [socket, transitionToEnded]);

  // Terminate an active or outgoing call
  const endCall = useCallback(() => {
    const active = activeCallRef.current;
    if (active && socket) {
      const myId = user?._id?.toString() || user?.id?.toString();
      const targetUserId =
        active.callerId?.toString() === myId ? active.calleeId : active.callerId;

      socket.emit('call:end', {
        callId: active.callId,
        targetUserId,
      });
    }
    transitionToEnded('hangup');
  }, [socket, user, transitionToEnded]);

  // Audio mute toggle
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Video camera on/off toggle
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoCamOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Switch front/rear camera
  const switchCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack._switchCamera === 'function') {
        videoTrack._switchCamera();
      }
    }
  }, []);

  // Speakerphone toggle
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((prev) => !prev);
  }, []);

  // -------------------------------------------------------------
  // RNCallKeep Event Listeners
  // -------------------------------------------------------------
  useEffect(() => {
    const handleAnswerCall = ({ callUUID }) => {
      // Pull the React Native app over the native Android dialer
      if (Platform.OS === 'android') {
        RNCallKeep.backToForeground();
      }
      answerCall();
    };

    const handleEndCall = ({ callUUID }) => {
      if (callState === 'ringing_incoming') {
        declineCall();
      } else {
        endCall();
      }
    };

    RNCallKeep.addEventListener('answerCall', handleAnswerCall);
    RNCallKeep.addEventListener('endCall', handleEndCall);

    return () => {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
    };
  }, [answerCall, declineCall, endCall, callState]);

  // -------------------------------------------------------------
  // Socket Signaling Event Listeners
  // -------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    // Received incoming call from another user
    const handleIncomingCall = async (data) => {
      console.log('[CallContext] Received call:incoming:', data);
      if (callState !== 'idle') {
        // Already busy on another call
        socket.emit('call:busy', {
          callId: data.callId,
          targetUserId: data.callerId,
        });
        return;
      }

      setCallType('audio');
      setActiveCall({
        callId: data.callId,
        chatId: data.chatId,
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: 'audio',
        isGroup: Boolean(data.isGroup),
        groupName: data.groupName || '',
        otherUser: {
          _id: data.callerId,
          name: data.isGroup ? data.groupName || 'Group Voice Call' : data.callerName,
          avatar: data.callerAvatar,
        },
      });
      setCallState('ringing_incoming');

      // Wakes up phone and shows YOUR custom screen instead of Android OS
      try {
        const channelId = await notifee.createChannel({
          id: 'call_channel',
          name: 'Incoming Calls',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          id: 'incoming_call',
          title: data.callerName || data.groupName || 'Incoming Call',
          body: 'Incoming Voice Call...',
          android: {
            channelId,
            category: AndroidCategory.CALL, // Tells Android this is a call
            importance: AndroidImportance.HIGH,
            ongoing: true, // Keeps notification alive until answered/declined
            autoCancel: false,
            fullScreenAction: {
              id: 'default', // Forces the app to open automatically
            },
          }
        });
      } catch (err) {
        console.warn('[CallContext] Notifee display error:', err);
      }
    };

    // Received WebRTC SDP offer
    const handleCallOffer = async ({ callId, sdp, senderId }) => {
      console.log('[CallContext] Received call:offer from', senderId);
      pendingOfferRef.current = sdp;

      const pc = pcRef.current;
      if (pc && callState === 'connected') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushCandidateQueue(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', {
            callId,
            targetUserId: senderId,
            sdp: answer,
          });
        } catch (e) {
          console.error('[CallContext] Error handling incoming offer:', e);
        }
      }
    };

    // Received WebRTC SDP answer from callee
    const handleCallAnswer = async ({ sdp, answererId }) => {
      console.log('[CallContext] Received call:answer from', answererId);
      const pc = pcRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushCandidateQueue(pc);
          setCallState('connected');
        } catch (e) {
          console.error('[CallContext] Error setting remote answer:', e);
        }
      }
    };

    // Received WebRTC ICE candidate
    const handleIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[CallContext] Error adding remote candidate:', e);
        }
      } else {
        candidateQueueRef.current.push(candidate);
      }
    };

    // Callee declined call
    const handleCallDecline = () => {
      console.log('[CallContext] Counterparty declined the call');
      Alert.alert('Call Declined', 'User declined your call.');
      transitionToEnded('declined-by-peer');
    };

    // Callee is busy on another call
    const handleCallBusy = () => {
      console.log('[CallContext] Counterparty is busy');
      Alert.alert('User Busy', 'User is currently in another call.');
      transitionToEnded('peer-busy');
    };

    // Call ended by peer
    const handleCallEnd = ({ reason }) => {
      console.log('[CallContext] Call ended by peer:', reason);
      transitionToEnded(reason || 'ended-by-peer');
    };

    // Call timed out without answer (35s)
    const handleCallMissed = ({ reason }) => {
      console.log('[CallContext] Call missed / timed out:', reason);
      transitionToEnded('missed');
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:decline', handleCallDecline);
    socket.on('call:busy', handleCallBusy);
    socket.on('call:end', handleCallEnd);
    socket.on('call:missed', handleCallMissed);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:decline', handleCallDecline);
      socket.off('call:busy', handleCallBusy);
      socket.off('call:end', handleCallEnd);
      socket.off('call:missed', handleCallMissed);
    };
  }, [socket, callState, flushCandidateQueue, transitionToEnded]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        activeCall,
        localStream,
        remoteStream,
        isMuted,
        isVideoCamOff,
        isSpeaker,
        callDuration,
        startCall,
        answerCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        switchCamera,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
export default CallContext;