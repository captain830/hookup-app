import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useTheme } from '../context/ThemeContext';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [matchesCount, setMatchesCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState(null);

  // Theme-based classes
  const navBg = theme === 'dark' ? 'bg-gray-900 shadow-gray-900/50' : 'bg-white shadow-lg';
  const textColor = theme === 'dark' ? 'text-gray-200 hover:text-pink-400' : 'text-gray-700 hover:text-pink-500';
  const mobileBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const mobileHover = theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-pink-50';
  const dropdownBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
  const dropdownHover = theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-pink-50';
  const dropdownText = theme === 'dark' ? 'text-gray-200' : 'text-gray-700';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const userNameColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const iconColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

  const navItems = [
  { path: '/', icon: '🏠', label: 'Discover' },
  { path: '/chats', icon: '💬', label: 'Chats' },
  { path: '/friends', icon: '👥', label: 'Friends' },  // ADD THIS
  { path: '/matches', icon: '💕', label: 'Matches' },
  { path: '/profile', icon: '👤', label: 'Profile' },
];
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/messages/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchMatchesCount = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/matches/my-matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMatchesCount(response.data.length);
    } catch (error) {
      console.error('Error fetching matches count:', error);
    }
  };

  const fetchProfilePhoto = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.photos && response.data.photos.length > 0) {
        setProfilePhoto(response.data.photos[0]);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    fetchUnreadCount();
    fetchMatchesCount();
    fetchProfilePhoto();
    
    const socket = io(SOCKET_URL);
    
    socket.on('new-message', (data) => {
      if (data.to === user.id) {
        setUnreadCount(prev => prev + 1);
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed'));
      }
    });
    
    socket.on('messages-read', (data) => {
      if (data.by === user.id) {
        fetchUnreadCount();
      }
    });
    
    socket.on('user-status-changed', () => {
      fetchMatchesCount();
    });
    
    return () => socket.disconnect();
  }, [user]);

  const isAdmin = user?.role === 'admin' || user?.email === 'admin@hookup.com';

  return (
    <nav className={`${navBg} sticky top-0 z-50 transition-colors duration-300`}>
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center py-2 sm:py-3">
          {/* Logo - Responsive */}
          <Link to="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl md:text-3xl">❤️</span>
            <span className="hidden sm:inline text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              HookupApp
            </span>
            <span className="sm:hidden text-sm font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              Hookup
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-1 ${textColor} transition-colors duration-200 relative text-sm lg:text-base`}
                onClick={() => {
                  if (item.path === '/chats') {
                    setUnreadCount(0);
                  }
                }}
              >
                <span className="text-base lg:text-lg">{item.icon}</span>
                <span className="hidden lg:inline">{item.label}</span>
                {item.path === '/chats' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center animate-pulse px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {item.path === '/matches' && matchesCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-pink-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {matchesCount}
                  </span>
                )}
              </Link>
            ))}
            
            {/* Admin Link */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center space-x-1 ${textColor} transition-colors duration-200 text-sm lg:text-base`}
              >
                <span>⚙️</span>
                <span className="hidden lg:inline">Admin</span>
              </Link>
            )}
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 lg:p-2 rounded-full transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            {/* User Section */}
            <div className={`flex items-center space-x-2 lg:space-x-3 ml-2 lg:ml-4 pl-2 lg:pl-4 border-l ${borderColor}`}>
              {user?.is_premium && (
                <span className="hidden lg:inline-flex bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-2 lg:px-3 py-0.5 lg:py-1 rounded-full text-xs lg:text-sm font-semibold items-center gap-1">
                  <span>⭐</span> Premium
                </span>
              )}
              
              {/* Profile Dropdown */}
              <div className="relative group">
                <button className="flex items-center space-x-1 lg:space-x-2 focus:outline-none">
                  {profilePhoto ? (
                    <img 
                      src={fixImageUrl(profilePhoto)}
                      alt={user?.name}
                      className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border-2 border-pink-500"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                            <span class="text-white text-xs lg:text-sm font-bold">${user?.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs lg:text-sm font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className={`hidden sm:inline ${userNameColor} text-sm`}>{user?.name}</span>
                  <svg className={`w-3 h-3 lg:w-4 lg:h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown */}
                <div className={`absolute right-0 mt-2 w-44 lg:w-48 ${dropdownBg} rounded-lg shadow-lg border ${borderColor} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
                  <Link to="/profile" className={`block px-3 lg:px-4 py-2 lg:py-2.5 ${dropdownText} ${dropdownHover} rounded-t-lg text-sm`}>
                    👤 My Profile
                  </Link>
                  <Link to="/chats" className={`block px-3 lg:px-4 py-2 lg:py-2.5 ${dropdownText} ${dropdownHover} text-sm`}>
                    💬 Messages
                    {unreadCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/matches" className={`block px-3 lg:px-4 py-2 lg:py-2.5 ${dropdownText} ${dropdownHover} text-sm`}>
                    💕 Matches
                    {matchesCount > 0 && (
                      <span className="ml-2 bg-pink-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                        {matchesCount}
                      </span>
                    )}
                  </Link>
                  <hr className={`my-1 ${borderColor}`} />
                  <button
                    onClick={toggleTheme}
                    className={`w-full text-left px-3 lg:px-4 py-2 lg:py-2.5 ${dropdownText} ${dropdownHover} text-sm flex items-center gap-2`}
                  >
                    <span>{theme === 'light' ? '🌙' : '☀️'}</span>
                    <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                  <hr className={`my-1 ${borderColor}`} />
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 lg:px-4 py-2 lg:py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg text-sm"
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-full transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-700 text-yellow-400' 
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            
            {/* Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`${iconColor} focus:outline-none relative p-1`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden pb-4 space-y-1 ${mobileBg} rounded-b-xl`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 ${dropdownText} ${mobileHover} rounded-lg transition text-sm`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.path === '/chats' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] rounded-full px-2 py-0.5 font-medium">
                    {unreadCount}
                  </span>
                )}
                {item.path === '/matches' && matchesCount > 0 && (
                  <span className="bg-pink-500 text-white text-[10px] rounded-full px-2 py-0.5 font-medium">
                    {matchesCount}
                  </span>
                )}
              </Link>
            ))}
            
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-2.5 ${dropdownText} ${mobileHover} rounded-lg transition text-sm`}
              >
                <span className="text-lg">⚙️</span>
                <span>Admin Panel</span>
              </Link>
            )}
            
            <hr className={`my-2 ${borderColor}`} />
            
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm"
            >
              <span className="text-lg">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}