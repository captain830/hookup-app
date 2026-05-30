import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// SVG Icon Components
const Icons = {
  Globe: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  Compass: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18V4m-8 8h16" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8l2 6 6 2-2-6-6-2z" />
    </svg>
  ),
  Chat: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Users: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  UserPlus: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  Heart: ({ className = "w-5 h-5", filled = false }) => (
    <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  HeartFilled: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ),
  Comment: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
    </svg>
  ),
  Share: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  ),
  Image: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  ),
  Smile: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
    </svg>
  ),
  MapPin: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  Send: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  Ellipsis: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  ),
  Sparkles: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  CheckBadge: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  ),
  Star: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
  ),
  ArrowPath: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
    </svg>
  ),
  Database: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  ),
  ExclamationTriangle: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

export default function CommunityFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPost, setNewPost] = useState('');
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaPreview, setPostMediaPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [commentInput, setCommentInput] = useState({});
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [sharingPost, setSharingPost] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionUsers, setMentionUsers] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchPosts();
  }, [activeFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('auth');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { filter: activeFilter, limit: 20, offset: 0 }
      });
      
      setPosts(response.data.posts || []);
      setRetryCount(0);
    } catch (error) {
      console.error('Error fetching posts:', error);
      
      if (error.response?.status === 500 || error.response?.data?.error?.includes('relation') || error.response?.data?.error?.includes('does not exist')) {
        setError('table_missing');
      } else if (error.response?.status === 401) {
        setError('auth');
      } else if (error.response?.status === 404) {
        setError('endpoint');
      } else {
        setError('connection');
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => fetchPosts(), 2000);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !postMedia) return;
    setPosting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('content', newPost);
      if (postMedia) formData.append('media', postMedia);

      const response = await axios.post(`${API_URL}/posts`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setPosts(prev => [response.data.post, ...prev]);
      setNewPost('');
      setPostMedia(null);
      setPostMediaPreview(null);
      toast.success('Post created!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(error.response?.data?.error || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const isLiked = likedPosts.has(postId);
      
      if (isLiked) {
        await axios.delete(`${API_URL}/posts/${postId}/like`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p
        ));
      } else {
        await axios.post(`${API_URL}/posts/${postId}/like`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setLikedPosts(prev => new Set(prev).add(postId));
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleAddComment = async (postId) => {
    const comment = commentInput[postId];
    if (!comment?.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/posts/${postId}/comment`, 
        { content: comment },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setPosts(prev => prev.map(p => 
        p.id === postId ? { 
          ...p, 
          comments: [...(p.comments || []), response.data.comment],
          comments_count: (p.comments_count || 0) + 1 
        } : p
      ));
      setCommentInput(prev => ({ ...prev, [postId]: '' }));
      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleSharePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/posts/${postId}/share`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p
      ));
      setSharingPost(null);
      toast.success('Post shared!');
    } catch (error) {
      console.error('Error sharing post:', error);
      toast.error('Failed to share post');
    }
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum 10MB');
        return;
      }
      setPostMedia(file);
      const reader = new FileReader();
      reader.onloadend = () => setPostMediaPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewPost(value);
    setCursorPosition(position);
    
    const textBeforeCursor = value.slice(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentions(true);
      fetchMentionUsers(mentionMatch[1]);
    } else {
      setShowMentions(false);
    }
  };

  const fetchMentionUsers = async (query) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/posts/mentions/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMentionUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const insertMention = (username) => {
    const before = newPost.slice(0, cursorPosition);
    const after = newPost.slice(cursorPosition);
    const mentionStart = before.lastIndexOf('@');
    const newText = before.slice(0, mentionStart) + `@${username} ` + after;
    setNewPost(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filterTabs = [
    { id: 'all', label: 'All Posts', icon: Icons.Globe },
    { id: 'friends', label: 'Friends', icon: Icons.Users },
    { id: 'new', label: 'New People', icon: Icons.Sparkles },
    { id: 'matches', label: 'Matches', icon: Icons.Heart },
  ];

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Database migration prompt
  const DatabaseMigrationPrompt = () => (
    <div className={`${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 animate-fade-in`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDark ? 'bg-amber-500/10' : 'bg-amber-100'} flex items-center justify-center`}>
          <Icons.Database className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-800'} text-sm sm:text-base mb-1`}>
            Database Setup Required
          </h3>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs sm:text-sm mb-3`}>
            The posts feature requires database tables. Run this SQL in your Neon database SQL Editor:
          </p>
          <div className={`${isDark ? 'bg-[#0a0a0a] border-gray-700' : 'bg-gray-900 border-gray-700'} border rounded-lg p-3 mb-3 overflow-x-auto`}>
            <pre className="text-green-400 text-[10px] sm:text-xs font-mono whitespace-pre-wrap leading-relaxed">
{`CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const sql = `CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, content TEXT, media_url TEXT, media_type VARCHAR(10), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS likes (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, post_id INTEGER NOT NULL REFERENCES posts(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, post_id)); CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, post_id INTEGER NOT NULL REFERENCES posts(id), content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS shares (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, post_id INTEGER NOT NULL REFERENCES posts(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`;
                navigator.clipboard.writeText(sql);
                toast.success('SQL copied to clipboard!');
              }}
              className="px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy SQL
            </button>
            <button
              onClick={fetchPosts}
              className="px-3 sm:px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Icons.ArrowPath className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]'} transition-colors duration-500`}>
      <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        
        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20`}>
              <Icons.Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} tracking-tight`}>
                Community Feed
              </h1>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs sm:text-sm mt-0.5`}>
                Share moments & connect with people
              </p>
            </div>
          </div>
          
          {/* Quick Navigation */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 ${isDark ? 'bg-[#1a1a2e] text-gray-300 hover:bg-[#252545]' : 'bg-white text-gray-700 hover:bg-gray-50'} rounded-xl text-sm font-medium transition-all border ${isDark ? 'border-gray-700' : 'border-gray-200'} hover:scale-105 active:scale-95`}
            >
              <Icons.Compass className="w-4 h-4" />
              <span className="hidden sm:inline">Discover</span>
            </Link>
            <Link
              to="/chats"
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 ${isDark ? 'bg-[#1a1a2e] text-gray-300 hover:bg-[#252545]' : 'bg-white text-gray-700 hover:bg-gray-50'} rounded-xl text-sm font-medium transition-all border ${isDark ? 'border-gray-700' : 'border-gray-200'} hover:scale-105 active:scale-95`}
            >
              <Icons.Chat className="w-4 h-4" />
              <span className="hidden sm:inline">Chats</span>
            </Link>
          </div>
        </div>

        {/* Database Migration Prompt */}
        {error === 'table_missing' && <DatabaseMigrationPrompt />}

        {/* ===== FILTER TABS ===== */}
        <div className="mb-4 sm:mb-6">
          <div className="hidden sm:flex items-center gap-2">
            {filterTabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeFilter === tab.id
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25 scale-105'
                      : `${isDark ? 'bg-[#1a1a2e] text-gray-400 hover:text-white border-gray-700' : 'bg-white text-gray-600 hover:text-gray-800 border-gray-200'} border hover:shadow-md`
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Filter Dropdown */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`w-full flex items-center justify-between px-4 py-3 ${isDark ? 'bg-[#1a1a2e] text-gray-300 border-gray-700' : 'bg-white text-gray-700 border-gray-200'} border rounded-xl text-sm font-medium transition-all`}
            >
              <span className="flex items-center gap-2">
                {(() => {
                  const active = filterTabs.find(t => t.id === activeFilter);
                  const ActiveIcon = active?.icon || Icons.Globe;
                  return <ActiveIcon className="w-4 h-4" />;
                })()}
                {filterTabs.find(t => t.id === activeFilter)?.label}
              </span>
              <svg className={`w-5 h-5 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFilterDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-2 ${isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up`}>
                {filterTabs.map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveFilter(tab.id); setShowFilterDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        activeFilter === tab.id
                          ? `${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-50 text-pink-600'} font-medium`
                          : `${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'}`
                      }`}
                    >
                      <TabIcon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== CREATE POST ===== */}
        <div className={`${isDark ? 'bg-[#1a1a2e] border-gray-700/50' : 'bg-white border-gray-200'} border rounded-2xl p-3 sm:p-4 lg:p-5 mb-4 sm:mb-6 shadow-sm hover:shadow-md transition-shadow`}>
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {user?.photos?.[0] ? (
                <img src={fixImageUrl(user.photos[0])} alt="" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-pink-500 ring-offset-2 ring-offset-transparent" />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-base ring-2 ring-pink-500 ring-offset-2 ring-offset-transparent">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newPost}
                onChange={handleTextareaChange}
                placeholder="What's on your mind? Share with the community..."
                rows="3"
                className={`w-full ${isDark ? 'bg-[#0a0a0a] text-gray-100 placeholder-gray-500 border-gray-700' : 'bg-gray-50 text-gray-800 placeholder-gray-400 border-gray-200'} border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all`}
              />
              
              {showMentions && mentionUsers.length > 0 && (
                <div className={`absolute bottom-full left-0 right-0 mb-2 ${isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50`}>
                  {mentionUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u.name)}
                      className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-sm ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-50 text-gray-700'} transition-colors`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span>@{u.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {postMediaPreview && (
                <div className="relative mt-2 group">
                  <img src={postMediaPreview} alt="Preview" className="rounded-xl max-h-48 w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl"></div>
                  <button
                    onClick={() => { setPostMedia(null); setPostMediaPreview(null); }}
                    className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-green-400' : 'hover:bg-gray-100 text-gray-500 hover:text-green-500'}`}
                    title="Add image or video"
                  >
                    <Icons.Image className="w-5 h-5" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                  
                  <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-yellow-400' : 'hover:bg-gray-100 text-gray-500 hover:text-yellow-500'}`} title="Add emoji">
                    <Icons.Smile className="w-5 h-5" />
                  </button>
                  
                  <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-500 hover:text-red-500'}`} title="Add location">
                    <Icons.MapPin className="w-5 h-5" />
                  </button>
                </div>
                
                <button
                  onClick={handleCreatePost}
                  disabled={posting || (!newPost.trim() && !postMedia)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {posting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Posting
                    </>
                  ) : (
                    <>
                      <Icons.Send className="w-4 h-4" />
                      Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== LOADING SKELETONS ===== */}
        {loading && (
          <div className="space-y-3 sm:space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className={`${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl p-4 sm:p-5 animate-pulse`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== CONNECTION ERROR ===== */}
        {!loading && error === 'connection' && (
          <div className={`text-center py-12 sm:py-16 ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${isDark ? 'bg-red-500/10' : 'bg-red-100'} flex items-center justify-center`}>
              <Icons.ExclamationTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>Connection Error</h2>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mb-4`}>Unable to load posts. Please check your connection.</p>
            <button onClick={fetchPosts} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all">
              <Icons.ArrowPath className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* ===== EMPTY STATE ===== */}
        {!loading && !error && posts.length === 0 && (
          <div className={`text-center py-12 sm:py-16 ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} rounded-2xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full ${isDark ? 'bg-pink-500/10' : 'bg-pink-100'} flex items-center justify-center`}>
              <Icons.Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-pink-500" />
            </div>
            <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>No Posts Yet</h2>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}>Be the first to share something with the community!</p>
          </div>
        )}

        {/* ===== POSTS LIST ===== */}
        {!loading && !error && posts.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {posts.map((post, index) => (
              <div
                key={post.id}
                className={`group ${isDark ? 'bg-[#1a1a2e] border-gray-700/50 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'} border rounded-2xl p-3 sm:p-4 lg:p-5 transition-all duration-300 hover:shadow-lg animate-fade-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Post Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {post.user_photo ? (
                      <img src={fixImageUrl(post.user_photo)} alt="" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-pink-500/30" />
                    ) : (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-pink-500/30">
                        {post.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'} text-sm`}>
                          {post.user_name}
                        </h3>
                        {post.is_friend && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'} font-medium`}>
                            Friend
                          </span>
                        )}
                        {post.is_match && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-600'} font-medium flex items-center gap-0.5`}>
                            <Icons.HeartFilled className="w-2.5 h-2.5" />
                            Match
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {getTimeAgo(post.created_at)}
                        {post.location && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <Icons.MapPin className="w-3 h-3" />
                            {post.location}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}>
                    <Icons.Ellipsis className="w-4 h-4" />
                  </button>
                </div>

                {/* Post Content */}
                {post.content && (
                  <div className={`mb-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} whitespace-pre-wrap break-words leading-relaxed`}>
                    {post.content}
                  </div>
                )}

                {/* Post Media */}
                {post.media_url && (
                  <div className="mb-3 -mx-3 sm:-mx-4 lg:-mx-5">
                    {post.media_type === 'video' ? (
                      <video src={fixImageUrl(post.media_url)} controls className="w-full max-h-96 object-cover" />
                    ) : (
                      <img src={fixImageUrl(post.media_url)} alt="Post media" className="w-full max-h-96 object-cover" />
                    )}
                  </div>
                )}

                {/* Post Actions */}
                <div className={`flex items-center gap-1 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                  <button
                    onClick={() => handleLikePost(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${
                      likedPosts.has(post.id)
                        ? 'text-pink-500'
                        : `${isDark ? 'text-gray-500 hover:text-pink-400' : 'text-gray-400 hover:text-pink-500'}`
                    }`}
                  >
                    {likedPosts.has(post.id) ? (
                      <Icons.HeartFilled className="w-5 h-5 sm:w-5 sm:h-5" />
                    ) : (
                      <Icons.Heart className="w-5 h-5 sm:w-5 sm:h-5" />
                    )}
                    <span className="text-xs sm:text-sm font-medium">{post.likes_count || 0}</span>
                  </button>

                  <button
                    onClick={() => setExpandedComments(prev => {
                      const newSet = new Set(prev);
                      newSet.has(post.id) ? newSet.delete(post.id) : newSet.add(post.id);
                      return newSet;
                    })}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`}
                  >
                    <Icons.Comment className="w-5 h-5 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm font-medium">{post.comments_count || 0}</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setSharingPost(sharingPost === post.id ? null : post.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${isDark ? 'text-gray-500 hover:text-green-400' : 'text-gray-400 hover:text-green-500'}`}
                    >
                      <Icons.Share className="w-5 h-5 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium">{post.shares_count || 0}</span>
                    </button>
                    
                    {sharingPost === post.id && (
                      <div className={`absolute bottom-full left-0 mb-2 ${isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-1.5 z-50 animate-slide-up min-w-[160px]`}>
                        <button
                          onClick={() => handleSharePost(post.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-50 text-gray-700'} transition-colors`}
                        >
                          <Icons.Share className="w-4 h-4" />
                          Share to Feed
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                            toast.success('Link copied!');
                            setSharingPost(null);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-50 text-gray-700'} transition-colors`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Copy Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                {expandedComments.has(post.id) && (
                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                    {/* Comment Input */}
                    <div className="flex gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={commentInput[post.id] || ''}
                          onChange={(e) => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          placeholder="Write a comment..."
                          className={`flex-1 ${isDark ? 'bg-[#0a0a0a] text-gray-100 placeholder-gray-500 border-gray-700' : 'bg-gray-50 text-gray-800 placeholder-gray-400 border-gray-200'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all`}
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!commentInput[post.id]?.trim()}
                          className="px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          <Icons.Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(post.comments || []).map((comment, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {comment.user_name?.charAt(0) || '?'}
                          </div>
                          <div className={`flex-1 ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'} rounded-lg px-3 py-2`}>
                            <p className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {comment.user_name}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== LOAD MORE ===== */}
        {!loading && !error && posts.length > 0 && posts.length >= 20 && (
          <div className="text-center mt-6">
            <button
              onClick={fetchPosts}
              className={`inline-flex items-center gap-2 px-6 py-3 ${isDark ? 'bg-[#1a1a2e] text-gray-300 hover:bg-[#252545] border-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'} border rounded-xl font-medium text-sm hover:shadow-md transition-all`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
              </svg>
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}