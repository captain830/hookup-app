import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { fixImageUrl } from '../utils/imageUrl';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function StatusModal({ user, userStatuses, currentIndex, onClose, onNext, onPrev, onStatusDeleted }) {
    const [currentStatusIndex, setCurrentStatusIndex] = useState(currentIndex || 0);
    const [progress, setProgress] = useState(0);
    const [viewers, setViewers] = useState([]);
    const [reactions, setReactions] = useState([]);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const [showViewers, setShowViewers] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [selectedReaction, setSelectedReaction] = useState(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [editingCaption, setEditingCaption] = useState(false);
    const [editCaptionText, setEditCaptionText] = useState('');
    const progressInterval = useRef(null);
    const audioRef = useRef(null);
    const musicTimeoutRef = useRef(null);
    
    const currentStatus = userStatuses?.[currentStatusIndex];
    const currentUserId = parseInt(localStorage.getItem('userId'));
    const isOwnStatus = user.user_id === currentUserId;

    const reactionOptions = ['❤️', '👍', '😊', '😢', '🔥', '💕', '🎉', '😮'];

    useEffect(() => {
        if (currentStatus) {
            setEditCaptionText(currentStatus.caption || '');
            startProgress();
            fetchStatusDetails();
            setupMusic();
        }
        
        return () => {
            if (progressInterval.current) clearInterval(progressInterval.current);
            if (musicTimeoutRef.current) clearTimeout(musicTimeoutRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [currentStatusIndex]);

    const setupMusic = () => {
        if (!currentStatus?.music_url) return;
        
        audioRef.current = new Audio(fixImageUrl(currentStatus.music_url));
        
        const musicStartDelay = ((currentStatus.music_start_time || 0) / 100) * (currentStatus.duration || 10) * 1000;
        
        musicTimeoutRef.current = setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.log('Audio play failed:', e));
            }
        }, musicStartDelay);
        
        const stopMusicDelay = (currentStatus.duration || 10) * 1000;
        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }, stopMusicDelay);
    };

    const fetchStatusDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/status/${currentStatus.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setViewers(response.data.viewers || []);
            setViewerCount(response.data.viewers?.length || 0);
            setReactions(response.data.reactions || []);
            setComments(response.data.comments || []);
            setLikesCount(response.data.likes_count || 0);
            
            if (!isOwnStatus) {
                const userLiked = response.data.reactions?.some(r => r.user_id === currentUserId && r.reaction_type === '❤️');
                setLiked(userLiked);
                
                const userReaction = response.data.reactions?.find(r => r.user_id === currentUserId);
                if (userReaction) {
                    setSelectedReaction(userReaction.reaction_type);
                }
            }
        } catch (error) {
            console.error('Error fetching status details:', error);
        }
    };

    const startProgress = () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
        setProgress(0);
        
        const durationMs = (currentStatus.duration || 10) * 1000;
        const intervalTime = 50;
        const incrementPerInterval = (100 / durationMs) * intervalTime;
        
        progressInterval.current = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev + incrementPerInterval;
                if (newProgress >= 100) {
                    clearInterval(progressInterval.current);
                    goToNext();
                    return 100;
                }
                return newProgress;
            });
        }, intervalTime);
    };

    const goToNext = () => {
        if (currentStatusIndex + 1 < userStatuses.length) {
            setCurrentStatusIndex(currentStatusIndex + 1);
        } else {
            onClose();
        }
    };

    const goToPrev = () => {
        if (currentStatusIndex - 1 >= 0) {
            setCurrentStatusIndex(currentStatusIndex - 1);
        }
    };

    const handleDeleteStatus = async () => {
        if (confirm('Delete this status? It will be removed permanently.')) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${API_URL}/status/${currentStatus.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success('Status deleted');
                
                const newStatuses = userStatuses.filter((_, idx) => idx !== currentStatusIndex);
                if (newStatuses.length === 0) {
                    onClose();
                    if (onStatusDeleted) onStatusDeleted();
                } else {
                    if (onStatusDeleted) onStatusDeleted();
                }
                setShowOptions(false);
            } catch (error) {
                console.error('Error deleting status:', error);
                toast.error('Failed to delete status');
            }
        }
    };

    const handleEditCaption = async () => {
        if (!editCaptionText.trim()) return;
        
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/status/${currentStatus.id}/caption`, 
                { caption: editCaptionText },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            currentStatus.caption = editCaptionText;
            setEditingCaption(false);
            toast.success('Caption updated');
        } catch (error) {
            console.error('Error updating caption:', error);
            toast.error('Failed to update caption');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!confirm('Delete this comment?')) return;
        
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/status/${currentStatus.id}/comment/${commentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setComments(prev => prev.filter(c => c.id !== commentId));
            toast.success('Comment deleted');
        } catch (error) {
            console.error('Error deleting comment:', error);
            toast.error('Failed to delete comment');
        }
    };

    const handleReplyToComment = async (commentId, commentUserName) => {
        if (!replyText.trim()) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/status/${currentStatus.id}/reply`, 
                { commentId, reply: replyText },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            // Update comments with reply
            setComments(prev => prev.map(c => 
                c.id === commentId 
                    ? { ...c, replies: [...(c.replies || []), { ...response.data.reply, user_name: user.name }] }
                    : c
            ));
            setReplyText('');
            setReplyTo(null);
            toast.success('Reply added');
        } catch (error) {
            console.error('Error adding reply:', error);
            toast.error('Failed to add reply');
        }
    };

    const handleLike = async () => {
        if (isOwnStatus) return;
        
        try {
            const token = localStorage.getItem('token');
            if (liked) {
                await axios.delete(`${API_URL}/status/${currentStatus.id}/like`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setLiked(false);
                setLikesCount(prev => prev - 1);
                setReactions(prev => prev.filter(r => !(r.user_id === currentUserId && r.reaction_type === '❤️')));
                toast.success('Removed like');
            } else {
                await axios.post(`${API_URL}/status/${currentStatus.id}/like`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setLiked(true);
                setLikesCount(prev => prev + 1);
                setReactions(prev => [...prev, { user_id: currentUserId, reaction_type: '❤️', user_name: user.name }]);
                toast.success('Liked! ❤️');
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            toast.error('Failed to like');
        }
    };

    const handleReaction = async (reaction) => {
        if (isOwnStatus) return;
        
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/status/${currentStatus.id}/react`,
                { reaction },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            setSelectedReaction(reaction);
            setShowReactions(false);
            
            const existingIndex = reactions.findIndex(r => r.user_id === currentUserId);
            if (existingIndex >= 0) {
                const newReactions = [...reactions];
                newReactions[existingIndex] = { ...newReactions[existingIndex], reaction_type: reaction };
                setReactions(newReactions);
            } else {
                setReactions(prev => [...prev, { user_id: currentUserId, reaction_type: reaction, user_name: user.name }]);
            }
            
            if (reaction === '❤️') {
                setLiked(true);
                setLikesCount(prev => prev + 1);
            }
            
            toast.success(`Reacted with ${reaction}`);
        } catch (error) {
            console.error('Error adding reaction:', error);
            toast.error('Failed to add reaction');
        }
    };

   const handleComment = async () => {
    if (isOwnStatus) {
        toast.error("You cannot comment on your own status");
        return;
    }
    if (!newComment.trim()) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/status/${currentStatus.id}/comment`, 
            { comment: newComment },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setComments(prev => [{
            id: response.data.comment.id,
            user_id: currentUserId,
            user_name: user.name,
            comment: newComment,
            created_at: new Date().toISOString(),
            replies: []
        }, ...prev]);
        setNewComment('');
        toast.success('Comment added');
    } catch (error) {
        console.error('Error adding comment:', error);
        toast.error('Failed to add comment');
    }
};

    if (!currentStatus) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    // Group reactions for display
    const reactionGroups = {};
    reactions.forEach(r => {
        if (!reactionGroups[r.reaction_type]) {
            reactionGroups[r.reaction_type] = [];
        }
        reactionGroups[r.reaction_type].push(r);
    });

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Progress bars */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-20 px-4">
                {userStatuses.map((_, idx) => (
                    <div key={idx} className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-100 bg-white`}
                            style={{ width: idx === currentStatusIndex ? `${progress}%` : idx < currentStatusIndex ? '100%' : '0%' }}
                        />
                    </div>
                ))}
            </div>
            
            {/* Close button */}
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl z-20 hover:text-gray-300 bg-black/30 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
            
            {/* Options button for creator */}
            {isOwnStatus && (
                <div className="absolute top-4 right-16 z-20">
                    <button 
                        onClick={() => setShowOptions(!showOptions)}
                        className="text-white text-xl hover:text-gray-300 bg-black/30 rounded-full w-8 h-8 flex items-center justify-center"
                    >
                        ⋮
                    </button>
                    {showOptions && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-30">
                            <button
                                onClick={() => {
                                    setEditingCaption(true);
                                    setShowOptions(false);
                                }}
                                className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 text-sm"
                            >
                                ✏️ Edit Caption
                            </button>
                            <button
                                onClick={handleDeleteStatus}
                                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 text-sm"
                            >
                                🗑️ Delete Status
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {/* Edit Caption Modal */}
            {editingCaption && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-2xl p-6 w-96">
                        <h3 className="text-white font-semibold mb-4">Edit Caption</h3>
                        <textarea
                            value={editCaptionText}
                            onChange={(e) => setEditCaptionText(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white mb-4"
                            rows="3"
                            maxLength="150"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleEditCaption}
                                className="flex-1 py-2 bg-pink-500 rounded-lg text-white"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setEditingCaption(false)}
                                className="flex-1 py-2 bg-gray-600 rounded-lg text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Status content */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-md max-h-[70vh] w-full rounded-2xl overflow-hidden">
                    {currentStatus.media_type === 'video' ? (
                        <video 
                            src={fixImageUrl(currentStatus.media_url)} 
                            autoPlay 
                            muted
                            className="w-full h-full object-contain"
                            onEnded={() => goToNext()}
                        />
                    ) : (
                        <img 
                            src={fixImageUrl(currentStatus.media_url)} 
                            alt="Status"
                            className="w-full h-full object-contain rounded-2xl"
                        />
                    )}
                </div>
            </div>
            
            {/* Caption */}
            {currentStatus.caption && !editingCaption && (
                <div className="absolute bottom-24 left-0 right-0 px-4 text-center z-10">
                    <p className="text-white text-base drop-shadow-lg bg-black/40 inline-block px-4 py-2 rounded-full mx-auto">
                        {currentStatus.caption}
                    </p>
                </div>
            )}
            
            {/* User info */}
            <div className="absolute top-14 left-4 flex items-center gap-3 z-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 p-0.5">
                    <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                        {user.user_photo && user.user_photo[0] ? (
                            <img src={fixImageUrl(user.user_photo?.[0])}
 alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600">
                                <span className="text-white text-lg font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <p className="text-white font-semibold">{user.name}</p>
                    <p className="text-xs text-gray-300">{new Date(currentStatus.created_at).toLocaleTimeString()}</p>
                </div>
            </div>
            
            {/* Music indicator */}
            {currentStatus.music_title && (
                <div className="absolute bottom-24 left-4 bg-black/50 rounded-full px-3 py-1 flex items-center gap-2 z-10">
                    <span className="text-white text-sm animate-pulse">🎵</span>
                    <span className="text-white text-xs">{currentStatus.music_title}</span>
                </div>
            )}
            
            {/* Interaction Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-4 z-10">
                <div className="flex justify-around items-center max-w-md mx-auto">
                    {/* Comments - Always visible to everyone */}
                    <button 
                        onClick={() => setShowComments(!showComments)} 
                        className="flex flex-col items-center gap-1 text-white hover:text-pink-400 transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-xs">{comments.length}</span>
                    </button>
                    
                    {/* Like - Only for non-creators */}
                    {!isOwnStatus && (
                        <button 
                            onClick={handleLike} 
                            className="flex flex-col items-center gap-1 transition"
                        >
                            <svg className={`w-7 h-7 ${liked ? 'text-pink-500 fill-pink-500' : 'text-white'}`} fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <span className="text-xs text-white">{likesCount}</span>
                        </button>
                    )}
                    
                    {/* Reactions - Only for non-creators */}
                    {!isOwnStatus && (
                        <div className="relative">
                            <button 
                                onClick={() => setShowReactions(!showReactions)} 
                                className="flex flex-col items-center gap-1 text-white hover:text-pink-400 transition"
                            >
                                <span className="text-2xl">{selectedReaction || '😊'}</span>
                                <span className="text-xs">{reactions.length}</span>
                            </button>
                            
                            {showReactions && (
                                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/90 rounded-full p-2 flex gap-2 z-30 backdrop-blur-sm border border-gray-700">
                                    {reactionOptions.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => handleReaction(emoji)}
                                            className="w-9 h-9 text-2xl hover:scale-125 transition-transform"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Viewers - ONLY for creator */}
                    {isOwnStatus && (
                        <button 
                            onClick={() => setShowViewers(!showViewers)} 
                            className="flex flex-col items-center gap-1 text-white hover:text-pink-400 transition"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-xs">{viewerCount}</span>
                        </button>
                    )}
                    
                    {/* For creator - reactions count (without ability to react) */}
                    {isOwnStatus && reactions.length > 0 && (
                        <button 
                            onClick={() => setShowReactions(!showReactions)} 
                            className="flex flex-col items-center gap-1 text-white hover:text-pink-400 transition"
                        >
                            <span className="text-xl">😊</span>
                            <span className="text-xs">{reactions.length}</span>
                        </button>
                    )}
                </div>
            </div>
            
            {/* Comments Panel - With replies for creator */}
            {showComments && (
                <div className="absolute bottom-20 left-0 right-0 bg-black/90 p-4 max-h-80 overflow-y-auto z-20">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-white font-semibold">Comments ({comments.length})</h4>
                        <button onClick={() => setShowComments(false)} className="text-gray-400">✕</button>
                    </div>
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                        {comments.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No comments yet.</p>}
                        {comments.map((comment, idx) => (
                            <div key={idx} className="border-b border-gray-700 pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-2 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm flex-shrink-0">
                                            {comment.user_name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white text-sm">
                                                <span className="font-semibold">{comment.user_name}</span> {comment.comment}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1">{new Date(comment.created_at).toLocaleTimeString()}</p>
                                            
                                            {/* Replies */}
                                            {comment.replies && comment.replies.length > 0 && (
                                                <div className="mt-2 ml-6 space-y-2">
                                                    {comment.replies.map((reply, ridx) => (
                                                        <div key={ridx} className="border-l-2 border-pink-500 pl-3">
                                                            <p className="text-gray-300 text-sm">
                                                                <span className="font-semibold">{reply.user_name}</span> {reply.reply}
                                                            </p>
                                                            <p className="text-gray-500 text-xs">{new Date(reply.created_at).toLocaleTimeString()}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Reply input - Creator can reply to anyone */}
                                            {replyTo === comment.id ? (
                                                <div className="mt-2 flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={`Reply to ${comment.user_name}...`}
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleReplyToComment(comment.id, comment.user_name)}
                                                        className="flex-1 px-3 py-1 bg-gray-800 rounded-full text-white text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleReplyToComment(comment.id, comment.user_name)}
                                                        className="px-3 py-1 bg-pink-500 rounded-full text-white text-sm"
                                                    >
                                                        Reply
                                                    </button>
                                                    <button
                                                        onClick={() => setReplyTo(null)}
                                                        className="px-3 py-1 bg-gray-700 rounded-full text-white text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setReplyTo(comment.id)}
                                                    className="text-xs text-gray-400 hover:text-pink-400 mt-1"
                                                >
                                                    Reply
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Delete comment - Only creator can delete any comment */}
                                    {isOwnStatus && (
                                        <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="text-gray-500 hover:text-red-400 text-sm ml-2"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                   {/* Add comment - Everyone EXCEPT creator can comment */}
{!isOwnStatus ? (
    <div className="flex gap-2 mt-3">
        <input
            type="text"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleComment()}
            className="flex-1 px-3 py-2 bg-gray-800 rounded-full text-white text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"
        />
        <button onClick={handleComment} className="px-4 py-2 bg-pink-500 rounded-full text-white text-sm">Send</button>
    </div>
) : (
    <div className="text-center text-gray-500 text-xs py-2 bg-gray-800/50 rounded-full mt-3">
        You cannot comment on your own status
    </div>
)}
                </div>
            )}
            
            {/* Viewers Panel - ONLY for creator */}
            {showViewers && isOwnStatus && viewers.length > 0 && (
                <div className="absolute bottom-20 left-0 right-0 bg-black/90 p-4 max-h-80 overflow-y-auto z-20">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-white font-semibold">Viewed by ({viewerCount})</h4>
                        <button onClick={() => setShowViewers(false)} className="text-gray-400">✕</button>
                    </div>
                    <div className="space-y-2">
                        {viewers.map(viewer => (
                            <div key={viewer.user_id} className="flex items-center gap-2 py-1">
                                <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm">
                                    {viewer.user_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span className="text-white text-sm">{viewer.user_name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Reactions Panel for creator */}
            {showReactions && isOwnStatus && Object.keys(reactionGroups).length > 0 && (
                <div className="absolute bottom-20 left-0 right-0 bg-black/90 p-4 max-h-80 overflow-y-auto z-20">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-white font-semibold">Reactions ({reactions.length})</h4>
                        <button onClick={() => setShowReactions(false)} className="text-gray-400">✕</button>
                    </div>
                    {Object.entries(reactionGroups).map(([reaction, users]) => (
                        <div key={reaction} className="mb-3">
                            <p className="text-gray-300 text-sm mb-1">{reaction} - {users.length} {users.length === 1 ? 'person' : 'people'}</p>
                            <div className="flex flex-wrap gap-1">
                                {users.map((u, idx) => (
                                    <span key={idx} className="text-xs text-gray-300 bg-gray-800 px-2 py-0.5 rounded-full">
                                        {u.user_name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Navigation areas */}
            <button onClick={goToPrev} className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-full cursor-pointer z-10" />
            <button onClick={goToNext} className="absolute right-0 top-1/2 -translate-y-1/2 w-20 h-full cursor-pointer z-10" />
        </div>
    );
}