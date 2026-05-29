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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    fetchStories();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.bio && user.bio.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

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

  const handleLike = async (targetUserId) => {
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

  // Theme classes
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f2f5]';
  const textMain = isDark ? 'text-gray-100' : 'text-gray-800';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-[#1a1a2e]' : 'bg-white';
  const cardBorder = isDark ? 'border-gray-700/50' : 'border-gray-100';
  const inputBg = isDark ? 'bg-[#1a1a2e] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800';
  const badgeBg = isDark ? 'bg-pink-500/20 text-pink-300' : 'bg-pink-100 text-pink-600';
  const storyBg = isDark ? 'bg-[#1a1a2e] border-gray-700' : 'bg-white';
  const shimmerBg = isDark ? 'bg-gradient-to-r from-transparent via-white/5 to-transparent' : 'bg-gradient-to-r from-transparent via-white/80 to-transparent';

  if (loading) {
    return (
      <div className={`min-h-screen ${bgMain} flex items-center justify-center transition-colors duration-500`}>
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-pink-200 dark:border-pink-900 animate-ping"></div>
            <div className="w-16 h-16 border-4 border-pink-200 dark:border-pink-800 rounded-full animate-spin border-t-pink-500"></div>
          </div>
          <p className={`mt-6 ${textSub} text-sm font-medium tracking-wide`}>Discovering people near you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain} transition-colors duration-500`}>
      <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        
        {/* ===== TOP BAR ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${textMain} tracking-tight`}>
                Discover
              </h1>
              <p className={`${textSub} text-xs sm:text-sm mt-0.5`}>
                {filteredUsers.length} people near you
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none sm:w-64 lg:w-72">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-8 py-2 sm:py-2.5 ${inputBg} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all`}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  ✕
                </button>
              )}
            </div>
            
            {/* View Toggle */}
            <div className={`flex rounded-lg overflow-hidden border ${cardBorder}`}>
              <button onClick={() => setViewMode('grid')} 
                className={`p-2 ${viewMode === 'grid' ? (isDark ? 'bg-pink-500/30 text-pink-400' : 'bg-pink-50 text-pink-500') : (isDark ? 'text-gray-500' : 'text-gray-400')} transition`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? (isDark ? 'bg-pink-500/30 text-pink-400' : 'bg-pink-50 text-pink-500') : (isDark ? 'text-gray-500' : 'text-gray-400')} transition`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* ===== STORIES SECTION ===== */}
        <div className="mb-5 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Your Story */}
            <button
              onClick={() => setShowStatusUpload(!showStatusUpload)}
              className="flex flex-col items-center flex-shrink-0 group"
            >
              <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full ${storyBg} border-2 border-dashed border-pink-500 flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 group-hover:scale-105 group-hover:border-pink-400 group-active:scale-95`}>
                {myStatuses.length > 0 ? (
                  <span className="text-lg">📖</span>
                ) : (
                  <span className="text-pink-500 font-bold">+</span>
                )}
                {myStatuses.length > 0 && (
                  <span className="absolute -bottom-1 -right-1 bg-pink-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-gray-900">
                    {myStatuses.length}
                  </span>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs ${textSub} mt-1.5 truncate max-w-[60px]`}>
                {myStatuses.length > 0 ? 'My Story' : 'Add Story'}
              </span>
            </button>
            
            {/* Other Stories */}
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
            <div className="text-5xl sm:text-6xl mb-4">🔍</div>
            <h2 className={`text-xl sm:text-2xl font-bold ${textMain} mb-2`}>No Results Found</h2>
            <p className={textSub}>No users matching "{searchTerm}"</p>
            <button onClick={() => setSearchTerm('')} 
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-medium text-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95">
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
                className={`group relative ${cardBg} ${cardBorder} border rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] animate-fade-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Image Section - Compact */}
                <div className={`relative overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500 ${viewMode === 'grid' ? 'aspect-[3/4] sm:aspect-[2/3]' : 'h-20 sm:h-24 w-20 sm:w-24 flex-shrink-0'}`}>
                  {profile.photos?.[0] ? (
                    <img 
                      src={profile.photos[0]} 
                      alt={profile.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center">
                            <span class="text-4xl sm:text-5xl text-white font-bold">${profile.name?.charAt(0)?.toUpperCase()}</span>
                          </div>`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl sm:text-5xl text-white font-bold">{profile.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  
                  {/* Image overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Premium Badge */}
                  {profile.is_premium && (
                    <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 shadow-md animate-pulse-slow">
                      <span>⭐</span>
                    </div>
                  )}
                  
                  {/* Match Badge */}
                  {profile.is_matched && (
                    <div className="absolute top-2 left-2 z-10 bg-green-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold shadow-md animate-bounce-slow">
                      💕 MATCH
                    </div>
                  )}
                  
                  {/* Liked Badge */}
                  {profile.my_swipe_action === 'like' && !profile.is_matched && (
                    <div className="absolute top-2 left-2 z-10 bg-pink-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold shadow-md">
                      ❤️
                    </div>
                  )}
                  
                  {/* Online Dot */}
                  {profile.online_status && (
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-white text-[9px] sm:text-[10px]">Online</span>
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className={viewMode === 'grid' ? 'p-2 sm:p-3' : 'flex-1 p-2 sm:p-3 flex items-center'}>
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <h3 className={`font-semibold ${textMain} text-xs sm:text-sm truncate`}>
                      {profile.name}, {profile.age}
                    </h3>
                    {viewMode === 'grid' && profile.bio && (
                      <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-[10px] sm:text-xs mt-0.5 line-clamp-1`}>
                        {profile.bio}
                      </p>
                    )}
                  </div>
                  
                  {/* Action Icons */}
                  <div className={`flex items-center gap-1 sm:gap-1.5 ${viewMode === 'grid' ? 'mt-2 sm:mt-2.5' : 'flex-shrink-0 ml-2'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePass(profile.id); }}
                      disabled={swiping[profile.id]}
                      className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-90 ${
                        isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                      } disabled:opacity-50`}
                      title="Pass"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLike(profile.id); }}
                      disabled={swiping[profile.id] || profile.my_swipe_action === 'like'}
                      className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-90 ${
                        profile.my_swipe_action === 'like'
                          ? 'bg-pink-500 text-white'
                          : isDark ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white' : 'bg-pink-50 text-pink-500 hover:bg-pink-500 hover:text-white'
                      } disabled:opacity-50`}
                      title="Like"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {profile.is_matched && (
                      <Link
                        to={`/messages/${profile.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-90 ${
                          isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white' : 'bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white'
                        }`}
                        title="Message"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </Link>
                    )}
                    
                    {profile.online_status && !profile.is_matched && (
                      <Link
                        to={`/messages/${profile.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-90 ${
                          isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white' : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'
                        }`}
                        title="Call"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== EMPTY STATE ===== */}
        {!searchTerm && filteredUsers.length === 0 && (
          <div className={`text-center py-16 sm:py-20 animate-fade-in`}>
            <div className="text-5xl sm:text-6xl mb-4">🌟</div>
            <h2 className={`text-xl sm:text-2xl font-bold ${textMain} mb-2`}>No Users Found</h2>
            <p className={textSub}>Check back later for new people!</p>
            <button onClick={fetchUsers}
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-medium text-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95">
              Refresh
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
    </div>
  );
}