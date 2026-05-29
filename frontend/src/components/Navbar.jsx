import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [matchesCount, setMatchesCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState(null);

  const navItems = [
    { path: '/', icon: '🏠', label: 'Discover' },
    { path: '/chats', icon: '💬', label: 'Chats' },
    { path: '/matches', icon: '💕', label: 'Matches' },
    { path: '/profile', icon: '👤', label: 'Profile' },
  ];

  // Fetch unread count instantly
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

  // Fetch matches count
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

  // Fetch profile photo
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

  // Real-time socket connection for instant updates
  useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    fetchUnreadCount();
    fetchMatchesCount();
    fetchProfilePhoto();
    
    // Connect to socket
    const socket = io(SOCKET_URL);
    
    // Listen for new messages - UPDATE INSTANTLY
    socket.on('new-message', (data) => {
      if (data.to === user.id) {
        // Increment unread count immediately
        setUnreadCount(prev => prev + 1);
        
        // Also play notification sound
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed'));
      }
    });
    
    // Listen for messages being read
    socket.on('messages-read', (data) => {
      if (data.by === user.id) {
        // Refresh unread count
        fetchUnreadCount();
      }
    });
    
    // Listen for status changes
    socket.on('user-status-changed', () => {
      fetchMatchesCount();
    });
    
    return () => socket.disconnect();
  }, [user]);

  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.email === 'admin@hookup.com';

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-3xl">❤️</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              HookupApp
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center space-x-1 text-gray-700 hover:text-pink-500 transition-colors duration-200 relative"
                onClick={() => {
                  if (item.path === '/chats') {
                    // Reset unread count when clicking chats
                    setUnreadCount(0);
                  }
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.path === '/chats' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {item.path === '/matches' && matchesCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {matchesCount}
                  </span>
                )}
              </Link>
            ))}
            
            {/* Admin Panel Link */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center space-x-1 text-gray-700 hover:text-purple-500"
              >
                <span>⚙️</span>
                <span>Admin</span>
              </Link>
            )}
            
            <div className="flex items-center space-x-3 ml-4 border-l pl-4">
              {user?.is_premium && (
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <span>⭐</span> Premium
                </span>
              )}
              
              {/* Profile Image with Dropdown */}
              <div className="relative group">
                <button className="flex items-center space-x-2 focus:outline-none">
                  {profilePhoto ? (
                    <img 
                      src={`/uploads/${profilePhoto.split('/').pop()}`}
                      alt={user?.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-pink-500"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                            <span class="text-white text-sm font-bold">${user?.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-gray-600">{user?.name}</span>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link to="/profile" className="block px-4 py-2 text-gray-700 hover:bg-pink-50 rounded-t-lg">
                    👤 My Profile
                  </Link>
                  <Link to="/chats" className="block px-4 py-2 text-gray-700 hover:bg-pink-50">
                    💬 Messages
                    {unreadCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/matches" className="block px-4 py-2 text-gray-700 hover:bg-pink-50">
                    💕 Matches
                    {matchesCount > 0 && (
                      <span className="ml-2 bg-pink-500 text-white text-xs rounded-full px-2 py-0.5">
                        {matchesCount}
                      </span>
                    )}
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg"
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-gray-600 focus:outline-none relative"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-pink-50 rounded-lg transition"
              >
                <div className="flex items-center space-x-2">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.path === '/chats' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
                {item.path === '/matches' && matchesCount > 0 && (
                  <span className="bg-pink-500 text-white text-xs rounded-full px-2 py-0.5">
                    {matchesCount}
                  </span>
                )}
              </Link>
            ))}
            
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-pink-50 rounded-lg transition"
              >
                <span>⚙️</span>
                <span>Admin Panel</span>
              </Link>
            )}
            
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}