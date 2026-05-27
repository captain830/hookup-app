import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StatusCircle from '../components/StatusCircle';
import StatusModal from '../components/StatusModal';
import StatusUpload from '../components/StatusUpload';
import UserProfileModal from '../components/UserProfileModal';

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
  const { user, logout } = useAuth();
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
        console.error('No token found');
        navigate('/login');
        return;
      }
      
      const response = await axios.get('http://localhost:5000/api/users/discover', {
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
      const response = await axios.get('http://localhost:5000/api/status/active', {
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
      const response = await axios.post('http://localhost:5000/api/matches/swipe', {
        targetUserId,
        action: 'like'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.matched) {
        toast.success("💕 It's a Match! 💕", { duration: 5000 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, my_swipe_action: 'like', is_matched: true }
            : u
        ));
      } else {
        toast.success('Liked! 💕', { duration: 1500 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, my_swipe_action: 'like' }
            : u
        ));
      }
    } catch (error) {
      console.error('Like error:', error);
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
      await axios.post('http://localhost:5000/api/matches/swipe', {
        targetUserId,
        action: 'pass'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Passed 👎', { duration: 1000 });
      setUsers(prev => prev.map(u => 
        u.id === targetUserId 
          ? { ...u, my_swipe_action: 'pass' }
          : u
      ));
    } catch (error) {
      console.error('Pass error:', error);
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
      const response = await axios.post('http://localhost:5000/api/matches/swipe', {
        targetUserId,
        action: 'like'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.matched) {
        toast.success("💕 It's a Match! 💕", { duration: 5000 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, my_swipe_action: 'like', is_matched: true }
            : u
        ));
      } else {
        toast.success('Liked! 💕', { duration: 1500 });
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, my_swipe_action: 'like' }
            : u
        ));
      }
      
      setSelectedUserForModal(null);
    } catch (error) {
      console.error('Like error:', error);
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
      await axios.post('http://localhost:5000/api/matches/swipe', {
        targetUserId,
        action: 'pass'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Passed 👎', { duration: 1000 });
      setUsers(prev => prev.map(u => 
        u.id === targetUserId 
          ? { ...u, my_swipe_action: 'pass' }
          : u
      ));
      setSelectedUserForModal(null);
    } catch (error) {
      console.error('Pass error:', error);
      toast.error('Failed to pass');
    } finally {
      setSwiping(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-200 rounded-full animate-spin border-t-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading amazing people...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Discover People
          </h1>
          <p className="text-gray-600 text-lg">
            Connect with amazing people near you
          </p>
          <div className="inline-flex items-center gap-2 mt-2 px-4 py-1 bg-pink-100 rounded-full">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-pink-600 font-medium">
              {filteredUsers.length} people available
            </span>
          </div>
        </div>

        {/* Stories Section */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-4">
            {/* Your Story */}
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => setShowStatusUpload(!showStatusUpload)}
                className="w-16 h-16 rounded-full bg-white border-2 border-pink-500 flex items-center justify-center text-2xl hover:scale-105 transition shadow-md"
              >
                {myStatuses.length > 0 ? '📖' : '+'}
              </button>
              <span className="text-xs text-gray-500 mt-1">
                {myStatuses.length > 0 ? `${myStatuses.length} story${myStatuses.length > 1 ? 's' : ''}` : 'Add Story'}
              </span>
            </div>
            
            {/* Other Users' Stories */}
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
          
          {/* Status Upload Component */}
          {showStatusUpload && (
            <div className="mt-4">
              <StatusUpload 
                onUpload={() => {
                  fetchStories();
                  setShowStatusUpload(false);
                }} 
                onClose={() => setShowStatusUpload(false)}
              />
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 pr-10 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent shadow-sm text-gray-800 placeholder-gray-400"
            />
            <span className="absolute left-4 top-3.5 text-gray-400 text-xl">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && filteredUsers.length === 0 && (
            <p className="text-center text-gray-500 mt-3 text-sm">
              No users found matching "{searchTerm}"
            </p>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredUsers.map((profile) => (
            <div 
              key={profile.id} 
              onClick={() => setSelectedUserForModal(profile.id)}
              className="group relative bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
            >
              {/* Premium Badge */}
              {profile.is_premium && (
                <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span>Premium</span>
                </div>
              )}

              {/* Add near the online status badge */}
{profile.online_status && (
  <div className="absolute bottom-3 left-3 z-10 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg">
    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
    <span>Online</span>
  </div>
)}

{/* ADD CALL QUICK ACTION BUTTON */}
{profile.online_status && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/messages/${profile.id}`);
      toast.info('Tap the 📹 button in chat to start a call', { icon: '📞' });
    }}
    className="absolute bottom-3 right-3 z-10 bg-blue-500 text-white p-1.5 rounded-full shadow-lg hover:bg-blue-600 transition"
    title="Call"
  >
    📞
  </button>
)}

              {/* Match Badge */}
              {profile.is_matched && (
                <div className="absolute top-3 left-3 z-10 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 shadow-lg">
                  <span>💕</span> MATCH!
                </div>
              )}

              {/* Liked Badge */}
              {profile.my_swipe_action === 'like' && !profile.is_matched && (
                <div className="absolute top-3 left-3 z-10 bg-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                  ❤️ Liked
                </div>
              )}

              {/* Profile Image */}
              <div className="relative h-64 overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500">
                {profile.photos && profile.photos.length > 0 && profile.photos[0] ? (
                  <img 
                    src={profile.photos[0]} 
                    alt={profile.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center">
                          <span class="text-7xl text-white font-bold">${profile.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                      `;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-7xl text-white font-bold">
                      {profile.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{profile.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 text-sm">{profile.age} years</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span className="text-gray-400 text-sm">📍 Nearby</span>
                    </div>
                  </div>
                </div>

                {profile.bio && (
                  <p className="text-gray-600 text-sm mt-3 line-clamp-2 leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePass(profile.id);
                    }}
                    disabled={swiping[profile.id]}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Pass
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(profile.id);
                    }}
                    disabled={swiping[profile.id] || profile.my_swipe_action === 'like'}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      profile.my_swipe_action === 'like'
                        ? 'bg-pink-100 text-pink-500 cursor-default'
                        : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                    } disabled:opacity-50`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                    {profile.my_swipe_action === 'like' ? 'Liked' : 'Like'}
                  </button>
                </div>

                {/* Chat Button */}
                <Link
                  to={profile.is_matched ? `/messages/${profile.id}` : '#'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!profile.is_matched) {
                      e.preventDefault();
                      toast('Like each other to start chatting! 💕', { icon: '💬' });
                    }
                  }}
                  className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-center block ${
                    profile.is_matched
                      ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {profile.is_matched ? 'Send Message' : 'Match to Chat'}
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && searchTerm && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Results Found</h2>
            <p className="text-gray-500">No users matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold hover:shadow-lg transition"
            >
              Clear Search
            </button>
          </div>
        )}

        {filteredUsers.length === 0 && !searchTerm && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌟</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Users Found</h2>
            <p className="text-gray-500">Check back later for new people!</p>
            <button
              onClick={fetchUsers}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold hover:shadow-lg transition"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Status Modal - Updated to use the new structure */}
      {selectedStoryUser && selectedStoryStatuses && selectedStoryStatuses.length > 0 && (
        <StatusModal
          user={selectedStoryUser}
          userStatuses={selectedStoryStatuses}
          currentIndex={currentStoryIndex}
          onClose={() => {
            setSelectedStoryUser(null);
            setSelectedStoryStatuses([]);
            setCurrentStoryIndex(0);
          }}
          onNext={() => {
            if (currentStoryIndex + 1 < selectedStoryStatuses.length) {
              setCurrentStoryIndex(currentStoryIndex + 1);
            } else {
              setSelectedStoryUser(null);
              setSelectedStoryStatuses([]);
              setCurrentStoryIndex(0);
            }
          }}
          onPrev={() => {
            if (currentStoryIndex - 1 >= 0) {
              setCurrentStoryIndex(currentStoryIndex - 1);
            }
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