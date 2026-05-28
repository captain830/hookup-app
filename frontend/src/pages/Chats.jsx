import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Chats() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        return;
      }

      const response = await axios.get('http://localhost:5000/api/messages/conversations', {
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
    
    // Socket for real-time updates
    const socket = io('http://localhost:5000');
    
    // When a message is read, refresh the conversations list
    socket.on('messages-read', () => {
      fetchConversations();
    });
    
    // When a new message arrives, refresh to update last message and unread count
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
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Messages</h1>
          <p className="text-gray-500">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Messages Yet</h2>
            <p className="text-gray-500 mb-6">Start a conversation with someone!</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              Discover People
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {conversations.map((chat) => (
              <Link
                key={chat.id}
                to={`/messages/${chat.id}`}
                className={`block border-b border-gray-100 hover:bg-gray-50 transition ${
                  chat.unread_count > 0 ? 'bg-pink-50' : ''
                }`}
                onClick={() => {
                  // Optimistically clear unread count when clicking
                  if (chat.unread_count > 0) {
                    setConversations(prev => prev.map(c => 
                      c.id === chat.id ? { ...c, unread_count: 0 } : c
                    ));
                  }
                }}
              >
                <div className="p-4 flex items-center gap-4 hover:pl-6 transition-all">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-md">
                      {chat.photos && chat.photos.length > 0 ? (
                        <img 
                          src={`/uploads/${chat.photos[0].split('/').pop()}`}
                          alt={chat.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-2xl text-white font-bold">${chat.name?.charAt(0)?.toUpperCase()}</span>`;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-2xl text-white font-bold">
                          {chat.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {chat.online_status && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 text-lg">
                          {chat.name}
                          {chat.age && <span className="text-gray-400 text-sm ml-1">, {chat.age}</span>}
                        </h3>
                        {chat.is_premium && (
                          <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                            ⭐
                          </span>
                        )}
                      </div>
                      {chat.last_message?.time && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {formatTime(chat.last_message.time)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {chat.last_message?.from_me && (
                        <span className="text-xs text-gray-400">You:</span>
                      )}
                      <p className={`text-sm truncate ${
                        chat.unread_count > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'
                      }`}>
                        {chat.last_message?.text || 'No messages yet'}
                      </p>
                    </div>
                  </div>

                  {chat.unread_count > 0 && (
                    <div className="flex-shrink-0 w-6 h-6 bg-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-md">
                      {chat.unread_count > 9 ? '9+' : chat.unread_count}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
