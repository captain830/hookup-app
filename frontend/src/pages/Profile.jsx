import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [bio, setBio] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setInterestedIn(user.interested_in || '');
      let userPhotos = user.photos || [];
      if (typeof userPhotos === 'string') {
        try {
          userPhotos = JSON.parse(userPhotos);
        } catch(e) {
          userPhotos = [];
        }
      }
      setPhotos(userPhotos);
    }
  }, [user]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    setUploading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/users/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setPhotos(response.data.photos);
      updateUser({ photos: response.data.photos });
      toast.success('Profile photo updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (photos.length === 0) return;
    
    if (confirm('Delete your profile photo?')) {
      try {
        const photoUrl = encodeURIComponent(photos[0]);
        const response = await axios.delete(`http://localhost:5000/api/users/photo/${photoUrl}`);
        setPhotos(response.data.photos);
        updateUser({ photos: response.data.photos });
        toast.success('Profile photo deleted');
      } catch (error) {
        toast.error('Failed to delete photo');
      }
    }
  };

  const updateProfile = async () => {
    try {
      const response = await axios.put('http://localhost:5000/api/users/profile', {
        bio,
        interestedIn
      });
      updateUser(response.data);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">My Profile</h1>
          <p className="text-gray-500">Manage your personal information</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 md:p-8">
            {/* Profile Photo Section */}
            <div className="mb-8 text-center">
              <label className="block text-gray-700 mb-3 font-semibold text-lg">Profile Photo</label>
              <div className="flex flex-col items-center gap-4">
                {/* Current Photo */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-lg">
                    {photos && photos.length > 0 ? (
                      <img 
                        src={photos[0]} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<span class="text-4xl text-white font-bold">${user?.name?.charAt(0)?.toUpperCase()}</span>`;
                        }}
                      />
                    ) : (
                      <span className="text-4xl text-white font-bold">
                        {user?.name?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  {photos.length > 0 && (
                    <button
                      onClick={handleDeletePhoto}
                      className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-red-600 transition shadow-md"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Upload Button */}
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-sm font-semibold hover:shadow-lg transition cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {uploading ? 'Uploading...' : (photos.length > 0 ? 'Change Photo' : 'Upload Photo')}
                  </span>
                </label>
                <p className="text-xs text-gray-400">JPG, PNG or GIF. Max 5MB.</p>
              </div>
            </div>

            {/* Bio Section */}
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-semibold">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="4"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                placeholder="Tell others about yourself..."
              />
              <p className="text-right text-xs text-gray-400 mt-1">{bio.length}/500</p>
            </div>

            {/* Interested In */}
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-semibold">Interested In</label>
              <select
                value={interestedIn}
                onChange={(e) => setInterestedIn(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select</option>
                <option value="male">Men</option>
                <option value="female">Women</option>
                <option value="both">Everyone</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={updateProfile}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}