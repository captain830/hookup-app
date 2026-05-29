import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import CallModal from '../components/CallModal';
import { useTheme } from '../context/ThemeContext';
import { fixImageUrl } from '../utils/imageUrl';

// Use environment variables for API URLs
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Messages() {
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const [sendingStatus, setSendingStatus] = useState({});
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const userIdRef = useRef(userId);
  const userRef = useRef(user);
  const inputRef = useRef(null);

  // Update refs when values change
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { 'Authorization': `Bearer ${token}` } };
  };

  // Load user and messages - USING ENV VAR
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const [userResponse, messagesResponse] = await Promise.all([
          axios.get(`${API_URL}/users/${userId}`, getAuthHeaders()),
          axios.get(`${API_URL}/messages/conversation/${userId}`, getAuthHeaders())
        ]);
        
        if (isMounted) {
          setOtherUser(userResponse.data);
          setOnline(userResponse.data.online_status || false);
          setMessages(messagesResponse.data);
          setLoading(false);
          markMessagesAsRead();
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          if (error.response?.status === 404) {
            toast.error('User not found');
            navigate('/chats');
          } else {
            toast.error('Failed to load messages');
            setLoading(false);
          }
        }
      }
    };
    
    fetchData();
    return () => { isMounted = false; };
  }, [userId]);

  // Setup socket - USING ENV VAR
  useEffect(() => {
    if (loading || !otherUser) return;
    
    console.log('🔌 Setting up socket for chat with user:', userId);
    
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected with ID:', socketRef.current.id);
      
      if (userRef.current?.id) {
        console.log('👤 Emitting user-online for user:', userRef.current.id);
        socketRef.current.emit('user-online', userRef.current.id);
      }
      
      const roomId = [userRef.current.id, parseInt(userIdRef.current)].sort().join('-');
      console.log('🏠 Joining chat room:', roomId);
      socketRef.current.emit('join-chat', roomId);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected:', reason);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      if (userRef.current?.id) {
        socketRef.current.emit('user-online', userRef.current.id);
        const roomId = [userRef.current.id, parseInt(userIdRef.current)].sort().join('-');
        socketRef.current.emit('join-chat', roomId);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socketRef.current.on('new-message', (message) => {
      console.log('📨 New message received:', message);
      if (message.from === parseInt(userIdRef.current)) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, {
            id: message.id,
            from_user: message.from,
            to_user: userRef.current.id,
            message: message.message,
            image: message.image,
            created_at: message.created_at || new Date().toISOString(),
            is_read: false
          }];
        });
        scrollToBottom();
      }
    });

    socketRef.current.on('message-delivered', ({ messageId, tempId }) => {
      setSendingStatus(prev => ({ ...prev, [tempId || messageId]: 'delivered' }));
    });

    socketRef.current.on('messages-read', ({ by, from }) => {
      if (from === userRef.current.id) {
        setMessages(prev => prev.map(msg => 
          msg.from_user === userRef.current.id ? { ...msg, is_read: true } : msg
        ));
      }
    });

    socketRef.current.on('user-typing', ({ from, isTyping: typing }) => {
      if (from === parseInt(userIdRef.current)) {
        setIsTyping(typing);
        if (typing) {
          setTimeout(() => setIsTyping(false), 1500);
        }
      }
    });

    socketRef.current.on('user-status-changed', ({ userId: changedUserId, status }) => {
      console.log('👤 User status changed:', changedUserId, status);
      if (changedUserId === parseInt(userIdRef.current) || changedUserId == userIdRef.current) {
        setOnline(status === 'online');
      }
    });

    // ========== CALL HANDLING ==========
    
    socketRef.current.on('incoming-call', ({ from, isVideo, callerInfo }) => {
      console.log('📞 Incoming call from:', from, 'Current user:', userRef.current.id);
      
      if (from === parseInt(userIdRef.current) && from !== userRef.current.id) {
        console.log('✅ Showing incoming call UI');
        setIncomingCall({ 
          from, 
          isVideo: Boolean(isVideo),
          callerInfo
        });
        
        try {
          const audio = new Audio('/ringtone.mp3');
          audio.loop = true;
          audio.play().catch(e => console.log('Cannot play ringtone:', e));
          window.ringtoneAudio = audio;
        } catch (e) {
          console.log('Ringtone error:', e);
        }
      }
    });

    socketRef.current.on('call-accepted', ({ from }) => {
      console.log('✅ Call accepted by:', from);
      stopRingtone();
      if (from === parseInt(userIdRef.current)) {
        setCallStatus('connected');
        toast.success('Call connected!');
      }
    });

    socketRef.current.on('call-rejected', ({ from, reason }) => {
      console.log('❌ Call rejected:', reason);
      stopRingtone();
      if (from === parseInt(userIdRef.current)) {
        setShowCallModal(false);
        setIncomingCall(null);
        setCallStatus(null);
        toast(reason || 'Call declined');
      }
    });

    socketRef.current.on('call-ended', ({ from }) => {
      console.log('🔴 Call ended by:', from);
      stopRingtone();
      setShowCallModal(false);
      setIncomingCall(null);
      setCallStatus(null);
      if (from === parseInt(userIdRef.current) || from === userRef.current.id) {
        toast.info('Call ended');
      }
    });

    socketRef.current.on('call-error', ({ message, code }) => {
      console.error('❌ Call error:', message, code);
      stopRingtone();
      
      if (code === 'USER_OFFLINE') {
        toast.error(`${otherUser?.name || 'User'} is offline. They will be notified when you call.`);
      } else {
        toast.error(message || 'Call failed');
      }
      
      setShowCallModal(false);
      setIncomingCall(null);
      setCallStatus(null);
    });

    return () => {
      stopRingtone();
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket');
        socketRef.current.disconnect();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [loading, otherUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const stopRingtone = () => {
    if (window.ringtoneAudio) {
      window.ringtoneAudio.pause();
      window.ringtoneAudio.currentTime = 0;
      window.ringtoneAudio = null;
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await axios.put(`${API_URL}/messages/read/${userId}`, {}, getAuthHeaders());
      if (socketRef.current) {
        socketRef.current.emit('mark-read', { from: parseInt(userId), to: user.id });
      }
      setMessages(prev => prev.map(msg => 
        msg.from_user === parseInt(userId) ? { ...msg, is_read: true } : msg
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageText = newMessage.trim();
    const tempId = Date.now();
    setNewMessage('');
    if (inputRef.current) inputRef.current.focus();
    
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      from_user: user.id,
      to_user: parseInt(userId),
      message: messageText,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    setSendingStatus(prev => ({ ...prev, [tempId]: 'sending' }));
    
    try {
      const response = await axios.post(
        `${API_URL}/messages/send`,
        { to: parseInt(userId), message: messageText },
        getAuthHeaders()
      );
      
      const newMsg = response.data;
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...newMsg, sending: false } : msg
      ));
      setSendingStatus(prev => ({ ...prev, [tempId]: 'sent' }));
      
      if (socketRef.current) {
        socketRef.current.emit('private-message', {
          from: user.id,
          to: parseInt(userId),
          message: messageText,
          messageId: newMsg.id,
          tempId: tempId
        });
      }
      
      setTimeout(() => {
        setSendingStatus(prev => ({ ...prev, [tempId]: 'delivered' }));
      }, 500);
      
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);
    
    const tempId = Date.now();
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      from_user: user.id,
      to_user: parseInt(userId),
      message: '📷 Sending image...',
      image: null,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
    try {
      const response = await axios.post(`${API_URL}/messages/upload-image`, formData, getAuthHeaders());
      
      const imageMsg = await axios.post(
        `${API_URL}/messages/send`,
        { to: parseInt(userId), message: '📷 Sent an image', image: response.data.imageUrl },
        getAuthHeaders()
      );
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setMessages(prev => [...prev, imageMsg.data]);
      scrollToBottom();
      
      if (socketRef.current) {
        socketRef.current.emit('private-message', {
          from: user.id,
          to: parseInt(userId),
          message: '📷 Sent an image',
          image: response.data.imageUrl,
          messageId: imageMsg.data.id
        });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { from: user.id, to: parseInt(userId) });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) socketRef.current.emit('stop-typing', { from: user.id, to: parseInt(userId) });
    }, 1000);
  };

  const onEmojiClick = (emojiObject) => {
    setNewMessage(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleDeleteMessage = async (messageId) => {
    if (confirm('Delete this message?')) {
      try {
        await axios.delete(`${API_URL}/messages/message/${messageId}`, getAuthHeaders());
        setMessages(prev => prev.filter(m => m.id !== messageId));
        toast.success('Message deleted');
      } catch (error) {
        toast.error('Failed to delete message');
      }
    }
  };

  const handleDeleteConversation = async () => {
    if (confirm('Delete entire conversation? This cannot be undone.')) {
      try {
        await axios.delete(`${API_URL}/messages/conversation/${userId}`, getAuthHeaders());
        setMessages([]);
        toast.success('Conversation deleted');
        navigate('/chats');
      } catch (error) {
        toast.error('Failed to delete conversation');
      }
    }
  };

  const handleBlockUser = async () => {
    if (confirm(`Block ${otherUser?.name}? You won't receive messages from them.`)) {
      try {
        await axios.post(`${API_URL}/messages/block/${userId}`, {}, getAuthHeaders());
        toast.success(`${otherUser?.name} has been blocked`);
        navigate('/chats');
      } catch (error) {
        toast.error('Failed to block user');
      }
    }
  };

  const handleReportUser = async () => {
    const reason = prompt('Why are you reporting this user?');
    if (reason) {
      try {
        await axios.post(`${API_URL}/messages/report/${userId}`, { reason }, getAuthHeaders());
        toast.success('User reported. Our team will review.');
      } catch (error) {
        toast.error('Failed to report user');
      }
    }
  };

  // ========== CALL HANDLERS ==========
  
  const startVideoCall = () => {
    console.log('🎥 Starting video call to user:', userId);
    
    if (!socketRef.current?.connected) {
      toast.error('Connecting to server... Please try again in a moment.');
      return;
    }
    
    socketRef.current.emit('user-online', user.id);
    
    setTimeout(() => {
      if (socketRef.current) {
        console.log('📞 Emitting call-user event:', {
          to: parseInt(userId),
          from: user.id,
          isVideo: true
        });
        
        socketRef.current.emit('call-user', {
          to: parseInt(userId),
          from: user.id,
          isVideo: true
        });
        
        setIsVideoCall(true);
        setShowCallModal(true);
        setCallStatus('calling');
      }
    }, 500);
  };

  const startVoiceCall = () => {
    console.log('📞 Starting voice call to user:', userId);
    
    if (!socketRef.current?.connected) {
      toast.error('Connecting to server... Please try again in a moment.');
      return;
    }
    
    socketRef.current.emit('user-online', user.id);
    
    setTimeout(() => {
      if (socketRef.current) {
        console.log('📞 Emitting call-user event:', {
          to: parseInt(userId),
          from: user.id,
          isVideo: false
        });
        
        socketRef.current.emit('call-user', {
          to: parseInt(userId),
          from: user.id,
          isVideo: false
        });
        
        setIsVideoCall(false);
        setShowCallModal(true);
        setCallStatus('calling');
      }
    }, 500);
  };

  const acceptCall = () => {
    if (socketRef.current && incomingCall) {
      console.log('✅ Accepting call from:', incomingCall.from);
      stopRingtone();
      
      socketRef.current.emit('accept-call', { 
        to: incomingCall.from, 
        from: user.id 
      });
      setIsVideoCall(incomingCall?.isVideo || false);
      setShowCallModal(true);
      setIncomingCall(null);
      setCallStatus('connected');
    }
  };

  const rejectCall = () => {
    if (socketRef.current && incomingCall) {
      console.log('❌ Rejecting call from:', incomingCall.from);
      stopRingtone();
      
      socketRef.current.emit('reject-call', { 
        to: incomingCall.from, 
        from: user.id,
        reason: 'Call declined'
      });
      setIncomingCall(null);
      setCallStatus(null);
    }
  };

  const handleCloseCall = () => {
    stopRingtone();
    setShowCallModal(false);
    setIncomingCall(null);
    setCallStatus(null);
  };

  // Theme classes
  const pageBg = isDark ? 'bg-[#0a0a0a]' : 'bg-[#efeae2]';
  const headerBg = isDark ? 'bg-[#1a1a2e]' : 'bg-[#075E54]';
  const inputBarBg = isDark ? 'bg-[#1a1a2e] border-t border-gray-700' : 'bg-[#f0f2f5] border-t border-gray-200/50';
  const myBubble = isDark ? 'bg-[#054a3a] text-gray-100' : 'bg-[#DCF8C6] text-gray-800';
  const theirBubble = isDark ? 'bg-[#1f2937] text-gray-100' : 'bg-white text-gray-800';
  const inputField = isDark ? 'bg-[#111827] border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400';
  const iconBtn = isDark ? 'text-gray-400 hover:text-gray-200 active:bg-gray-700' : 'text-gray-500 hover:text-gray-700 active:bg-gray-200';
  const menuBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white';
  const menuHover = isDark ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-gray-50 border-gray-100';
  const emptyText = isDark ? 'text-gray-500' : 'text-gray-400';
  const typingBg = isDark ? 'bg-[#1f2937]' : 'bg-white';
  const typingDot = isDark ? 'bg-gray-500' : 'bg-gray-400';
  const timeText = isDark ? 'text-gray-400' : 'text-gray-500';
  const headerHover = isDark ? 'hover:bg-white/10' : 'hover:bg-[#054a3a]';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${pageBg}`}>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-2 border-[#075E54] border-t-transparent"></div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${pageBg}`}>
        <div className="text-center px-4">
          <p className={`text-sm sm:text-base mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>User not found</p>
          <button onClick={() => navigate('/chats')} className="px-5 py-2.5 bg-[#075E54] text-white rounded-full text-sm sm:text-base font-medium hover:bg-[#054a3a] transition active:scale-95">
            Go Back
          </button>
        </div>
      </div>
    );
  }

   return (
    <div className={`h-screen flex flex-col ${pageBg} transition-colors duration-300`}>
      {/* ===== WHATSAPP-STYLE HEADER ===== */}
      <div className={`${headerBg} text-white px-2 sm:px-3 md:px-4 py-2 sm:py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-md safe-top transition-colors duration-300`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button 
            onClick={() => navigate('/chats')} 
            className={`text-white p-1 -ml-1 ${headerHover} rounded-full transition flex-shrink-0`}
            aria-label="Back"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {otherUser.photos?.[0] ? (
                <img 
                  src={fixImageUrl(otherUser.photos[0])}
                  alt={otherUser.name} 
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm sm:text-base md:text-lg font-semibold text-white">{otherUser.name?.[0]}</span>
                </div>
              )}
            </div>
            
            {/* Name & Status */}
            <div className="min-w-0">
              <h2 className="font-medium sm:font-semibold text-sm sm:text-base md:text-lg truncate max-w-[120px] sm:max-w-[180px] md:max-w-[250px]">
                {otherUser.name}
              </h2>
              <p className="text-[10px] sm:text-xs text-green-200 truncate">
                {online ? 'online' : (isTyping ? 'typing...' : 'last seen recently')}
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          <button 
            onClick={startVideoCall} 
            className={`p-1.5 sm:p-2 ${headerHover} rounded-full transition`}
            title="Video Call"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </button>
          <button 
            onClick={startVoiceCall} 
            className={`p-1.5 sm:p-2 ${headerHover} rounded-full transition`}
            title="Voice Call"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
          
          {/* Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className={`p-1.5 sm:p-2 ${headerHover} rounded-full transition`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className={`absolute right-0 mt-2 w-44 sm:w-48 rounded-lg shadow-lg z-20 overflow-hidden border ${menuBg}`}>
                  <button onClick={() => { handleDeleteConversation(); setShowMenu(false); }} className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-red-500 text-xs sm:text-sm transition border-b ${menuHover}`}>
                    🗑️ Delete Chat
                  </button>
                  <button onClick={() => { handleBlockUser(); setShowMenu(false); }} className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-red-500 text-xs sm:text-sm transition border-b ${menuHover}`}>
                    🚫 Block {otherUser.name}
                  </button>
                  <button onClick={() => { handleReportUser(); setShowMenu(false); }} className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-red-500 text-xs sm:text-sm transition ${menuHover}`}>
                    ⚠️ Report User
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== MESSAGES AREA (scrollable) ===== */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 py-3 sm:py-4">
        <div className="flex flex-col space-y-1.5 sm:space-y-2 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className={`text-center mt-8 sm:mt-12 md:mt-16 ${emptyText}`}>
              <div className="text-4xl sm:text-5xl mb-3">💬</div>
              <p className="text-sm sm:text-base">No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from_user === user.id ? 'justify-end' : 'justify-start'} group relative`}
            >
              <div
                className={`max-w-[80%] sm:max-w-[75%] md:max-w-[70%] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm relative ${
                  msg.from_user === user.id
                    ? `${myBubble} rounded-tr-sm`
                    : `${theirBubble} rounded-tl-sm`
                }`}
              >
                {msg.image && (
                  <img 
                    src={fixImageUrl(msg.image)}
                    alt="Shared" 
                    className="rounded-lg max-w-full mb-1 cursor-pointer max-h-40 sm:max-h-52 md:max-h-64 object-cover"
                    onClick={() => window.open(fixImageUrl(msg.image), '_blank')}
                    loading="lazy"
                  />
                )}
                {msg.message && (
                  <p className="break-words text-[13px] sm:text-sm md:text-[15px] leading-relaxed pr-5 sm:pr-6">
                    {msg.message}
                  </p>
                )}
                <div className="flex items-center justify-end gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                  <p className={`text-[10px] sm:text-[11px] ${timeText}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {msg.from_user === user.id && (
                    <span className="text-[10px] sm:text-[11px]">
                      {msg.sending && <span className="text-gray-400">⏳</span>}
                      {sendingStatus[msg.tempId] === 'sending' && <span className="text-gray-400">✓</span>}
                      {sendingStatus[msg.tempId] === 'sent' && <span className="text-gray-400">✓</span>}
                      {sendingStatus[msg.tempId] === 'delivered' && <span className="text-gray-400">✓✓</span>}
                      {msg.is_read && !msg.sending && <span className="text-blue-400">✓✓</span>}
                      {!sendingStatus[msg.tempId] && !msg.is_read && !msg.sending && <span className="text-gray-400">✓</span>}
                    </span>
                  )}
                </div>
                {/* Delete button */}
                {msg.from_user === user.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMessage(msg.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 text-[10px] flex items-center justify-center hover:bg-red-600 transition shadow-md"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className={`${typingBg} px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg rounded-tl-sm shadow-sm`}>
                <div className="flex gap-1">
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${typingDot}`}></span>
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${typingDot}`} style={{ animationDelay: '0.1s' }}></span>
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${typingDot}`} style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ===== STICKY INPUT BAR (always visible, never hidden) ===== */}
      <div className={`${inputBarBg} px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 flex-shrink-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] safe-bottom transition-colors duration-300`}>
        <div className="flex items-center gap-1 sm:gap-2 max-w-2xl mx-auto">
          {/* Emoji Button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 sm:p-2 rounded-full transition ${iconBtn}`}
              aria-label="Emoji"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-30">
                <div className="fixed inset-0 z-20" onClick={() => setShowEmojiPicker(false)}></div>
                <div className="relative z-30 emoji-picker-mobile">
                  <EmojiPicker onEmojiClick={onEmojiClick} width={window.innerWidth < 400 ? 280 : 320} height={350} />
                </div>
              </div>
            )}
          </div>
          
          {/* Camera/Image Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className={`p-1.5 sm:p-2 rounded-full transition flex-shrink-0 ${iconBtn}`}
            aria-label="Attach image"
          >
            {uploadingImage ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
          
          {/* Text Input */}
          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              onKeyUp={handleTyping}
              placeholder="Type a message..."
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-[#075E54] focus:border-transparent text-sm sm:text-base transition shadow-sm ${inputField}`}
            />
          </div>
          
          {/* Send Button / Microphone */}
          {newMessage.trim() ? (
            <button
              onClick={sendMessage}
              className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-[#075E54] text-white rounded-full flex items-center justify-center hover:bg-[#054a3a] transition active:scale-95 shadow-sm"
              aria-label="Send message"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          ) : (
            <button
              className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-[#075E54] text-white rounded-full flex items-center justify-center hover:bg-[#054a3a] transition opacity-60"
              aria-label="Record voice"
              disabled
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Call Modal */}
      {(showCallModal || incomingCall) && (
        <CallModal
          isVideo={incomingCall ? incomingCall.isVideo : isVideoCall}
          onClose={() => {
            stopRingtone();
            if (socketRef.current) {
              socketRef.current.emit('end-call', {
                to: incomingCall ? incomingCall.from : parseInt(userId),
                from: user.id
              });
            }
            setShowCallModal(false);
            setIncomingCall(null);
            setCallStatus(null);
          }}
          onAccept={incomingCall ? acceptCall : undefined}
          otherUserId={incomingCall ? incomingCall.from : parseInt(userId)}
          otherUserName={otherUser?.name || 'User'}
          otherUserPhoto={otherUser?.photos?.[0]}
          currentUserId={user?.id}
          isIncoming={!!incomingCall}
          callStatus={incomingCall ? 'ringing' : callStatus}
          socket={socketRef.current}   
        />
      )}
    </div>
  );
}