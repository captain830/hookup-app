import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/matches/my-matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  // Theme classes
  const pageBg = isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100';
  const titleColor = isDark ? 'text-white' : 'text-gray-800';
  const subtitleColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white';
  const cardNameColor = isDark ? 'text-white' : 'text-gray-800';
  const cardAgeColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBioColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const cardDateColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const emptyCardBg = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white';
  const emptyTitleColor = isDark ? 'text-white' : 'text-gray-800';
  const emptyTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const onlineBadgeBg = isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-500 text-white';
  const onlineDotColor = isDark ? 'bg-green-400' : 'bg-white';

  if (loading) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-2 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${pageBg} py-4 sm:py-6 md:py-8`}>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        
        {/* Header */}
        <div className="text-center mb-5 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-2 ${titleColor}`}>
            Your Matches
          </h1>
          <p className={`text-sm sm:text-base ${subtitleColor}`}>
            {matches.length} {matches.length === 1 ? 'person' : 'people'} liked you back
          </p>
        </div>

        {/* Empty State */}
        {matches.length === 0 ? (
          <div className={`${emptyCardBg} rounded-2xl shadow-xl p-8 sm:p-12 text-center max-w-lg mx-auto`}>
            <div className="text-5xl sm:text-6xl mb-4">💔</div>
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${emptyTitleColor}`}>No Matches Yet</h2>
            <p className={`text-sm sm:text-base mb-6 ${emptyTextColor}`}>Start swiping to find your perfect match!</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 active:scale-95 transition-all text-sm sm:text-base"
            >
              Start Swiping
            </Link>
          </div>
        ) : (
          /* Matches Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {matches.map((match) => {
              const otherUser = match.otherUser;
              return (
                <div key={match.id} className={`${cardBg} rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 group`}>
                  
                  {/* Photo Section */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500">
                    {otherUser.photos && otherUser.photos.length > 0 ? (
                      <img 
                        src={fixImageUrl(otherUser.photos[0])}
                        alt={otherUser.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center">
                              <span class="text-5xl sm:text-6xl text-white font-bold">${otherUser.name?.charAt(0)?.toUpperCase()}</span>
                            </div>`;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl sm:text-6xl text-white font-bold">{otherUser.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                    )}
                    
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Online Badge */}
                    {otherUser.online_status && (
                      <div className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-sm ${isDark ? 'bg-black/60 text-green-400' : 'bg-green-500 text-white'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${onlineDotColor}`}></span>
                        Online
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="p-4 sm:p-5">
                    <h3 className={`text-lg sm:text-xl font-bold truncate ${cardNameColor}`}>
                      {otherUser.name}
                    </h3>
                    <p className={`text-sm mt-0.5 ${cardAgeColor}`}>{otherUser.age} years old</p>
                    
                    {otherUser.bio && (
                      <p className={`text-xs sm:text-sm mt-2 line-clamp-2 leading-relaxed ${cardBioColor}`}>
                        {otherUser.bio}
                      </p>
                    )}
                    
                    {/* Message Button */}
                    <div className="mt-4">
                      <Link
                        to={`/messages/${otherUser.id}`}
                        className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message
                      </Link>
                    </div>
                    
                    {/* Match Date */}
                    <p className={`text-[10px] sm:text-xs text-center mt-3 ${cardDateColor}`}>
                      Matched on {new Date(match.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}