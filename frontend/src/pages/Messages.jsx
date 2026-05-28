import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import CallModal from '../components/CallModal';

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
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const userIdRef = useRef(userId);
  const userRef = useRef(user);

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
   

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">User not found</p>
          <button onClick={() => navigate('/chats')} className="px-4 py-2 bg-teal-500 text-white rounded-full">Go Back</button>
        </div>
      </div>
    );
  }

   return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* WhatsApp-like Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/chats')} className="text-white text-2xl">←</button>
          <div className="flex items-center gap-3">
            {otherUser.photos?.[0] ? (
              <img 
                src={otherUser.photos[0]} 
                alt={otherUser.name} 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-lg text-white">{otherUser.name?.[0]}</span>
              </div>
            )}
            <div>
              <h2 className="font-semibold text-lg">{otherUser.name}</h2>
              <p className="text-xs text-teal-100">
                {online ? '🟢 Online' : (isTyping ? 'Typing...' : 'Last seen recently')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={startVideoCall} 
            className="p-2 hover:bg-[#054a3a] rounded-full transition" 
            title="Video Call"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </button>
          <button 
            onClick={startVoiceCall} 
            className="p-2 hover:bg-[#054a3a] rounded-full transition" 
            title="Voice Call"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-[#054a3a] rounded-full transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20">
                  <button onClick={() => { handleDeleteConversation(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 rounded-t-lg">🗑️ Delete Conversation</button>
                  <button onClick={() => { handleBlockUser(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100">🚫 Block {otherUser.name}</button>
                  <button onClick={() => { handleReportUser(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 rounded-b-lg">⚠️ Report User</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2]">
        <div className="flex flex-col space-y-2 max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from_user === user.id ? 'justify-end' : 'justify-start'} group relative`}
            >
              <div
                className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm ${
                  msg.from_user === user.id
                    ? 'bg-[#DCF8C6] text-gray-800 rounded-tr-sm'
                    : 'bg-white text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.image && (
                  <img 
                    src={msg.image} 
                    alt="Shared" 
                    className="rounded-lg max-w-full mb-1 cursor-pointer max-h-40 object-cover"
                    onClick={() => window.open(msg.image, '_blank')}
                  />
                )}
                {msg.message && <p className="break-words text-sm">{msg.message}</p>}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <p className="text-[10px] text-gray-500">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {msg.from_user === user.id && (
                    <span className="text-[10px]">
                      {msg.sending && <span className="text-gray-400">⏳</span>}
                      {sendingStatus[msg.tempId] === 'sending' && <span className="text-gray-400">✓</span>}
                      {sendingStatus[msg.tempId] === 'sent' && <span className="text-gray-400">✓</span>}
                      {sendingStatus[msg.tempId] === 'delivered' && <span className="text-gray-500">✓✓</span>}
                      {msg.is_read && !msg.sending && <span className="text-blue-500">✓✓</span>}
                      {!sendingStatus[msg.tempId] && !msg.is_read && !msg.sending && <span className="text-gray-400">✓</span>}
                    </span>
                  )}
                </div>
                {msg.from_user === user.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMessage(msg.id);
                    }}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600 transition shadow-md"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-3 py-2 rounded-lg rounded-tl-sm shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-gray-100 p-3 border-t border-gray-200">
        <div className="flex gap-2 items-center max-w-4xl mx-auto">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-500 hover:text-gray-700 transition rounded-full"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-30">
                <div className="fixed inset-0 z-20" onClick={() => setShowEmojiPicker(false)}></div>
                <div className="relative z-30">
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2 text-gray-500 hover:text-gray-700 transition rounded-full"
          >
            {uploadingImage ? '⏳' : '📷'}
          </button>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            onKeyUp={handleTyping}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
          />
          
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="bg-teal-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            Send
          </button>
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