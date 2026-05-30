import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StatusCircle from '../components/StatusCircle';
import StatusModal from '../components/StatusModal';
import StatusUpload from '../components/StatusUpload';
import UserProfileModal from '../components/UserProfileModal';
import { useTheme } from '../context/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to fix image URLs
const fixImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads')) return `${API_URL.replace('/api', '')}${url}`;
  return `${API_URL.replace('/api', '')}/uploads/${url}`;
};

// ==================== POSTS FEED ====================
function PostsFeed({ currentUser }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [newPostPreview, setNewPostPreview] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedPost, setExpandedPost] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const fileInputRef = useRef(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/posts?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (page === 1) {
        setPosts(response.data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(response.data.posts || [])]);
      }
      setHasMore(response.data.posts?.length === 20);
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Fallback to original endpoint
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/posts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setPosts(response.data.posts || []);
        setHasMore(false);
      } catch (err) {
        console.error('Fallback also failed:', err);
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    setNewPostMedia(file);
    const reader = new FileReader();
    reader.onloadend = () => setNewPostPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostMedia) return;
    setCreatingPost(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('content', newPostContent);
      if (newPostMedia) formData.append('media', newPostMedia);
      
      await axios.post(`${API_URL}/posts`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setNewPostContent('');
      setNewPostMedia(null);
      setNewPostPreview(null);
      setShowCreatePost(false);
      setPage(1);
      fetchPosts();
      toast.success('Post shared successfully! ✨');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/posts/${postId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDeleteConfirm(null);
      toast.success('Post deleted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleLikePost = async (postId, isLiked) => {
    try {
      const token = localStorage.getItem('token');
      if (isLiked) {
        await axios.delete(`${API_URL}/posts/${postId}/like`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/posts/${postId}/like`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            is_liked: !isLiked,
            likes_count: isLiked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async (postId) => {
    const content = commentText[postId]?.trim();
    if (!content) return;
    setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/posts/${postId}/comment`, 
        { content },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...(p.comments || []), response.data.comment],
            comments_count: response.data.comments_count
          };
        }
        return p;
      }));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-3 border-pink-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Post Trigger */}
      <div 
        onClick={() => setShowCreatePost(true)}
        className={`${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} 
          rounded-2xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all duration-300 group`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {currentUser?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className={`flex-1 py-2.5 px-4 rounded-xl text-sm ${
            isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-50 text-gray-500'
          }`}>
            What's on your mind? 💭
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl shadow-2xl`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Create Post</h3>
              <button onClick={() => setShowCreatePost(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share your thoughts..."
                className={`w-full p-3 rounded-xl resize-none text-sm outline-none ${
                  isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-800'
                } focus:ring-2 focus:ring-pink-500/50`}
                rows={4}
                autoFocus
              />
              {newPostPreview && (
                <div className="mt-3 relative rounded-xl overflow-hidden">
                  {newPostMedia?.type?.startsWith('video') ? (
                    <video src={newPostPreview} controls className="w-full max-h-64 object-cover" />
                  ) : (
                    <img src={newPostPreview} alt="Preview" className="w-full max-h-64 object-cover" />
                  )}
                  <button
                    onClick={() => { setNewPostMedia(null); setNewPostPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className={`flex items-center justify-between p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                📷 Add Media
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
              <button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() && !newPostMedia || creatingPost}
                className="px-5 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {creatingPost ? 'Posting...' : 'Share Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl p-6`}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>Delete Post?</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>Cancel</button>
              <button onClick={() => handleDeletePost(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
          <p className="text-sm">Be the first to share something!</p>
        </div>
      ) : (
        posts.map(post => (
          <article key={post.id} className={`${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} rounded-2xl shadow-sm border overflow-hidden`}>
            {/* Header */}
            <div className="p-4 pb-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {post.user_photo ? (
                      <img src={fixImageUrl(post.user_photo)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span class="text-white font-bold text-sm">${post.user_name?.[0]?.toUpperCase() || '?'}</span>`; }} />
                    ) : (
                      <span className="text-white font-bold text-sm">{post.user_name?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div>
                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{post.user_name || 'Anonymous'}</span>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatTimeAgo(post.created_at)}</p>
                  </div>
                </div>
                {currentUser?.id === post.user_id && (
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(post.id); }} className={`p-2 rounded-lg hover:bg-red-500/10 ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`} title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            {post.content && (
              <div className="px-4 pt-3">
                <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{post.content}</p>
              </div>
            )}

            {/* Media - FIXED IMAGE URL */}
            {post.media_url && (
              <div className="mt-3 mx-4 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                {post.media_type === 'video' ? (
                  <video src={fixImageUrl(post.media_url)} controls className="w-full max-h-[500px] object-contain" />
                ) : (
                  <img 
                    src={fixImageUrl(post.media_url)} 
                    alt="Post media" 
                    className="w-full max-h-[500px] object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div className={`px-4 py-3 mt-2 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => handleLikePost(post.id, post.is_liked)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${post.is_liked ? 'bg-pink-500/10 text-pink-500' : isDark ? 'text-gray-400 hover:text-pink-400' : 'text-gray-500 hover:text-pink-500'}`}>
                  {post.is_liked ? '❤️' : '🤍'} {post.likes_count || 0}
                </button>
                <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'}`}>
                  💬 {post.comments_count || 0}
                </button>
              </div>
            </div>

            {/* Comments */}
            {expandedPost === post.id && (
              <div className={`px-4 pb-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                {post.comments?.length > 0 && (
                  <div className="py-3 space-y-2 max-h-60 overflow-y-auto">
                    {post.comments.map(comment => (
                      <div key={comment.id} className={`px-3 py-1.5 rounded-xl text-xs ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <span className="font-semibold">{comment.user_name}</span>: {comment.content}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={commentText[post.id] || ''}
                    onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                    placeholder="Write a comment..."
                    className={`flex-1 py-2 px-3 rounded-xl text-xs outline-none ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-800'} focus:ring-2 focus:ring-pink-500/30`}
                  />
                  <button onClick={() => handleAddComment(post.id)} disabled={!commentText[post.id]?.trim()} className="text-pink-500 text-sm font-medium disabled:opacity-30">Post</button>
                </div>
              </div>
            )}
          </article>
        ))
      )}

      {hasMore && (
        <button onClick={() => setPage(p => p + 1)} className="w-full py-3 text-center text-sm text-pink-500 hover:text-pink-600 font-medium">
          Load More ↓
        </button>
      )}
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('new');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState({});
  const [stories, setStories] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState(null);
  const [selectedStoryStatuses, setSelectedStoryStatuses] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [friendRequests, setFriendRequests] = useState({});
  const [selectedUserModal, setSelectedUserModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Fetch users based on active tab
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { logout(); navigate('/login'); return; }

      let endpoint = '';
      let params = {};

      switch(activeTab) {
        case 'new':
          // Users who haven't been swiped on and aren't friends
          endpoint = `${API_URL}/users/discover`;
          params = { filter: 'new' };
          break;
        case 'matches':
          // Mutual matches only
          endpoint = `${API_URL}/matches/my-matches`;
          break;
        case 'friends':
          // Accepted friends only
          endpoint = `${API_URL}/friends`;
          break;
        default:
          endpoint = `${API_URL}/users/discover`;
          params = { filter: 'all' };
      }

      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
        params
      });

      console.log(`📥 ${activeTab} response:`, response.data);

      // Handle different response formats
      if (activeTab === 'matches') {
        // Matches endpoint returns array of match objects with otherUser
        const matchUsers = (response.data || []).map(match => ({
          ...match.otherUser,
          matchId: match.id,
          matchCreatedAt: match.created_at
        }));
        setUsers(matchUsers);
      } else if (activeTab === 'friends') {
        // Friends endpoint returns array of friend objects
        setUsers(response.data || []);
      } else {
        // Discover endpoint returns { users: [] }
        setUsers(response.data.users || response.data || []);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${activeTab}:`, error);
      if (error.response?.status === 401) {
        toast.error('Session expired');
        logout();
        navigate('/login');
      } else {
        // Try fallback
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/users/discover`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setUsers(response.data.users || response.data || []);
        } catch (err) {
          setUsers([]);
          toast.error('Failed to load users');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, logout, navigate]);

  const fetchStories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/status/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setStories(response.data.stories || []);
      setMyStatuses(response.data.myStatuses || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  useEffect(() => {
    if (activeTab !== 'posts') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  useEffect(() => {
    fetchStories();
  }, []);

  // Handle user actions
  const handleLike = async (userId) => {
    if (swiping[userId]) return;
    setSwiping(prev => ({ ...prev, [userId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId: userId, action: 'like'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      
      if (response.data.matched) {
        toast.success("💕 It's a Match!", {
          duration: 5000,
          style: { background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: 'white' }
        });
      } else {
        toast.success('Liked! ❤️');
      }
      // Remove from current view and refresh
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      toast.error('Failed to like');
    } finally {
      setSwiping(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handlePass = async (userId) => {
    if (swiping[userId]) return;
    setSwiping(prev => ({ ...prev, [userId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId: userId, action: 'pass'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      // Remove from current view
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      toast.error('Failed to pass');
    } finally {
      setSwiping(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAddFriend = async (userId, userName) => {
    if (friendRequests[userId]) return;
    setFriendRequests(prev => ({ ...prev, [userId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/friends/request/${userId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(`Friend request sent to ${userName}! 👥`);
    } catch (error) {
      toast.error('Failed to send friend request');
    } finally {
      setFriendRequests(prev => ({ ...prev, [userId]: false }));
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
        setUsers(prev => prev.filter(u => u.id !== friendId));
      } catch (error) {
        toast.error('Failed to remove friend');
      }
    }
  };

  const tabs = [
    { id: 'posts', label: 'Posts', icon: '🌐' },
    { id: 'new', label: 'Discover', icon: '✨' },
    { id: 'matches', label: 'Matches', icon: '💕' },
    { id: 'friends', label: 'Friends', icon: '👥' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} transition-colors duration-500`}>
      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        
        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-2">
            <Link to="/messages" className={`p-2.5 rounded-xl ${isDark ? 'bg-[#1a1a2e] text-gray-400' : 'bg-white text-gray-500'} shadow-sm border ${isDark ? 'border-gray-700/50' : 'border-gray-100'} relative`}>
              💬
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse"></span>
            </Link>
          </div>
        </div>

        {/* ===== STORIES (Always visible above tabs) ===== */}
        <div className="mb-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setShowStatusUpload(!showStatusUpload)} className="flex flex-col items-center flex-shrink-0 group cursor-pointer">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-pink-500 flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} group-hover:scale-110`}>
                {myStatuses.length > 0 ? '📖' : '+'}
              </div>
              <span className="text-[10px] sm:text-xs mt-1.5 text-gray-500 group-hover:text-pink-500">My Story</span>
            </button>
            {stories.map(userStory => (
              <StatusCircle
                key={userStory.user_id}
                user={userStory}
                onView={() => {
                  setSelectedStoryUser(userStory);
                  setSelectedStoryStatuses(userStory.statuses || []);
                  setCurrentStoryIndex(0);
                }}
              />
            ))}
          </div>
          {showStatusUpload && (
            <div className="mt-4">
              <StatusUpload
                onUpload={() => { fetchStories(); setShowStatusUpload(false); }}
                onClose={() => setShowStatusUpload(false)}
              />
            </div>
          )}
        </div>

        {/* ===== NAVIGATION TABS ===== */}
        <div className={`flex rounded-2xl overflow-hidden mb-5 ${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} shadow-sm border p-1`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-xl transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25'
                  : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ===== CONTENT ===== */}
        {activeTab === 'posts' && <PostsFeed currentUser={user} />}

        {activeTab !== 'posts' && loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-3 border-pink-500 border-t-transparent animate-spin"></div>
          </div>
        )}

        {activeTab !== 'posts' && !loading && users.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">
              {activeTab === 'matches' ? '💔' : activeTab === 'friends' ? '👥' : '🌟'}
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {activeTab === 'matches' ? 'No Matches Yet' : 
               activeTab === 'friends' ? 'No Friends Yet' : 'No New People'}
            </h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {activeTab === 'matches' ? 'Start liking people to find your match!' :
               activeTab === 'friends' ? 'Add friends to stay connected!' :
               'Everyone has been discovered! Check back later.'}
            </p>
            {activeTab !== 'new' && (
              <button onClick={() => setActiveTab('new')} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-xl transition-all">
                Discover People ✨
              </button>
            )}
          </div>
        )}

        {activeTab !== 'posts' && !loading && users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {users.map((profile, index) => (
              <div
                key={profile.id}
                onClick={() => setSelectedUserModal(profile.id)}
                className={`group cursor-pointer ${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} rounded-2xl overflow-hidden shadow-sm border hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Photo */}
                <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500">
                  {profile.photos?.[0] ? (
                    <img src={fixImageUrl(profile.photos[0])} alt={profile.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl text-white font-bold">{profile.name?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  
                  {/* Badges */}
                  {activeTab === 'matches' && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">💕 Match</div>
                  )}
                  {activeTab === 'friends' && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-blue-400 to-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">👥 Friend</div>
                  )}
                  
                  {/* Online Status */}
                  {profile.online_status && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-white text-[10px]">Online</span>
                    </div>
                  )}

                  {/* Quick Actions for Discover */}
                  {activeTab === 'new' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handlePass(profile.id); }} className="p-3 bg-white rounded-full text-gray-700 hover:scale-110 transition-transform">✕</button>
                      <button onClick={(e) => { e.stopPropagation(); handleLike(profile.id); }} className="p-4 bg-pink-500 rounded-full text-white hover:scale-125 transition-transform shadow-lg shadow-pink-500/30">❤️</button>
                      <button onClick={(e) => { e.stopPropagation(); handleAddFriend(profile.id, profile.name); }} className="p-3 bg-white rounded-full text-gray-700 hover:bg-blue-500 hover:text-white transition-all">👤</button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {profile.name}{profile.age ? `, ${profile.age}` : ''}
                  </h3>
                  {profile.bio && <p className={`text-[11px] mt-0.5 line-clamp-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{profile.bio}</p>}
                  
                  {/* Action buttons for matches/friends */}
                  {activeTab === 'matches' && (
                    <Link to={`/messages/${profile.id}`} className="block mt-2 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-xs font-medium text-center hover:shadow-lg transition-all">
                      Message 💬
                    </Link>
                  )}
                  {activeTab === 'friends' && (
                    <div className="flex gap-2 mt-2">
                      <Link to={`/messages/${profile.id}`} className="flex-1 py-2 bg-pink-500 text-white rounded-lg text-xs font-medium text-center hover:bg-pink-600 transition-all">
                        Chat
                      </Link>
                      <button onClick={(e) => { e.stopPropagation(); handleUnfriend(profile.id, profile.name); }} className="px-3 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500 hover:text-white transition-all">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
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

      {selectedUserModal && (
        <UserProfileModal
          userId={selectedUserModal}
          onClose={() => setSelectedUserModal(null)}
          onLike={async (id) => { await handleLike(id); setSelectedUserModal(null); }}
          onPass={async (id) => { await handlePass(id); setSelectedUserModal(null); }}
          currentUser={user}
        />
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}