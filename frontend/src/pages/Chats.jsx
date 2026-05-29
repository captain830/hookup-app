import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Chats() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        return;
      }

      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    
    const socket = io(SOCKET_URL);
    
    socket.on('messages-read', () => {
      fetchConversations();
    });
    
    socket.on('new-message', (data) => {
      if (data.to === user?.id) {
        fetchConversations();
      }
    });
    
    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [user]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Theme classes
  const pageBg = isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100';
  const cardBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white';
  const dividerColor = isDark ? 'divide-gray-700' : 'divide-gray-100';
  const titleColor = isDark ? 'text-white' : 'text-gray-800';
  const subtitleColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const nameColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const ageColor = isDark ? 'text-gray-400' : 'text-gray-400';
  const messageTextColor = isDark ? 'text-gray-300' : 'text-gray-500';
  const messageUnreadColor = isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold';
  const timeColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const youPrefixColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const unreadBg = isDark ? 'bg-pink-50/10 hover:bg-pink-50/20' : 'bg-pink-50 hover:bg-pink-100';
  const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50';
  const activeBg = isDark ? 'active:bg-gray-600' : 'active:bg-gray-100';
  const onlineDotBorder = isDark ? 'border-gray-800' : 'border-white';
  const emptyCardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const emptyTitleColor = isDark ? 'text-white' : 'text-gray-800';
  const emptyTextColor = isDark ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-2 sm:border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${pageBg} py-3 sm:py-5 md:py-8`}>
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-4 md:px-6">
        {/* Header - Responsive */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8 px-2">
          <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 ${titleColor}`}>
            Messages
          </h1>
          <p className={`text-xs sm:text-sm md:text-base ${subtitleColor}`}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Empty State */}
        {conversations.length === 0 ? (
          <div className={`${emptyCardBg} rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-6 sm:p-8 md:p-12 text-center mx-1 sm:mx-0`}>
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">💬</div>
            <h2 className={`text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2 ${emptyTitleColor}`}>
              No Messages Yet
            </h2>
            <p className={`text-xs sm:text-sm md:text-base mb-4 sm:mb-6 ${emptyTextColor}`}>
              Start a conversation with someone!
            </p>
            <Link
              to="/"
              className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:shadow-lg active:scale-95 transition-all"
            >
              Discover People
            </Link>
          </div>
        ) : (
          /* Conversations List */
          <div className={`${cardBg} rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl overflow-hidden mx-1 sm:mx-0 border ${isDark ? 'border-gray-700' : 'border-transparent'}`}>
            <div className={`divide-y ${dividerColor}`}>
              {conversations.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/messages/${chat.id}`}
                  className={`block ${hoverBg} ${activeBg} transition-colors ${
                    chat.unread_count > 0 ? unreadBg : ''
                  }`}
                  onClick={() => {
                    if (chat.unread_count > 0) {
                      setConversations(prev => prev.map(c => 
                        c.id === chat.id ? { ...c, unread_count: 0 } : c
                      ));
                    }
                  }}
                >
                  {/* Chat Row */}
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 md:gap-4">
                    
                    {/* Avatar - Smaller on mobile */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-sm">
                        {chat.photos && chat.photos.length > 0 ? (
                          <img 
                            src={fixImageUrl(chat.photos[0])}
                            alt={chat.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-lg sm:text-xl md:text-2xl text-white font-bold">${chat.name?.charAt(0)?.toUpperCase()}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-lg sm:text-xl md:text-2xl text-white font-bold">
                            {chat.name?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Online indicator */}
                      {chat.online_status && (
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 bg-green-500 border-2 ${onlineDotBorder} rounded-full shadow-sm`}></div>
                      )}
                    </div>

                    {/* Content - Flex column */}
                    <div className="flex-1 min-w-0 py-0.5">
                      {/* Top row: Name + Time */}
                      <div className="flex justify-between items-baseline gap-2">
                        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap">
                          <h3 className={`font-semibold text-xs sm:text-sm md:text-base truncate max-w-[120px] sm:max-w-[160px] md:max-w-[200px] ${nameColor}`}>
                            {chat.name}
                          </h3>
                          {chat.age && (
                            <span className={`text-[10px] sm:text-xs flex-shrink-0 ${ageColor}`}>, {chat.age}</span>
                          )}
                          {chat.is_premium && (
                            <span className="text-[10px] sm:text-xs flex-shrink-0" title="Premium">⭐</span>
                          )}
                        </div>
                        <span className={`text-[10px] sm:text-xs flex-shrink-0 ${timeColor}`}>
                          {formatTime(chat.last_message?.time)}
                        </span>
                      </div>
                      
                      {/* Bottom row: Message preview + Unread badge */}
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2 mt-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          {chat.last_message?.from_me && (
                            <span className={`text-[10px] sm:text-xs flex-shrink-0 ${youPrefixColor}`}>You:</span>
                          )}
                          <p className={`text-[11px] sm:text-xs md:text-sm truncate ${
                            chat.unread_count > 0 ? messageUnreadColor : messageTextColor
                          }`}>
                            {chat.last_message?.text || 'No messages yet'}
                          </p>
                        </div>

                        {/* Unread count badge */}
                        {chat.unread_count > 0 && (
                          <div className="flex-shrink-0 min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] md:min-w-[22px] md:h-[22px] bg-pink-500 text-white text-[10px] sm:text-[11px] rounded-full flex items-center justify-center font-bold shadow-sm px-1">
                            {chat.unread_count > 99 ? '99+' : chat.unread_count > 9 ? '9+' : chat.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}