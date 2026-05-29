import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function SetupProfile() {
  const [formData, setFormData] = useState({
    name: '',
    age: 18,
    gender: '',
    interestedIn: '',
    bio: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async () => {
    if (!photo) return null;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('photo', photo);
    
    try {
      const response = await axios.post(`${API_URL}/upload/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.photoUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.age < 18) {
      toast.error('You must be 18 or older');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setLoading(true);

    try {
      // Upload photo first if exists
      let photoUrl = null;
      if (photo) {
        photoUrl = await uploadPhoto();
      }
      
      // Complete the profile
      const profileResponse = await axios.post(`${API_URL}/auth/complete-profile`, {
        name: formData.name,
        age: formData.age,
        gender: formData.gender,
        interestedIn: formData.interestedIn,
        bio: formData.bio
      });

      // Update auth context
      updateUser(profileResponse.data.user);
      
      toast.success('Profile created! You are now visible to others 🎉');
      navigate('/');
    } catch (error) {
      console.error('Profile setup error:', error);
      toast.error(error.response?.data?.error || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📝</div>
          <h1 className="text-2xl font-bold text-gray-800">Complete Your Profile</h1>
          <p className="text-gray-500 mt-2">Tell others about yourself to get started!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-white">📸</span>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 w-full"
                />
                {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Display Name *</label>
            <input
              type="text"
              placeholder="Your name or nickname"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Age *</label>
            <input
              type="number"
              placeholder="18+"
              value={formData.age}
              onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
              min="18"
              max="120"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Prefer not to say</option>
            </select>
          </div>

          {/* Interested In */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Interested In</label>
            <select
              value={formData.interestedIn}
              onChange={(e) => setFormData({...formData, interestedIn: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Select</option>
              <option value="male">Men</option>
              <option value="female">Women</option>
              <option value="both">Everyone</option>
            </select>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Bio</label>
            <textarea
              placeholder="Tell others about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              rows="3"
              maxLength="500"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{formData.bio.length}/500</p>
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 mt-6"
          >
            {loading || uploading ? 'Creating Profile...' : 'Complete Profile & Start Matching'}
          </button>
        </form>
      </div>
    </div>
  );
}