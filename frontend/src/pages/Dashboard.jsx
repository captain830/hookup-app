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
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ==================== ENHANCED POSTS FEED ====================
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
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Handle media selection
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

  // Create new post
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

  // Delete post - ONLY creator can delete
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

  // Like/Unlike post
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
            likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Add comment
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

  // Format time
  const formatTimeAgo = (dateString) => {
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
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-pink-200 dark:border-pink-900/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-500 animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Create Post Trigger Card */}
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
            isDark ? 'bg-gray-700/50 text-gray-400 group-hover:text-gray-300' : 'bg-gray-50 text-gray-500 group-hover:text-gray-600'
          } transition-colors`}>
            What's on your mind? 💭
          </div>
          <div className="flex items-center gap-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-lg">📷</span>
            <span className="text-lg">🎥</span>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl shadow-2xl overflow-hidden`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Create Post</h3>
              <button 
                onClick={() => setShowCreatePost(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share your thoughts..."
                className={`w-full p-3 rounded-xl resize-none text-sm outline-none ${
                  isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 text-gray-800 placeholder-gray-400'
                } focus:ring-2 focus:ring-pink-500/50 transition-all`}
                rows={4}
                autoFocus
              />
              
              {/* Media Preview */}
              {newPostPreview && (
                <div className="mt-3 relative rounded-xl overflow-hidden">
                  {newPostMedia?.type.startsWith('video') ? (
                    <video src={newPostPreview} controls className="w-full max-h-64 object-cover" />
                  ) : (
                    <img src={newPostPreview} alt="Preview" className="w-full max-h-64 object-cover" />
                  )}
                  <button
                    onClick={() => { setNewPostMedia(null); setNewPostPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className={`flex items-center justify-between p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-pink-400' : 'hover:bg-gray-100 text-gray-500 hover:text-pink-500'
                  }`}
                  title="Add photo"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaSelect}
                  className="hidden"
                />
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {newPostContent.length}/500
                </span>
              </div>
              
              <button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() && !newPostMedia || creatingPost}
                className="px-5 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-medium 
                  hover:shadow-lg hover:shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed 
                  transition-all duration-300 active:scale-95"
              >
                {creatingPost ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Posting...
                  </span>
                ) : 'Share Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-sm ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl shadow-2xl p-6`}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>Delete Post?</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePost(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-6xl mb-4 animate-bounce-slow">📝</div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>No Posts Yet</h3>
          <p className="text-sm">Be the first to share something with the community!</p>
        </div>
      ) : (
        posts.map(post => (
          <article 
            key={post.id} 
            className={`${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} 
              rounded-2xl shadow-sm border hover:shadow-md transition-all duration-300 overflow-hidden animate-fade-in-up`}
          >
            {/* Post Header */}
            <div className="p-4 pb-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Link to={`/profile/${post.user_id}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden ring-2 ring-pink-500/20">
                      {post.user_photo ? (
                        <img src={fixImageUrl(post.user_photo)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">{post.user_name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  </Link>
                  <div>
                    <Link 
                      to={`/profile/${post.user_id}`} 
                      className={`font-semibold text-sm hover:underline ${isDark ? 'text-white' : 'text-gray-800'}`}
                    >
                      {post.user_name}
                    </Link>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatTimeAgo(post.created_at)}
                      {post.location && ` • 📍 ${post.location}`}
                    </p>
                  </div>
                </div>
                
                {/* Delete button - ONLY visible to post creator */}
                {currentUser?.id === post.user_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(post.id); }}
                    className={`p-2 rounded-lg opacity-0 group-hover/post:opacity-100 hover:bg-red-500/10 transition-all ${
                      isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                    }`}
                    title="Delete post"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Post Content */}
            {post.content && (
              <div className="px-4 pt-3">
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  {post.content}
                </p>
              </div>
            )}

            {/* Post Media */}
            {post.media_url && (
              <div className="mt-3 mx-4 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5">
                {post.media_type === 'video' ? (
                  <video 
                    src={fixImageUrl(post.media_url)} 
                    controls 
                    className="w-full max-h-[500px] object-contain"
                    poster={post.media_url?.replace(/\.[^.]+$/, '.jpg')}
                  />
                ) : (
                  <img 
                    src={fixImageUrl(post.media_url)} 
                    alt="Post media" 
                    className="w-full max-h-[500px] object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                    onClick={() => window.open(fixImageUrl(post.media_url), '_blank')}
                  />
                )}
              </div>
            )}

            {/* Post Actions Bar */}
            <div className={`px-4 py-3 mt-2 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {/* Like Button */}
                  <button
                    onClick={() => handleLikePost(post.id, post.is_liked)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      post.is_liked
                        ? 'bg-pink-500/10 text-pink-500'
                        : isDark ? 'text-gray-400 hover:text-pink-400 hover:bg-pink-500/5' : 'text-gray-500 hover:text-pink-500 hover:bg-pink-50'
                    }`}
                  >
                    <span className={`text-sm transition-transform duration-300 ${post.is_liked ? 'scale-110' : ''}`}>
                      {post.is_liked ? '❤️' : '🤍'}
                    </span>
                    <span>{post.likes_count || 0}</span>
                  </button>
                  
                  {/* Comment Button */}
                  <button
                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isDark ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/5' : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <span className="text-sm">💬</span>
                    <span>{post.comments_count || 0}</span>
                  </button>
                  
                  {/* Share Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                      toast.success('Link copied! 📋');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isDark ? 'text-gray-400 hover:text-green-400 hover:bg-green-500/5' : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
                    }`}
                  >
                    <span className="text-sm">🔄</span>
                    <span>{post.shares_count || 0}</span>
                  </button>
                </div>
                
                {/* Stats Summary */}
                {(post.likes_count > 0 || post.comments_count > 0) && (
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {post.likes_count > 0 && `${post.likes_count} likes`}
                    {post.likes_count > 0 && post.comments_count > 0 && ' • '}
                    {post.comments_count > 0 && `${post.comments_count} comments`}
                  </span>
                )}
              </div>
            </div>

            {/* Comments Section */}
            {expandedPost === post.id && (
              <div className={`px-4 pb-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                {/* Existing Comments */}
                {post.comments?.length > 0 && (
                  <div className="py-3 space-y-2.5 max-h-60 overflow-y-auto scrollbar-thin">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">{comment.user_name?.[0]}</span>
                        </div>
                        <div className={`flex-1 px-3 py-1.5 rounded-xl text-xs ${
                          isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                        }`}>
                          <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                            {comment.user_name}
                          </span>
                          <p className={`mt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add Comment Input */}
                <div className="flex items-center gap-2 pt-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">
                      {currentUser?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={commentText[post.id] || ''}
                      onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                      placeholder="Write a comment..."
                      className={`w-full py-2 px-3 pr-12 rounded-xl text-xs outline-none ${
                        isDark ? 'bg-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-800 placeholder-gray-400'
                      } focus:ring-2 focus:ring-pink-500/30 transition-all`}
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!commentText[post.id]?.trim() || submittingComment[post.id]}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-pink-500 hover:text-pink-600 disabled:opacity-30 transition-colors"
                    >
                      {submittingComment[post.id] ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500/5 to-purple-600/5 
            text-pink-500 hover:text-pink-600 font-medium text-sm transition-all hover:shadow-md
            border border-pink-500/20 hover:border-pink-500/40"
        >
          Load More Posts ↓
        </button>
      )}
    </div>
  );
}

// ==================== UNIFIED USER CARD COMPONENT ====================
function UserCard({ user, variant = 'discover', onAction, swiping, friendRequests, currentUser }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    switch(variant) {
      case 'match':
        return {
          badge: { text: '💕 Match', bg: 'from-green-400 to-emerald-500' },
          gradient: 'from-pink-400 to-purple-500',
          action: (
            <Link
              to={`/messages/${user.id}`}
              className="flex-1 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-xs font-medium text-center hover:shadow-lg transition-all"
            >
              Message 💬
            </Link>
          )
        };
      case 'friend':
        return {
          badge: { text: '👥 Friend', bg: 'from-blue-400 to-indigo-500' },
          gradient: 'from-blue-400 to-indigo-500',
          action: (
            <button
              onClick={(e) => { e.stopPropagation(); onAction('unfriend', user.id, user.name); }}
              className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
            >
              Unfriend
            </button>
          )
        };
      default:
        return {
          badge: null,
          gradient: 'from-pink-400 to-purple-500',
          action: null
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative ${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} 
        rounded-2xl overflow-hidden shadow-sm border hover:shadow-2xl hover:shadow-pink-500/10 
        transition-all duration-500 hover:-translate-y-1.5 cursor-pointer`}
    >
      {/* Photo Container */}
      <div className={`aspect-[3/4] relative overflow-hidden bg-gradient-to-br ${styles.gradient}`}>
        {user.photos?.[0] && !imgError ? (
          <img
            src={fixImageUrl(user.photos[0])}
            alt={user.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl font-bold text-white/90 drop-shadow-lg">
              {user.name?.[0]?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Hover Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent 
          opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
          {styles.badge && (
            <span className={`px-2.5 py-1 bg-gradient-to-r ${styles.badge.bg} text-white text-[10px] 
              font-bold rounded-full shadow-lg backdrop-blur-sm`}>
              {styles.badge.text}
            </span>
          )}
          {user.is_premium && variant === 'discover' && (
            <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[10px] 
              font-bold rounded-full shadow-lg flex items-center gap-1">
              <span>⭐</span> PRO
            </span>
          )}
        </div>

        {/* Online Status */}
        {user.online_status && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 
            bg-black/50 backdrop-blur-sm rounded-full border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-white text-[10px] font-medium">Online</span>
          </div>
        )}

        {/* Quick Actions Overlay - Only for Discover variant */}
        {variant === 'discover' && (
          <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('pass', user.id); }}
              disabled={swiping?.[user.id]}
              className="p-3 bg-white/95 hover:bg-gray-200 rounded-full text-gray-700 
                transform hover:scale-110 hover:rotate-12 transition-all duration-300 shadow-xl backdrop-blur-sm"
              title="Pass"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('like', user.id, e); }}
              disabled={swiping?.[user.id]}
              className="p-4 bg-pink-500 hover:bg-pink-600 rounded-full text-white 
                transform hover:scale-125 transition-all duration-300 shadow-xl shadow-pink-500/30 animate-pulse-slow"
              title="Like"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('friend', user.id, user.name); }}
              disabled={friendRequests?.[user.id]}
              className="p-3 bg-white/95 hover:bg-blue-500 rounded-full text-gray-700 hover:text-white 
                transform hover:scale-110 transition-all duration-300 shadow-xl backdrop-blur-sm"
              title="Add Friend"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {user.name}
              {user.age && <span className={`font-normal ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user.age}</span>}
              {user.is_verified && <span className="text-blue-500 ml-1 text-xs" title="Verified">✓</span>}
            </h3>
            {user.bio && (
              <p className={`text-[11px] mt-1 line-clamp-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {user.bio}
              </p>
            )}
          </div>
          {variant === 'friend' && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction('unfriend', user.id, user.name); }}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
              title="Remove friend"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Variant-specific action button */}
        {styles.action && (
          <div className="mt-3">
            {styles.action}
          </div>
        )}
      </div>

      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent 
        -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('new');
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
  const [selectedUserModal, setSelectedUserModal] = useState(null);
  
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

  // Unified action handler
  const handleAction = async (action, userId, extra) => {
    switch(action) {
      case 'like':
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
          fetchUsers();
        } catch (error) {
          toast.error('Failed to like');
        } finally {
          setSwiping(prev => ({ ...prev, [userId]: false }));
        }
        break;

      case 'pass':
        if (swiping[userId]) return;
        setSwiping(prev => ({ ...prev, [userId]: true }));
        try {
          const token = localStorage.getItem('token');
          await axios.post(`${API_URL}/matches/swipe`, {
            targetUserId: userId, action: 'pass'
          }, { headers: { 'Authorization': `Bearer ${token}` } });
          fetchUsers();
        } catch (error) {
          toast.error('Failed to pass');
        } finally {
          setSwiping(prev => ({ ...prev, [userId]: false }));
        }
        break;

      case 'friend':
        if (friendRequests[userId]) return;
        setFriendRequests(prev => ({ ...prev, [userId]: true }));
        try {
          const token = localStorage.getItem('token');
          await axios.post(`${API_URL}/friends/request/${userId}`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          toast.success(`Friend request sent to ${extra}! 👥`);
        } catch (error) {
          toast.error('Failed to send friend request');
        } finally {
          setFriendRequests(prev => ({ ...prev, [userId]: false }));
        }
        break;

      case 'unfriend':
        if (confirm(`Remove ${extra} from your friends?`)) {
          try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/friends/${userId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success(`${extra} removed from friends`);
            fetchUsers();
          } catch (error) {
            toast.error('Failed to remove friend');
          }
        }
        break;
    }
  };

  const tabs = [
    { id: 'posts', label: 'Posts', icon: '🌐', count: null },
    { id: 'new', label: 'Discover', icon: '✨', count: counts?.new_people || 0 },
    { id: 'matches', label: 'Matches', icon: '💕', count: counts?.matches || 0 },
    { id: 'friends', label: 'Friends', icon: '👥', count: counts?.friends || 0 },
  ];

  const getVariantForTab = (tabId) => {
    switch(tabId) {
      case 'matches': return 'match';
      case 'friends': return 'friend';
      default: return 'discover';
    }
  };

  if (loading && activeTab !== 'posts') {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-pink-200/20 animate-ping"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">💕</div>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading amazing people...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} transition-colors duration-500`}>
      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        
        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
              {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {activeTab === 'posts' ? 'Community feed' : `${users.length} people found`}
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2.5 rounded-xl ${isDark ? 'bg-[#1a1a2e] text-gray-400 hover:text-white' : 'bg-white text-gray-500 hover:text-gray-700'} 
                  shadow-sm hover:shadow-md transition-all border ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {showSearch && (
                <div className="absolute right-0 top-full mt-2 w-72 z-30 animate-slide-down">
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none shadow-xl ${
                      isDark ? 'bg-[#1a1a2e] text-white border-gray-700' : 'bg-white text-gray-800 border-gray-200'
                    } border focus:ring-2 focus:ring-pink-500/50`}
                    autoFocus
                  />
                </div>
              )}
            </div>
            
            {/* Messages Link */}
            <Link
              to="/messages"
              className={`p-2.5 rounded-xl relative ${isDark ? 'bg-[#1a1a2e] text-gray-400 hover:text-white' : 'bg-white text-gray-500 hover:text-gray-700'} 
                shadow-sm hover:shadow-md transition-all border ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse ring-2 ring-white dark:ring-[#0a0a0a]"></span>
            </Link>
          </div>
        </div>

        {/* ===== NAVIGATION TABS ===== */}
        <div className={`flex rounded-2xl overflow-hidden mb-5 ${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-100'} 
          shadow-sm border p-1`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-xl transition-all duration-300 relative ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25'
                  : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* ===== STORIES ===== */}
        <div className="mb-5">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setShowStatusUpload(!showStatusUpload)}
              className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-pink-500 
                flex items-center justify-center text-xl sm:text-2xl transition-all duration-300
                ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} 
                group-hover:scale-110 group-hover:border-pink-400 group-hover:shadow-lg group-hover:shadow-pink-500/20`}
              >
                {myStatuses.length > 0 ? '📖' : '+'}
              </div>
              <span className={`text-[10px] sm:text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'} 
                group-hover:text-pink-500 transition-colors`}>
                My Story
              </span>
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
            <div className="mt-4 animate-slide-down">
              <StatusUpload
                onUpload={() => { fetchStories(); setShowStatusUpload(false); }}
                onClose={() => setShowStatusUpload(false)}
              />
            </div>
          )}
        </div>

        {/* ===== CONTENT AREA ===== */}
        <div>
          {/* Posts Feed */}
          {activeTab === 'posts' && <PostsFeed currentUser={user} />}

          {/* Empty States */}
          {activeTab !== 'posts' && users.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4 animate-bounce-slow">
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
                <button
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl 
                    font-medium text-sm hover:shadow-xl hover:shadow-pink-500/25 hover:scale-105 active:scale-95 transition-all"
                >
                  Discover People ✨
                </button>
              )}
            </div>
          )}

          {/* User Grids */}
          {activeTab !== 'posts' && users.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {users.map((userData, index) => (
                <div 
                  key={userData.id}
                  onClick={() => setSelectedUserModal(userData.id)}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-fade-in-up"
                >
                  <UserCard
                    user={userData}
                    variant={getVariantForTab(activeTab)}
                    onAction={handleAction}
                    swiping={swiping}
                    friendRequests={friendRequests}
                    currentUser={user}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}
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
          onLike={async (id) => { await handleAction('like', id); setSelectedUserModal(null); }}
          onPass={async (id) => { await handleAction('pass', id); setSelectedUserModal(null); }}
          currentUser={user}
        />
      )}

      {/* ===== ANIMATIONS ===== */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(236, 72, 153, 0.3); border-radius: 10px; }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out both; }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}