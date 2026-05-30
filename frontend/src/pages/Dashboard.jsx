import { useState, useEffect } from 'react';
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

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState({});
  const [stories, setStories] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState(null);
  const [selectedStoryStatuses, setSelectedStoryStatuses] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [friendRequests, setFriendRequests] = useState({});
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'online', 'matches', 'new'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [particles, setParticles] = useState([]);
  const [showSparkle, setShowSparkle] = useState(false);
  const [sparklePosition, setSparklePosition] = useState({ x: 0, y: 0 });
  
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Generate floating particles for background
  useEffect(() => {
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
      opacity: Math.random() * 0.3 + 0.1
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStories();
  }, []);

  // Filter users based on active filter
  useEffect(() => {
    let filtered = users;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.bio && user.bio.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Apply category filter
    switch(activeFilter) {
      case 'online':
        filtered = filtered.filter(u => u.online_status);
        break;
      case 'matches':
        filtered = filtered.filter(u => u.is_matched);
        break;
      case 'new':
        filtered = filtered.filter(u => !u.my_swipe_action && !u.is_matched);
        break;
      default:
        break;
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, users, activeFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.get(`${API_URL}/users/discover`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        logout();
        navigate('/login');
      } else {
        toast.error('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

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

  // Sparkle animation on like
  const createSparkle = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSparklePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setShowSparkle(true);
    setTimeout(() => setShowSparkle(false), 600);
  };

  const handleLike = async (targetUserId, e) => {
    if (swiping[targetUserId]) return;
    createSparkle(e);
    setSwiping(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId, action: 'like'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.data.matched) {
        toast.success("💕 It's a Match! 💕", { 
          duration: 5000,
          style: {
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            color: 'white',
            fontWeight: 'bold'
          }
        });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId ? { ...u, my_swipe_action: 'like', is_matched: true } : u
        ));
      } else {
        toast.success('Liked! 💕', { duration: 1500 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId ? { ...u, my_swipe_action: 'like' } : u
        ));
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to like');
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
      toast.success('Passed 👎', { duration: 1000 });
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, my_swipe_action: 'pass' } : u
      ));
    } catch (error) {
      toast.error('Failed to pass');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleLikeFromModal = async (targetUserId) => {
    if (swiping[targetUserId]) return;
    setSwiping(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId, action: 'like'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.data.matched) {
        toast.success("💕 It's a Match! 💕", { duration: 5000 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId ? { ...u, my_swipe_action: 'like', is_matched: true } : u
        ));
      } else {
        toast.success('Liked! 💕', { duration: 1500 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId ? { ...u, my_swipe_action: 'like' } : u
        ));
      }
      setSelectedUserForModal(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to like');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handlePassFromModal = async (targetUserId) => {
    if (swiping[targetUserId]) return;
    setSwiping(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/matches/swipe`, {
        targetUserId, action: 'pass'
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      toast.success('Passed 👎', { duration: 1000 });
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, my_swipe_action: 'pass' } : u
      ));
      setSelectedUserForModal(null);
    } catch (error) {
      toast.error('Failed to pass');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Add Friend handler
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
      toast.error(error.response?.data?.error || 'Failed to send friend request');
    } finally {
      setFriendRequests(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Filter tabs
  const filterTabs = [
    { id: 'all', label: '🌍 All', count: users.length },
    { id: 'online', label: '🟢 Online', count: users.filter(u => u.online_status).length },
    { id: 'matches', label: '💕 Matches', count: users.filter(u => u.is_matched).length },
    { id: 'new', label: '✨ New', count: users.filter(u => !u.my_swipe_action).length },
  ];

  // Theme classes
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]';
  const textMain = isDark ? 'text-gray-100' : 'text-gray-800';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-[#1a1a2e]' : 'bg-white';
  const cardBorder = isDark ? 'border-gray-700/50' : 'border-gray-100';
  const inputBg = isDark ? 'bg-[#1a1a2e] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800';
  const storyBg = isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white';

  if (loading) {
    return (
      <div className={`min-h-screen ${bgMain} flex items-center justify-center transition-colors duration-500 relative overflow-hidden`}>
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full bg-pink-500/20 animate-float"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                opacity: p.opacity
              }}
            />
          ))}
        </div>
        
        <div className="text-center animate-fade-in relative z-10">
          <div className="relative w-24 h-24 mx-auto">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-pink-200/30 dark:border-pink-900/30 animate-ping"></div>
            {/* Middle ring */}
            <div className="absolute inset-2 rounded-full border-4 border-purple-300/50 dark:border-purple-800/50 animate-spin-slow"></div>
            {/* Inner spinner */}
            <div className="absolute inset-4 rounded-full border-4 border-pink-200 dark:border-pink-800 animate-spin border-t-pink-500 border-r-purple-500 border-b-pink-500"></div>
            {/* Heart center */}
            <div className="absolute inset-0 flex items-center justify-center animate-pulse">
              <span className="text-3xl">💕</span>
            </div>
          </div>
          <p className={`mt-6 ${textSub} text-sm font-medium tracking-wide`}>
            Discovering amazing people near you...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain} transition-colors duration-500 relative`}>
      {/* Floating background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full animate-float"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: `radial-gradient(circle, ${isDark ? 'rgba(236,72,153,0.1)' : 'rgba(236,72,153,0.05)'}, transparent)`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 relative z-10">
        
        {/* ===== TOP BAR ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            {/* Quick Navigation to Feed */}
            <Link
              to="/"
              className={`group relative px-3 sm:px-4 py-2 ${isDark ? 'bg-[#1a1a2e] text-gray-300 hover:bg-[#252545]' : 'bg-white text-gray-700 hover:bg-gray-50'} rounded-xl text-sm font-medium transition-all duration-300 border ${isDark ? 'border-gray-700' : 'border-gray-200'} hover:scale-105 active:scale-95 overflow-hidden`}
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="text-lg group-hover:animate-bounce">🌐</span>
                <span className="hidden sm:inline">Feed</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-500"></div>
            </Link>
            
            <div>
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${textMain} tracking-tight flex items-center gap-2`}>
                Discover
                <span className="text-sm animate-pulse">✨</span>
              </h1>
              <p className={`${textSub} text-xs sm:text-sm mt-0.5`}>
                {filteredUsers.length} amazing people near you
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search with animated focus */}
            <div className="relative flex-1 sm:flex-none sm:w-64 lg:w-72 group">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${searchTerm ? 'text-pink-500' : isDark ? 'text-gray-500' : 'text-gray-400'} group-focus-within:text-pink-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-8 py-2 sm:py-2.5 ${inputBg} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all duration-300`}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 p-1 transition-colors animate-fade-in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* View Toggle with animation */}
            <div className={`flex rounded-lg overflow-hidden border ${cardBorder} shadow-sm`}>
              <button 
                onClick={() => setViewMode('grid')} 
                className={`p-2 transition-all duration-300 ${viewMode === 'grid' ? (isDark ? 'bg-pink-500/30 text-pink-400 scale-110' : 'bg-pink-50 text-pink-500 scale-110') : (isDark ? 'text-gray-500 hover:text-pink-400' : 'text-gray-400 hover:text-pink-500')}`}
                title="Grid View"
              >
                <svg className="w-4 h-4 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                </svg>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 transition-all duration-300 ${viewMode === 'list' ? (isDark ? 'bg-pink-500/30 text-pink-400 scale-110' : 'bg-pink-50 text-pink-500 scale-110') : (isDark ? 'text-gray-500 hover:text-pink-400' : 'text-gray-400 hover:text-pink-500')}`}
                title="List View"
              >
                <svg className="w-4 h-4 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ===== SMART FILTER TABS ===== */}
        <div className="mb-4 sm:mb-6">
          {/* Desktop Filter Tabs */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`group relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeFilter === tab.id
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25 scale-105'
                    : `${isDark ? 'bg-[#1a1a2e] text-gray-400 hover:text-white border-gray-700' : 'bg-white text-gray-600 hover:text-gray-800 border-gray-200'} border hover:shadow-md`
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeFilter === tab.id 
                        ? 'bg-white/20 text-white' 
                        : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </span>
                {activeFilter === tab.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl animate-pulse-slow opacity-50"></div>
                )}
              </button>
            ))}
          </div>

          {/* Mobile Filter Dropdown */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`w-full px-4 py-3 ${isDark ? 'bg-[#1a1a2e] text-gray-300 border-gray-700' : 'bg-white text-gray-700 border-gray-200'} border rounded-xl text-sm font-medium flex items-center justify-between transition-all shadow-sm hover:shadow-md`}
            >
              <span className="flex items-center gap-2">
                {filterTabs.find(t => t.id === activeFilter)?.label}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-300 ${showFilterDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showFilterDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-2 ${isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up`}>
                {filterTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveFilter(tab.id);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all ${
                      activeFilter === tab.id
                        ? `${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-50 text-pink-600'} font-medium`
                        : `${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'}`
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span>{tab.label}</span>
                      <span className="text-xs opacity-60">{tab.count}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== STORIES SECTION ===== */}
        <div className="mb-5 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Add Story Button with glow effect */}
            <button
              onClick={() => setShowStatusUpload(!showStatusUpload)}
              className="flex flex-col items-center flex-shrink-0 group relative"
            >
              <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full ${storyBg} border-2 border-dashed border-pink-500 flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 group-hover:scale-110 group-hover:border-pink-400 group-active:scale-95 group-hover:shadow-lg group-hover:shadow-pink-500/20`}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/0 to-purple-500/0 group-hover:from-pink-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
                {myStatuses.length > 0 ? (
                  <span className="text-lg relative z-10 animate-bounce-slow">📖</span>
                ) : (
                  <span className="text-pink-500 font-bold relative z-10 group-hover:scale-125 transition-transform">+</span>
                )}
                {myStatuses.length > 0 && (
                  <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-gray-900 animate-pulse">
                    {myStatuses.length}
                  </span>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs ${textSub} mt-1.5 truncate max-w-[60px] group-hover:text-pink-500 transition-colors`}>
                {myStatuses.length > 0 ? 'My Story' : 'Add Story'}
              </span>
            </button>
            
            {stories.map((userStory) => (
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
            <div className="mt-4 animate-slide-up">
              <StatusUpload 
                onUpload={() => { fetchStories(); setShowStatusUpload(false); }} 
                onClose={() => setShowStatusUpload(false)}
              />
            </div>
          )}
        </div>

        {/* ===== NO RESULTS ===== */}
        {searchTerm && filteredUsers.length === 0 && (
          <div className={`text-center py-16 sm:py-20 animate-fade-in`}>
            <div className="relative inline-block">
              <div className="text-5xl sm:text-6xl mb-4 animate-bounce-slow">🔍</div>
              <div className="absolute -top-2 -right-2 text-2xl animate-ping">✨</div>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold ${textMain} mb-2`}>No Results Found</h2>
            <p className={textSub}>No users matching "{searchTerm}"</p>
            <button 
              onClick={() => setSearchTerm('')} 
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-medium text-sm hover:shadow-lg hover:shadow-pink-500/25 hover:scale-105 transition-all active:scale-95"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* ===== USER CARDS GRID ===== */}
        {filteredUsers.length > 0 && (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4"
            : "flex flex-col gap-3 max-w-2xl mx-auto"
          }>
            {filteredUsers.map((profile, index) => (
              <div 
                key={profile.id}
                onClick={() => setSelectedUserForModal(profile.id)}
                onMouseEnter={() => setHoveredCard(profile.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`group relative ${cardBg} ${cardBorder} border rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-pink-500/10 hover:-translate-y-1.5 active:scale-[0.98] animate-fade-in`}
                style={{ 
                  animationDelay: `${index * 50}ms`,
                  transform: hoveredCard === profile.id ? 'translateY(-6px)' : 'translateY(0)'
                }}
              >
                {/* Image Section with overlay effects */}
                <div className={`relative overflow-hidden bg-gradient-to-br from-pink-400 via-purple-400 to-pink-500 ${viewMode === 'grid' ? 'aspect-[3/4] sm:aspect-[2/3]' : 'h-20 sm:h-24 w-20 sm:w-24 flex-shrink-0'}`}>
                  {profile.photos?.[0] ? (
                    <img 
                      src={fixImageUrl(profile.photos[0])}                      
                      alt={profile.name}
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-500">
                            <span class="text-4xl sm:text-5xl text-white font-bold drop-shadow-lg">${profile.name?.charAt(0)?.toUpperCase()}</span>
                          </div>`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl sm:text-5xl text-white font-bold drop-shadow-lg">{profile.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Premium badge with sparkle */}
                  {profile.is_premium && (
                    <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-yellow-400 to-amber-500 text-black px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 shadow-lg animate-pulse-slow">
                      <span className="animate-spin-slow">⭐</span>
                      <span>PRO</span>
                    </div>
                  )}
                  
                  {/* Match badge with celebration animation */}
                  {profile.is_matched && (
                    <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold shadow-lg animate-bounce-slow">
                      <span className="flex items-center gap-0.5">
                        <span className="animate-pulse">💕</span> MATCH
                      </span>
                    </div>
                  )}
                  
                  {/* Liked badge */}
                  {profile.my_swipe_action === 'like' && !profile.is_matched && (
                    <div className="absolute top-2 left-2 z-10 bg-pink-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold shadow-lg animate-pulse">
                      <span className="flex items-center gap-0.5">
                        <span className="animate-pulse">❤️</span> Liked
                      </span>
                    </div>
                  )}
                  
                  {/* Online status with breathing animation */}
                  {profile.online_status && (
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="text-white text-[9px] sm:text-[10px] font-medium">Online</span>
                    </div>
                  )}

                  {/* Quick action overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(profile.id, e); }}
                      className="p-2 bg-white/90 hover:bg-pink-500 rounded-full text-gray-700 hover:text-white transform hover:scale-110 transition-all duration-300 shadow-lg backdrop-blur-sm"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePass(profile.id); }}
                      className="p-2 bg-white/90 hover:bg-gray-700 rounded-full text-gray-700 hover:text-white transform hover:scale-110 transition-all duration-300 shadow-lg backdrop-blur-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Sparkle effect on like */}
                  {showSparkle && hoveredCard === profile.id && (
                    <div 
                      className="absolute pointer-events-none z-20"
                      style={{ left: sparklePosition.x - 20, top: sparklePosition.y - 20 }}
                    >
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 bg-pink-400 rounded-full animate-sparkle"
                          style={{
                            animationDelay: `${i * 0.05}s`,
                            transform: `rotate(${i * 60}deg) translateY(-20px)`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className={viewMode === 'grid' ? 'p-2 sm:p-3' : 'flex-1 p-2 sm:p-3 flex items-center'}>
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <h3 className={`font-semibold ${textMain} text-xs sm:text-sm truncate flex items-center gap-1`}>
                      {profile.name}, {profile.age}
                      {profile.is_verified && (
                        <span className="text-blue-500 text-xs" title="Verified">✓</span>
                      )}
                    </h3>
                    {viewMode === 'grid' && profile.bio && (
                      <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-[10px] sm:text-xs mt-0.5 line-clamp-1`}>
                        {profile.bio}
                      </p>
                    )}
                    {viewMode === 'list' && profile.bio && (
                      <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs mt-0.5 line-clamp-1`}>
                        {profile.bio}
                      </p>
                    )}
                  </div>
                  
                  {/* ===== ACTION ICONS with Hover Animations ===== */}
                  <div className={`flex items-center gap-1 sm:gap-1.5 flex-wrap ${viewMode === 'grid' ? 'mt-2 sm:mt-2.5' : 'flex-shrink-0 ml-2'}`}>
                    {/* Pass Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePass(profile.id); }}
                      disabled={swiping[profile.id]}
                      className={`relative p-1.5 sm:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 group/btn ${
                        isDark ? 'bg-gray-700/50 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                      } disabled:opacity-50`}
                      title="Pass"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    
                    {/* Like Button with heart animation */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(profile.id, e); }}
                      disabled={swiping[profile.id] || profile.my_swipe_action === 'like'}
                      className={`relative p-1.5 sm:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 group/btn ${
                        profile.my_swipe_action === 'like'
                          ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/30'
                          : isDark ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white' : 'bg-pink-50 text-pink-500 hover:bg-pink-500 hover:text-white'
                      } disabled:opacity-50`}
                      title="Like"
                    >
                      <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all duration-300 ${profile.my_swipe_action === 'like' ? 'animate-heartbeat' : 'group-hover/btn:scale-125'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                      {profile.my_swipe_action === 'like' && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                        </span>
                      )}
                    </button>
                    
                    {/* Add Friend Button */}
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleAddFriend(profile.id, profile.name); 
                      }}
                      disabled={friendRequests[profile.id]}
                      className={`p-1.5 sm:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 group/btn ${
                        isDark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white'
                      } disabled:opacity-50`}
                      title="Add Friend"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                    
                    {/* Message Button (for matches) */}
                    {profile.is_matched && (
                      <Link
                        to={`/messages/${profile.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1.5 sm:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 group/btn ${
                          isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white' : 'bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white'
                        }`}
                        title="Message"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </Link>
                    )}
                    
                    {/* Call Button (for online users) */}
                    {profile.online_status && !profile.is_matched && (
                      <Link
                        to={`/messages/${profile.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1.5 sm:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 group/btn ${
                          isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white' : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'
                        }`}
                        title="Call"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:animate-wiggle" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Shimmer effect on card hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
              </div>
            ))}
          </div>
        )}

        {/* ===== EMPTY STATE ===== */}
        {!searchTerm && filteredUsers.length === 0 && (
          <div className={`text-center py-16 sm:py-20 animate-fade-in`}>
            <div className="relative inline-block">
              <div className="text-5xl sm:text-6xl mb-4 animate-float">🌟</div>
              <div className="absolute -top-3 -right-3 text-2xl animate-spin-slow">✨</div>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold ${textMain} mb-2`}>No Users Found</h2>
            <p className={textSub}>Check back later for new people!</p>
            <button 
              onClick={fetchUsers}
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-medium text-sm hover:shadow-lg hover:shadow-pink-500/25 hover:scale-105 transition-all active:scale-95"
            >
              Refresh 🔄
            </button>
          </div>
        )}
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

      {/* User Profile Modal */}
      {selectedUserForModal && (
        <UserProfileModal
          userId={selectedUserForModal}
          onClose={() => setSelectedUserForModal(null)}
          onLike={handleLikeFromModal}
          onPass={handlePassFromModal}
          currentUser={user}
        />
      )}

      {/* Custom CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(5deg); }
          75% { transform: translateY(-10px) rotate(-5deg); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.3); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
          60% { transform: scale(1); }
        }
        @keyframes sparkle {
          0% { transform: scale(0) rotate(0deg); opacity: 1; }
          100% { transform: scale(1) rotate(180deg); opacity: 0; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-heartbeat { animation: heartbeat 1.5s ease-in-out infinite; }
        .animate-sparkle { animation: sparkle 0.6s ease-out forwards; }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}