import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StatusCircle from '../components/StatusCircle';
import StatusModal from '../components/StatusModal';
import StatusUpload from '../components/StatusUpload';
import UserProfileModal from '../components/UserProfileModal';
import { useTheme } from '../context/ThemeContext';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Separate component for each tab
function PostsFeed({ onLikePost, onCommentPost, onSharePost }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/posts/feed?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (page === 1) {
        setPosts(response.data.posts);
      } else {
        setPosts(prev => [...prev, ...response.data.posts]);
      }
      setHasMore(response.data.pagination.hasMore);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    setCreatingPost(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/posts`, 
        { content: newPostContent },
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      setNewPostContent('');
      setPage(1);
      fetchPosts();
      toast.success('Post created! ✨');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Post Card */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-sm`}>
        <textarea
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          placeholder="What's on your mind? 💭"
          className={`w-full p-3 rounded-lg resize-none text-sm ${
            isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-800'
          } border-0 focus:ring-2 focus:ring-pink-500 outline-none`}
          rows={3}
        />
        <div className="flex justify-between items-center mt-2">
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {newPostContent.length}/500
          </span>
          <button
            onClick={handleCreatePost}
            disabled={!newPostContent.trim() || creatingPost}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {creatingPost ? 'Posting...' : 'Post 📝'}
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-4xl mb-3">📝</div>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-sm transition-all hover:shadow-md`}>
            {/* Post Header */}
            <div className="flex items-center gap-3 mb-3">
              <Link to={`/profile/${post.user_id}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden">
                  {post.user_photo ? (
                    <img src={fixImageUrl(post.user_photo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold">{post.user_name?.[0]}</span>
                  )}
                </div>
              </Link>
              <div>
                <Link to={`/profile/${post.user_id}`} className={`font-medium text-sm ${isDark ? 'text-white hover:text-pink-400' : 'text-gray-800 hover:text-pink-600'}`}>
                  {post.user_name}
                </Link>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(post.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Post Content */}
            <p className={`text-sm mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{post.content}</p>

            {/* Post Media */}
            {post.media_url && (
              <div className="mb-3 rounded-lg overflow-hidden">
                {post.media_type === 'video' ? (
                  <video src={post.media_url} controls className="w-full max-h-96 object-cover" />
                ) : (
                  <img src={post.media_url} alt="" className="w-full max-h-96 object-cover" />
                )}
              </div>
            )}

            {/* Post Actions */}
            <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => onLikePost(post.id)}
                className={`flex items-center gap-1.5 text-xs transition ${
                  post.is_liked ? 'text-pink-500' : isDark ? 'text-gray-400 hover:text-pink-400' : 'text-gray-500 hover:text-pink-500'
                }`}
              >
                <span>{post.is_liked ? '❤️' : '🤍'}</span>
                <span>{post.likes_count || 0}</span>
              </button>
              <button className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'}`}>
                <span>💬</span>
                <span>{post.comments_count || 0}</span>
              </button>
              <button className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-400 hover:text-green-400' : 'text-gray-500 hover:text-green-500'}`}>
                <span>🔄</span>
                <span>{post.shares_count || 0}</span>
              </button>
            </div>

            {/* Post Comments Preview */}
            {post.comments?.length > 0 && (
              <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                {post.comments.slice(0, 2).map(comment => (
                  <div key={comment.id} className="flex gap-2 mb-2">
                    <span className={`font-medium text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {comment.user_name}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {comment.content}
                    </span>
                  </div>
                ))}
                {post.comments.length > 2 && (
                  <button className={`text-xs ${isDark ? 'text-gray-400 hover:text-pink-400' : 'text-gray-500 hover:text-pink-500'}`}>
                    View all {post.comments_count} comments
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full py-3 text-center text-sm text-pink-500 hover:text-pink-600 font-medium"
        >
          Load More Posts ↓
        </button>
      )}
    </div>
  );
}

// Users Grid Component for New People
function NewPeopleGrid({ users, onLike, onPass, onAddFriend, swiping, friendRequests }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {users.map(user => (
          <div
            key={user.id}
            onClick={() => setSelectedUser(user.id)}
            className={`group cursor-pointer ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
          >
            {/* User Photo */}
            <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500">
              {user.photos?.[0] ? (
                <img
                  src={fixImageUrl(user.photos[0])}
                  alt={user.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-4xl text-white font-bold">${user.name?.[0]}</span></div>`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl text-white font-bold">{user.name?.[0]}</span>
                </div>
              )}

              {/* Online Badge */}
              {user.online_status && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  Online
                </div>
              )}

              {/* Quick Actions Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onLike(user.id, e); }}
                  disabled={swiping[user.id]}
                  className="p-2 bg-pink-500 rounded-full text-white hover:scale-110 transition-transform"
                >
                  ❤️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onPass(user.id); }}
                  disabled={swiping[user.id]}
                  className="p-2 bg-gray-600 rounded-full text-white hover:scale-110 transition-transform"
                >
                  ❌
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddFriend(user.id, user.name); }}
                  disabled={friendRequests[user.id]}
                  className="p-2 bg-blue-500 rounded-full text-white hover:scale-110 transition-transform"
                >
                  👤
                </button>
              </div>
            </div>

            {/* User Info */}
            <div className="p-3">
              <h3 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {user.name}, {user.age}
              </h3>
              {user.bio && (
                <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {user.bio}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedUser && (
        <UserProfileModal
          userId={selectedUser}
          onClose={() => setSelectedUser(null)}
          onLike={async (id) => {
            await onLike(id);
            setSelectedUser(null);
          }}
          onPass={async (id) => {
            await onPass(id);
            setSelectedUser(null);
          }}
          currentUser={null}
        />
      )}
    </>
  );
}

// Matches Grid Component
function MatchesGrid({ matches }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {matches.map(match => (
        <Link
          key={match.id}
          to={`/messages/${match.id}`}
          className={`group ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
        >
          <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500">
            {match.photos?.[0] ? (
              <img
                src={fixImageUrl(match.photos[0])}
                alt={match.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl text-white font-bold">{match.name?.[0]}</span>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>💕</span> Match
            </div>
          </div>
          <div className="p-3">
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {match.name}, {match.age}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {match.online_status ? '🟢 Online' : 'Offline'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Friends Grid Component
function FriendsGrid({ friends, onUnfriend }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {friends.map(friend => (
        <div
          key={friend.id}
          className={`group ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300`}
        >
          <Link to={`/messages/${friend.id}`} className="block">
            <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500">
              {friend.photos?.[0] ? (
                <img
                  src={fixImageUrl(friend.photos[0])}
                  alt={friend.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl text-white font-bold">{friend.name?.[0]}</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>👥</span> Friend
              </div>
            </div>
          </Link>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <Link to={`/messages/${friend.id}`}>
                <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {friend.name}
                </h3>
              </Link>
              <button
                onClick={() => onUnfriend(friend.id, friend.name)}
                className="text-red-400 hover:text-red-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Unfriend"
              >
                ✕
              </button>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {friend.online_status ? '🟢 Online' : 'Offline'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Dashboard Component
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('new'); // 'posts', 'friends', 'new', 'matches'
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState({});
  const [stories, setStories] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState(null);
  const [selectedStoryStatuses, setSelectedStoryStatuses] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [friendRequests, setFriendRequests] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const filter = activeTab === 'new' ? 'new' : activeTab === 'matches' ? 'matches' : activeTab === 'friends' ? 'friends' : 'all';
      const response = await axios.get(`${API_URL}/users/discover`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { filter, search: searchTerm }
      });
      setUsers(response.data.users);
      setCounts(response.data.counts);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired');
        logout();
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, logout, navigate]);

  const fetchStories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/status/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setStories(response.data.stories);
      setMyStatuses(response.data.myStatuses);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  useEffect(() => {
    if (activeTab !== 'posts') {
      fetchUsers();
    }
  }, [activeTab, searchTerm, fetchUsers]);

  useEffect(() => {
    fetchStories();
  }, []);

  const handleLike = async (targetUserId, e) => {
    if (swiping[targetUserId]) return;
    setSwiping(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId, action: 'like'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      
      if (response.data.matched) {
        toast.success("💕 It's a Match!", {
          duration: 5000,
          style: { background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: 'white' }
        });
      } else {
        toast.success('Liked! ❤️');
      }
      fetchUsers();
    } catch (error) {
      toast.error('Failed to like');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handlePass = async (targetUserId) => {
    if (swiping[targetUserId]) return;
    setSwiping(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId, action: 'pass'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      fetchUsers();
    } catch (error) {
      toast.error('Failed to pass');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleAddFriend = async (targetUserId, userName) => {
    if (friendRequests[targetUserId]) return;
    setFriendRequests(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/friends/request/${targetUserId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(`Friend request sent to ${userName}! 👥`);
    } catch (error) {
      toast.error('Failed to send friend request');
    } finally {
      setFriendRequests(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleUnfriend = async (friendId, name) => {
    if (confirm(`Remove ${name} from your friends?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/friends/${friendId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success(`${name} removed from friends`);
        fetchUsers();
      } catch (error) {
        toast.error('Failed to remove friend');
      }
    }
  };

  const tabs = [
    { 
      id: 'posts', 
      label: 'Posts', 
      icon: '🌐', 
      count: null // Posts don't need count
    },
    { 
      id: 'new', 
      label: 'Discover', 
      icon: '✨', 
      count: counts?.new_people || 0 
    },
    { 
      id: 'matches', 
      label: 'Matches', 
      icon: '💕', 
      count: counts?.matches || 0 
    },
    { 
      id: 'friends', 
      label: 'Friends', 
      icon: '👥', 
      count: counts?.friends || 0 
    },
  ];

  if (loading && activeTab !== 'posts') {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-pink-500 border-t-transparent mx-auto mb-4"></div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} transition-colors duration-300`}>
      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          
          {/* Search Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'} shadow-sm hover:shadow-md transition-all`}
            >
              🔍
            </button>
            {showSearch && (
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`px-3 py-2 rounded-lg text-sm outline-none ${
                  isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-800 border-gray-200'
                } border focus:ring-2 focus:ring-pink-500 transition-all animate-slide-in`}
                autoFocus
              />
            )}
            <Link
              to="/messages"
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'} shadow-sm hover:shadow-md transition-all relative`}
            >
              💬
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
            </Link>
          </div>
        </div>

        {/* Main Tabs */}
        <div className={`flex rounded-xl overflow-hidden mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-pink-500'
                  : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-pink-500 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Stories Section (always visible) */}
        <div className="mb-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setShowStatusUpload(!showStatusUpload)}
              className="flex flex-col items-center flex-shrink-0 group"
            >
              <div className={`w-14 h-14 rounded-full ${isDark ? 'bg-gray-800' : 'bg-white'} border-2 border-dashed border-pink-500 flex items-center justify-center text-2xl transition-all group-hover:scale-110 group-hover:border-pink-400`}>
                {myStatuses.length > 0 ? '📖' : '+'}
              </div>
              <span className="text-[10px] mt-1 text-gray-500">My Story</span>
            </button>
            {stories.map(userStory => (
              <StatusCircle
                key={userStory.user_id}
                user={userStory}
                onView={() => {
                  setSelectedStoryUser(userStory);
                  setSelectedStoryStatuses(userStory.statuses);
                  setCurrentStoryIndex(0);
                }}
              />
            ))}
          </div>
          {showStatusUpload && (
            <div className="mt-3">
              <StatusUpload
                onUpload={() => { fetchStories(); setShowStatusUpload(false); }}
                onClose={() => setShowStatusUpload(false)}
              />
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'posts' && (
            <PostsFeed />
          )}

          {activeTab === 'new' && users.length === 0 && !loading && (
            <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="text-5xl mb-4">🌟</div>
              <p className="text-lg font-medium mb-2">No New People</p>
              <p className="text-sm">Everyone has been discovered! Check back later.</p>
            </div>
          )}

          {activeTab === 'new' && users.length > 0 && (
            <NewPeopleGrid
              users={users}
              onLike={handleLike}
              onPass={handlePass}
              onAddFriend={handleAddFriend}
              swiping={swiping}
              friendRequests={friendRequests}
            />
          )}

          {activeTab === 'matches' && users.length === 0 && !loading && (
            <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="text-5xl mb-4">💔</div>
              <p className="text-lg font-medium mb-2">No Matches Yet</p>
              <p className="text-sm mb-4">Start liking people to find your match!</p>
              <button
                onClick={() => setActiveTab('new')}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all"
              >
                Discover People ✨
              </button>
            </div>
          )}

          {activeTab === 'matches' && users.length > 0 && (
            <MatchesGrid matches={users} />
          )}

          {activeTab === 'friends' && users.length === 0 && !loading && (
            <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className="text-5xl mb-4">👥</div>
              <p className="text-lg font-medium mb-2">No Friends Yet</p>
              <p className="text-sm mb-4">Add friends to stay connected!</p>
              <button
                onClick={() => setActiveTab('new')}
                className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all"
              >
                Find Friends 👤
              </button>
            </div>
          )}

          {activeTab === 'friends' && users.length > 0 && (
            <FriendsGrid friends={users} onUnfriend={handleUnfriend} />
          )}
        </div>
      </div>

      {/* Status Modal */}
      {selectedStoryUser && selectedStoryStatuses?.length > 0 && (
        <StatusModal
          user={selectedStoryUser}
          userStatuses={selectedStoryStatuses}
          currentIndex={currentStoryIndex}
          onClose={() => { setSelectedStoryUser(null); setSelectedStoryStatuses([]); setCurrentStoryIndex(0); }}
          onNext={() => {
            if (currentStoryIndex + 1 < selectedStoryStatuses.length) setCurrentStoryIndex(currentStoryIndex + 1);
            else { setSelectedStoryUser(null); setSelectedStoryStatuses([]); setCurrentStoryIndex(0); }
          }}
          onPrev={() => {
            if (currentStoryIndex - 1 >= 0) setCurrentStoryIndex(currentStoryIndex - 1);
          }}
        />
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}