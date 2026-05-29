import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Friends() {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [friendsRes, requestsRes, sentRes] = await Promise.all([
        axios.get(`${API_URL}/friends`, { headers }),
        axios.get(`${API_URL}/friends/requests`, { headers }),
        axios.get(`${API_URL}/friends/sent-requests`, { headers })
      ]);
      
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
      setSentRequests(sentRes.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAccept = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/friends/accept/${userId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Friend request accepted!');
      fetchAll();
    } catch (error) {
      toast.error('Failed to accept');
    }
  };

  const handleReject = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/friends/reject/${userId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Request declined');
      fetchAll();
    } catch (error) {
      toast.error('Failed to decline');
    }
  };

  const handleCancelRequest = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/friends/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Request cancelled');
      fetchAll();
    } catch (error) {
      toast.error('Failed to cancel');
    }
  };

  const handleUnfriend = async (userId, name) => {
    if (confirm(`Remove ${name} from your friends?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/friends/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success(`${name} removed from friends`);
        fetchAll();
      } catch (error) {
        toast.error('Failed to remove friend');
      }
    }
  };

  const tabs = [
    { key: 'friends', label: 'Friends', count: friends.length, icon: '👥' },
    { key: 'requests', label: 'Requests', count: requests.length, icon: '📨' },
    { key: 'sent', label: 'Sent', count: sentRequests.length, icon: '📤' },
  ];

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} transition-colors duration-300`}>
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Friends</h1>
        </div>

        {/* Tabs */}
        <div className={`flex rounded-xl overflow-hidden mb-4 sm:mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all relative ${
                activeTab === tab.key
                  ? 'text-pink-500'
                  : isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key
                    ? 'bg-pink-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-pink-500 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Friends List */}
        {activeTab === 'friends' && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-4xl mb-3">👥</div>
                <p className="text-sm">No friends yet</p>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm transition-all hover:shadow-md`}>
                  <Link to={`/messages/${friend.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {friend.photos?.[0] ? (
                        <img src={friend.photos[0]} alt={friend.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{friend.name?.[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm sm:text-base truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{friend.name}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {friend.online_status ? '🟢 Online' : 'Offline'}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleUnfriend(friend.id, friend.name)}
                    className={`p-2 rounded-full text-xs transition ${
                      isDark ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                    }`}
                    title="Remove friend"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Friend Requests */}
        {activeTab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-4xl mb-3">📨</div>
                <p className="text-sm">No pending requests</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {req.photos?.[0] ? (
                        <img src={req.photos[0]} alt={req.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{req.name?.[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm sm:text-base truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{req.name}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Wants to be friends</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="px-3 py-1.5 bg-pink-500 text-white text-xs font-medium rounded-full hover:bg-pink-600 transition active:scale-95"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition active:scale-95 ${
                        isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Sent Requests */}
        {activeTab === 'sent' && (
          <div className="space-y-2">
            {sentRequests.length === 0 ? (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-4xl mb-3">📤</div>
                <p className="text-sm">No sent requests</p>
              </div>
            ) : (
              sentRequests.map(req => (
                <div key={req.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {req.photos?.[0] ? (
                        <img src={req.photos[0]} alt={req.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{req.name?.[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm sm:text-base truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{req.name}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Request sent</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelRequest(req.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition active:scale-95 ${
                      isDark ? 'bg-gray-700 text-gray-300 hover:bg-red-500/20 hover:text-red-400' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}