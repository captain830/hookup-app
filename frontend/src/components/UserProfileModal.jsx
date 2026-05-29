import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function UserProfileModal({ userId, onClose, onLike, onPass, currentUser }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isLiking, setIsLiking] = useState(false);

    useEffect(() => {
        fetchUserDetails();
    }, [userId]);

    const fetchUserDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUser(response.data);
        } catch (error) {
            console.error('Error fetching user details:', error);
            toast.error('Failed to load user details');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        if (isLiking) return;
        setIsLiking(true);
        await onLike(userId);
        setIsLiking(false);
    };

    const handlePass = async () => {
        await onPass(userId);
        onClose();
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative bg-[#1e1e1e] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition"
                >
                    ✕
                </button>

                {/* Photos Gallery */}
                <div className="relative h-96 bg-gradient-to-br from-pink-400 to-purple-500">
                    {user.photos && user.photos.length > 0 ? (
                        <>
                            <img 
                                src={user.photos[activeImageIndex]} 
                                alt={user.name}
                                className="w-full h-full object-cover"
                            />
                            {/* Image Navigation */}
                            {user.photos.length > 1 && (
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                                    {user.photos.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`w-2 h-2 rounded-full transition ${
                                                idx === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-6xl text-white font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                    )}

                    {/* Premium Badge */}
                    {user.is_premium && (
                        <div className="absolute top-4 right-12 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <span>⭐</span> Premium
                        </div>
                    )}

                    {/* Online Status */}
                    {user.online_status && (
                        <div className="absolute bottom-4 left-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                            Online
                        </div>
                    )}
                </div>

                {/* User Info */}
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-gray-400">{user.age} years old</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span className="text-gray-500">📍 {user.city || 'Nearby'}</span>
                            </div>
                        </div>
                        {user.is_verified && (
                            <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">✓ Verified</div>
                        )}
                    </div>

                    {/* Bio */}
                    {user.bio && (
                        <div className="mb-6">
                            <h3 className="text-white font-semibold mb-2">About</h3>
                            <p className="text-gray-400 leading-relaxed">{user.bio}</p>
                        </div>
                    )}

                    {/* Interests */}
                    {user.interested_in && (
                        <div className="mb-6">
                            <h3 className="text-white font-semibold mb-2">Interested In</h3>
                            <div className="inline-block px-3 py-1 bg-pink-500/20 rounded-full text-pink-400 text-sm">
                                {user.interested_in === 'male' ? 'Men' : user.interested_in === 'female' ? 'Women' : 'Everyone'}
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-[#2a2a2a] rounded-xl">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{user.followers || 0}</p>
                            <p className="text-xs text-gray-500">Followers</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{user.following || 0}</p>
                            <p className="text-xs text-gray-500">Following</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{user.photos?.length || 0}</p>
                            <p className="text-xs text-gray-500">Photos</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handlePass}
                            className="flex-1 py-3 bg-[#2a2a2a] text-gray-300 rounded-xl font-semibold hover:bg-[#333333] transition flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Pass
                        </button>
                        
                        <button
                            onClick={handleLike}
                            disabled={isLiking}
                            className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            {isLiking ? 'Liking...' : 'Like'}
                        </button>
                    </div>

                    {/* Chat Button */}
                    <Link
                        to={`/messages/${user.id}`}
                        className="mt-3 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center block"
                    >
                        💬 Send Message
                    </Link>
                </div>
            </div>
        </div>
    );
}