import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/matches/my-matches', {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Your Matches</h1>
          <p className="text-gray-500">
            {matches.length} people liked you back
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Matches Yet</h2>
            <p className="text-gray-500 mb-6">Start swiping to find your perfect match!</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
            >
              Start Swiping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {matches.map((match) => {
              const otherUser = match.otherUser;
              return (
                <div key={match.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="relative h-64 bg-gradient-to-br from-pink-400 to-purple-500">
                    {otherUser.photos && otherUser.photos.length > 0 ? (
                      <img 
                        src={otherUser.photos[0]} 
                        alt={otherUser.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl text-white font-bold">{otherUser.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                    )}
                    {otherUser.online_status && (
                      <div className="absolute bottom-3 left-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        Online
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-gray-800">{otherUser.name}</h3>
                    <p className="text-gray-500 text-sm">{otherUser.age} years old</p>
                    {otherUser.bio && (
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">{otherUser.bio}</p>
                    )}
                    <div className="mt-4 flex gap-3">
                      <Link
                        to={`/messages/${otherUser.id}`}
                        className="flex-1 text-center py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                      >
                        💬 Message
                      </Link>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-3">
                      Matched on {new Date(match.created_at).toLocaleDateString()}
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