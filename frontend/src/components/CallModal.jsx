import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

// Enhanced ICE server configuration with backup servers
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      credential: 'openrelayproject',
      username: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      credential: 'openrelayproject',
      username: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      credential: 'openrelayproject',
      username: 'openrelayproject'
    },
    // Backup TURN servers
    {
      urls: 'turn:relay1.expressturn.com:3478',
      credential: 'ef5x8K7zZ5',
      username: '1743098200'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

export default function CallModal({
  isVideo,
  onClose,
  onAccept,
  otherUserId,
  otherUserName,
  otherUserPhoto,
  currentUserId,
  isIncoming,
  socket,
  callStatus: initialCallStatus
}) {
  const [callStatus, setCallStatus] = useState(initialCallStatus || (isIncoming ? 'ringing' : 'calling'));
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(isVideo);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [audioLevels, setAudioLevels] = useState({ local: 0, remote: 0 });
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [callQuality, setCallQuality] = useState('good');
  const [isConnectionStable, setIsConnectionStable] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isClosingRef = useRef(false);
  const hasSetupConnection = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Initialize audio monitoring for sound detection
  const initAudioMonitoring = useCallback((stream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyserRef.current = analyser;
      
      // Monitor local audio levels
      const checkAudioLevel = () => {
        if (!analyserRef.current || isClosingRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevels(prev => ({ ...prev, local: average }));
        
        if (!isClosingRef.current) {
          requestAnimationFrame(checkAudioLevel);
        }
      };
      
      checkAudioLevel();
    } catch (err) {
      console.error('Audio monitoring initialization failed:', err);
    }
  }, []);

  // Monitor remote audio reception
  const initRemoteAudioMonitoring = useCallback((stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      let lastAudioTime = Date.now();
      const checkRemoteAudio = () => {
        if (isClosingRef.current) return;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevels(prev => ({ ...prev, remote: average }));
        
        if (average > 10) {
          lastAudioTime = Date.now();
          setIsReceivingAudio(true);
        } else if (Date.now() - lastAudioTime > 2000) {
          setIsReceivingAudio(false);
        }
        
        if (!isClosingRef.current) {
          requestAnimationFrame(checkRemoteAudio);
        }
      };
      
      checkRemoteAudio();
    } catch (err) {
      console.error('Remote audio monitoring failed:', err);
    }
  }, []);

  // Monitor connection quality
  const monitorConnectionQuality = useCallback(() => {
    if (!peerConnectionRef.current) return;
    
    const interval = setInterval(async () => {
      if (isClosingRef.current) {
        clearInterval(interval);
        return;
      }
      
      try {
        const stats = await peerConnectionRef.current.getStats();
        let packetsLost = 0;
        let totalPackets = 0;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0;
            totalPackets = (report.packetsReceived || 0) + (report.packetsLost || 0);
          }
        });
        
        const lossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
        
        if (lossRate < 1) setCallQuality('excellent');
        else if (lossRate < 5) setCallQuality('good');
        else if (lossRate < 10) setCallQuality('fair');
        else setCallQuality('poor');
        
        setIsConnectionStable(lossRate < 10);
      } catch (err) {
        console.error('Stats monitoring error:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup function
  const cleanupMedia = useCallback(() => {
    console.log('🧹 Cleaning up media...');
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`⏹️ Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('🔌 Peer connection closed');
    }
    
    // Clear video elements
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Clear pending candidates
    pendingCandidatesRef.current = [];
    hasSetupConnection.current = false;
    analyserRef.current = null;
  }, []);

  // Cleanup and close with call log saving
  const cleanupAndClose = useCallback(() => {
    if (isClosingRef.current) return;
    console.log('🔚 Cleanup and close triggered');
    isClosingRef.current = true;
    
    // Save call log before cleaning up
    if (callDuration > 0 && socket) {
      console.log('💾 Saving call log:', { duration: callDuration, type: isVideo ? 'video' : 'voice' });
      socket.emit('save-call-log', {
        callerId: isIncoming ? Number(otherUserId) : Number(currentUserId),
        receiverId: isIncoming ? Number(currentUserId) : Number(otherUserId),
        callType: isVideo ? 'video' : 'voice',
        duration: callDuration,
        status: callDuration > 0 ? 'completed' : 'missed',
        startedAt: callStartTimeRef.current?.toISOString() || new Date().toISOString()
      });
    }
    
    cleanupMedia();
    
    if (onClose) {
      onClose();
    }
  }, [callDuration, socket, isIncoming, otherUserId, currentUserId, isVideo, onClose, cleanupMedia]);

  // Start call timer
  const startCallTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    callStartTimeRef.current = new Date();
    timerRef.current = setInterval(() => {
      if (!isClosingRef.current) {
        setCallDuration(prev => prev + 1);
      }
    }, 1000);
  }, []);

  // Process pending ICE candidates
  const processPendingCandidates = useCallback(async () => {
    console.log(`📥 Processing ${pendingCandidatesRef.current.length} pending ICE candidates`);
    
    while (pendingCandidatesRef.current.length > 0) {
      const candidate = pendingCandidatesRef.current.shift();
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('✅ Added pending ICE candidate');
        }
      } catch (err) {
        console.error('Error adding pending ICE candidate:', err);
      }
    }
  }, []);

  // Get media stream
  const getMediaStream = async () => {
    console.log('🎥 Requesting media stream...');
    
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1
      },
      video: isVideo ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: isFrontCamera ? 'user' : 'environment',
        frameRate: { ideal: 30 }
      } : false
    };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream obtained successfully');
      return stream;
    } catch (err) {
      console.error('Failed to get media stream:', err);
      
      if (isVideo) {
        console.log('🔄 Video failed, trying audio only...');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false 
          });
          setIsCameraOn(false);
          return audioStream;
        } catch (audioErr) {
          console.error('Audio also failed:', audioErr);
          throw new Error('Could not access camera or microphone. Please check permissions.');
        }
      }
      throw err;
    }
  };

  // Setup peer connection
  const setupPeerConnection = async (stream) => {
    console.log('🔧 Setting up peer connection...');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;
    
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`➕ Adding ${track.kind} track to peer connection`);
        pc.addTrack(track, stream);
      });
    }
    
    pc.ontrack = (event) => {
      console.log('📥 Received remote track:', event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        if (event.track.kind === 'audio') {
          initRemoteAudioMonitoring(event.streams[0]);
        }
      }
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 New ICE candidate generated');
        socket.emit('call-signal', {
          to: otherUserId,
          from: currentUserId,
          signal: event.candidate
        });
      } else {
        console.log('✅ All ICE candidates generated');
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('🌐 ICE connection state:', state);
      setConnectionState(state);
      
      switch (state) {
        case 'connected':
        case 'completed':
          console.log('✅ Call connected!');
          setCallStatus('connected');
          if (!timerRef.current) {
            startCallTimer();
            monitorConnectionQuality();
          }
          break;
        case 'failed':
          console.error('❌ ICE connection failed');
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`🔄 Retrying connection (attempt ${retryCountRef.current})...`);
            restartConnection();
          } else {
            setError('Connection failed after multiple attempts');
            setTimeout(cleanupAndClose, 2000);
          }
          break;
        case 'disconnected':
          console.log('⚠️ ICE connection disconnected');
          // Give it time to reconnect
          setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              setError('Connection lost');
              setTimeout(cleanupAndClose, 2000);
            }
          }, 5000);
          break;
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        setError('Connection failed');
        setTimeout(cleanupAndClose, 2000);
      }
    };
    
    return pc;
  };

  // Restart connection on failure
  const restartConnection = async () => {
    try {
      console.log('🔄 Restarting connection...');
      cleanupMedia();
      isClosingRef.current = false; // Reset closing flag for retry
      await startCall();
    } catch (err) {
      console.error('Failed to restart connection:', err);
      setError('Failed to reconnect');
      setTimeout(cleanupAndClose, 2000);
    }
  };

  // Start call
  const startCall = async () => {
    if (hasSetupConnection.current) {
      console.log('Call already setup, skipping');
      return;
    }
    
    try {
      console.log('📞 Starting call setup...');
      setCallStatus('calling');
      
      // Get media stream
      const stream = await getMediaStream();
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('📹 Local video stream set');
      }
      
      initAudioMonitoring(stream);
      
      // Create peer connection
      await setupPeerConnection(stream);
      
      // Create and send offer
      console.log('📤 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('📤 Local description set (offer)');
      
      // Send offer to other user
      socket.emit('call-signal', {
        to: otherUserId,
        from: currentUserId,
        signal: offer
      });
      
      console.log('📤 Offer sent to:', otherUserId);
      hasSetupConnection.current = true;
      
    } catch (err) {
      console.error('❌ Failed to start call:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
    }
  };

  // Handle socket connectivity
  useEffect(() => {
    if (!socket) {
      console.error('❌ No socket provided to CallModal');
      setError('Connection unavailable');
      return;
    }

    console.log('🎥 CallModal mounted:', {
      socketId: socket.id,
      socketConnected: socket.connected,
      isIncoming,
      otherUserId,
      currentUserId,
      isVideo
    });

    const handleConnect = () => {
      console.log('🔄 Socket connected in CallModal');
      retryCountRef.current = 0;
      
      // Emit user online to ensure proper state
      socket.emit('user-online', currentUserId);
      
      if (!isIncoming && !hasSetupConnection.current) {
        console.log('🚀 Starting outgoing call after connection');
        setTimeout(() => startCall(), 500);
      }
    };

    const handleDisconnect = (reason) => {
      console.log('⚠️ Socket disconnected during call:', reason);
      setConnectionState('disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // If socket is already connected, start call setup
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, isIncoming, currentUserId]);

  // Main call signaling setup
  useEffect(() => {
    if (!socket) return;

    console.log('📡 Setting up call signaling handlers');

    const onSignal = async ({ signal, from }) => {
      if (Number(from) !== Number(otherUserId)) {
        console.log('Signal from wrong user, ignoring:', from);
        return;
      }
      
      if (isClosingRef.current) {
        console.log('Ignoring signal - call is closing');
        return;
      }
      
      console.log('📡 Received signal:', {
        type: signal?.type || 'candidate',
        from,
        hasPeerConnection: !!peerConnectionRef.current
      });

      try {
        // Handle offer from caller
        if (signal.type === 'offer') {
          console.log('📞 Received offer, creating answer...');
          
          // Get media stream if not already done
          if (!localStreamRef.current) {
            const stream = await getMediaStream();
            localStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
            initAudioMonitoring(stream);
          }
          
          // Create peer connection if needed
          if (!peerConnectionRef.current) {
            await setupPeerConnection(localStreamRef.current);
          }
          
          // Set remote description (the offer)
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
          
          // Create and send answer
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          console.log('📤 Sending answer to:', otherUserId);
          socket.emit('call-signal', {
            to: otherUserId,
            from: currentUserId,
            signal: answer
          });
          
          // Process any pending ICE candidates
          await processPendingCandidates();
          hasSetupConnection.current = true;
          
        } 
        // Handle answer from callee
        else if (signal.type === 'answer') {
          console.log('📞 Received answer, completing connection...');
          
          if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(signal)
            );
            await processPendingCandidates();
          }
          
        } 
        // Handle ICE candidate
        else if (signal.candidate) {
          console.log('🧊 Received ICE candidate');
          
          try {
            const iceCandidate = new RTCIceCandidate(signal);
            
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
              await peerConnectionRef.current.addIceCandidate(iceCandidate);
              console.log('✅ ICE candidate added successfully');
            } else {
              console.log('📥 Queuing ICE candidate - remote description not set yet');
              pendingCandidatesRef.current.push(signal);
            }
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      } catch (err) {
        console.error('Signal handling error:', err);
        setError('Connection error occurred');
      }
    };

    const onAccepted = ({ from }) => {
      const fromNum = Number(from);
      const otherNum = Number(otherUserId);
      
      console.log('✅ Call accepted:', { from: fromNum, otherUserId: otherNum, match: fromNum === otherNum });
      
      if (fromNum === otherNum) {
        setCallStatus('connected');
        if (!timerRef.current) {
          startCallTimer();
          monitorConnectionQuality();
        }
        toast.success('Call connected!');
      }
    };

    const onRejected = ({ from, reason }) => {
      const fromNum = Number(from);
      const otherNum = Number(otherUserId);
      
      console.log('❌ Call rejected:', { from: fromNum, otherUserId: otherNum });
      
      if (fromNum === otherNum) {
        setError(reason || 'Call declined');
        setTimeout(cleanupAndClose, 1500);
      }
    };

    const onEnded = ({ from }) => {
      const fromNum = Number(from);
      const otherNum = Number(otherUserId);
      const currentNum = Number(currentUserId);
      
      console.log('🔴 Call ended by:', { from: fromNum, otherUserId: otherNum });
      
      if (fromNum === otherNum || fromNum === currentNum) {
        cleanupAndClose();
      }
    };

    const onError = ({ message, code }) => {
      console.error('❌ Call error:', { message, code });
      setError(message);
      setTimeout(cleanupAndClose, 2000);
    };

    // Register all event listeners
    socket.on('call-signal', onSignal);
    socket.on('call-accepted', onAccepted);
    socket.on('call-rejected', onRejected);
    socket.on('call-ended', onEnded);
    socket.on('call-error', onError);

    return () => {
      console.log('🧹 Cleaning up call signaling handlers');
      
      // Remove all event listeners
      socket.off('call-signal', onSignal);
      socket.off('call-accepted', onAccepted);
      socket.off('call-rejected', onRejected);
      socket.off('call-ended', onEnded);
      socket.off('call-error', onError);
    };
  }, [socket, otherUserId, currentUserId, isVideo, isIncoming, startCallTimer, monitorConnectionQuality, processPendingCandidates, cleanupAndClose, initAudioMonitoring, initRemoteAudioMonitoring]);

  // Call control handlers
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`🎤 Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
      }
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const newState = !prev;
      if (remoteVideoRef.current) {
        // When speaker is ON, we want to HEAR audio (not muted)
        // When speaker is OFF, we mute the audio
        remoteVideoRef.current.muted = !newState;
      }
      return newState;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        console.log(`📹 Camera ${videoTrack.enabled ? 'on' : 'off'}`);
      }
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    
    try {
      // Stop current video tracks
      localStreamRef.current.getVideoTracks().forEach(track => track.stop());
      
      // Toggle camera facing mode
      setIsFrontCamera(prev => !prev);
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: !isFrontCamera ? 'user' : 'environment'
        }
      });
      
      // Replace video track in peer connection
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = peerConnectionRef.current
        ?.getSenders()
        ?.find(s => s.track?.kind === 'video');
      
      if (sender && newVideoTrack) {
        await sender.replaceTrack(newVideoTrack);
      }
      
      // Update local stream
      const oldStream = localStreamRef.current;
      const audioTrack = oldStream.getAudioTracks()[0];
      
      // Create new stream with new video and old audio
      const combinedStream = new MediaStream([newVideoTrack, audioTrack].filter(Boolean));
      localStreamRef.current = combinedStream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = combinedStream;
      }
      
      console.log('📹 Camera switched');
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  }, [isFrontCamera]);

  const handleEndCall = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔴 Ending call...', { otherUserId, currentUserId, socketConnected: socket?.connected });
    
    if (isClosingRef.current) {
      console.log('Already closing, ignoring');
      return;
    }
    
    // Set closing flag BEFORE emitting to prevent race conditions
    isClosingRef.current = true;
    
    // Emit end-call to server
    if (socket && socket.connected) {
      socket.emit('end-call', {
        to: Number(otherUserId),
        from: Number(currentUserId)
      });
      console.log('📤 End call signal sent');
    }
    
    // Save call log and clean up
    cleanupAndClose();
  }, [socket, otherUserId, currentUserId, cleanupAndClose]);

  // Format duration for call timer
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Accept incoming call
  const acceptIncomingCall = useCallback(async () => {
    try {
      console.log('✅ Accepting incoming call...');
      
      // Emit accept event
      socket.emit('accept-call', {
        to: otherUserId,
        from: currentUserId
      });
      
      // Get media stream if not already done
      if (!localStreamRef.current) {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        initAudioMonitoring(stream);
        
        // Setup peer connection if not done
        if (!peerConnectionRef.current) {
          await setupPeerConnection(stream);
        } else {
          // Add tracks to existing connection
          stream.getTracks().forEach(track => {
            if (peerConnectionRef.current) {
              peerConnectionRef.current.addTrack(track, stream);
            }
          });
        }
      }
      
      setCallStatus('connected');
      startCallTimer();
      monitorConnectionQuality();
      
      if (onAccept) onAccept();
      
    } catch (err) {
      console.error('Failed to accept call:', err);
      setError('Failed to accept call');
    }
  }, [socket, otherUserId, currentUserId, onAccept, initAudioMonitoring, startCallTimer, monitorConnectionQuality]);

  // Early return if no socket
  if (!socket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Connection unavailable</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="w-full h-full relative max-w-lg mx-auto">
        {/* Main call interface */}
        <div className="h-full flex flex-col">
          {/* Remote video (full screen for video calls) */}
          {isVideo && callStatus === 'connected' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              poster="/video-placeholder.jpg"
            />
          )}
          
          {/* Call info header */}
          <div className="relative z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {otherUserPhoto ? (
                  <img src={otherUserPhoto} alt={otherUserName} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">{otherUserName?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                )}
                <div>
                  <h2 className="text-white font-semibold">{otherUserName || 'Unknown User'}</h2>
                  <div className="flex items-center gap-2">
                    {callStatus === 'connected' && (
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        {formatDuration(callDuration)}
                      </span>
                    )}
                    {error && (
                      <span className="text-red-400 text-sm">{error}</span>
                    )}
                    {!error && callStatus === 'calling' && (
                      <span className="text-gray-400 text-sm">Calling...</span>
                    )}
                    {!error && callStatus === 'ringing' && (
                      <span className="text-purple-400 text-sm animate-pulse">Ringing...</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Audio reception indicator */}
              <div className="flex items-center gap-2">
                {callStatus === 'connected' && (
                  <div 
                    className={`w-3 h-3 rounded-full ${isReceivingAudio ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} 
                    title={isReceivingAudio ? 'Receiving audio' : 'No audio detected'} 
                  />
                )}
                {callQuality !== 'excellent' && callStatus === 'connected' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    callQuality === 'good' ? 'bg-green-500/20 text-green-400' :
                    callQuality === 'fair' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {callQuality}
                  </span>
                )}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white/80 hover:text-white ml-2"
                >
                  {isMinimized ? '□' : '_'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Local video preview */}
          {isVideo && callStatus === 'connected' && !isMinimized && (
            <div className="absolute top-24 right-4 w-32 h-48 rounded-xl overflow-hidden border-2 border-white/30 z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Audio call avatar */}
          {!isVideo && callStatus === 'connected' && !isMinimized && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                  {otherUserPhoto ? (
                    <img src={otherUserPhoto} alt={otherUserName} className="w-28 h-28 rounded-full" />
                  ) : (
                    <span className="text-5xl font-bold text-white">{otherUserName?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex justify-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-purple-500 rounded-full transition-all duration-300"
                        style={{
                          height: `${Math.min(20, Math.max(4, audioLevels.local / 5))}px`,
                          animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Call controls */}
          {!isMinimized && (
            <div className="relative z-20 mt-auto mb-8 px-6">
              <div className="flex justify-center gap-4">
                {/* Mute button */}
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
                    isMuted ? 'bg-red-500/80 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <span className="text-2xl">{isMuted ? '🔇' : '🎤'}</span>
                </button>
                
                {/* Speaker button */}
                <button
                  onClick={toggleSpeaker}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
                    isSpeakerOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/80 hover:bg-red-600'
                  }`}
                  title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
                >
                  <span className="text-2xl">{isSpeakerOn ? '🔊' : '🔇'}</span>
                </button>
                
                {/* Camera toggle (video calls only) */}
                {isVideo && (
                  <button
                    onClick={toggleCamera}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
                      isCameraOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/80 hover:bg-red-600'
                    }`}
                    title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    <span className="text-2xl">{isCameraOn ? '📹' : '📷'}</span>
                  </button>
                )}
                
                {/* Switch camera (video calls only) */}
                {isVideo && isCameraOn && (
                  <button
                    onClick={switchCamera}
                    className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all duration-300 transform hover:scale-105"
                    title="Switch Camera"
                  >
                    <span className="text-2xl">🔄</span>
                  </button>
                )}
              </div>
              
              {/* End call button */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-300 shadow-lg transform hover:scale-110"
                  title="End Call"
                >
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.924 2.617a.997.997 0 00-.215-.322l-.004-.004A.997.997 0 0017 2h-4a1 1 0 100 2h1.586l-3.293 3.293a1 1 0 001.414 1.414L16 5.414V7a1 1 0 102 0V3a.997.997 0 00-.076-.383z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Incoming call overlay */}
        {callStatus === 'ringing' && isIncoming && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                {otherUserPhoto ? (
                  <img src={otherUserPhoto} alt={otherUserName} className="w-20 h-20 rounded-full" />
                ) : (
                  <span className="text-4xl font-bold text-white">{otherUserName?.[0]?.toUpperCase() || '?'}</span>
                )}
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">{otherUserName || 'Unknown User'}</h3>
              <p className="text-white/80 mb-8">Incoming {isVideo ? 'video' : 'voice'} call...</p>
              
              <div className="flex justify-center gap-8">
                <button
                  onClick={handleEndCall}
                  className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all transform hover:scale-105 shadow-lg"
                >
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={acceptIncomingCall}
                  className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-all transform hover:scale-105 shadow-lg"
                >
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}