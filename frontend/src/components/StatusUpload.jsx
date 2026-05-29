import { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function StatusUpload({ onUpload, onClose }) {
    const [uploading, setUploading] = useState(false);
    const [caption, setCaption] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [mediaType, setMediaType] = useState('image');
    const [musicSearch, setMusicSearch] = useState('');
    const [musicResults, setMusicResults] = useState([]);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [localMusicFile, setLocalMusicFile] = useState(null);
    const [localMusicName, setLocalMusicName] = useState('');
    const [duration, setDuration] = useState(30);
    const [showMusicSearch, setShowMusicSearch] = useState(false);
    const [searchingMusic, setSearchingMusic] = useState(false);
    const [musicStartTime, setMusicStartTime] = useState(0);
    const fileInputRef = useRef(null);
    const musicFileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 15 * 1024 * 1024) {
            toast.error('File too large. Max 15MB');
            return;
        }
        
        setSelectedFile(file);
        setMediaType(file.type.startsWith('video') ? 'video' : 'image');
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleLocalMusicSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('audio/')) {
            toast.error('Please select an audio file (MP3, WAV, OGG)');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Music file too large. Max 10MB');
            return;
        }
        
        setLocalMusicFile(file);
        setLocalMusicName(file.name.replace(/\.[^/.]+$/, ''));
        setSelectedMusic(null);
        toast.success(`Music added: ${file.name}`);
    };

    const removeLocalMusic = () => {
        setLocalMusicFile(null);
        setLocalMusicName('');
        if (musicFileInputRef.current) musicFileInputRef.current.value = '';
    };

    const searchMusic = async () => {
        if (!musicSearch.trim()) {
            toast.error('Please enter a song name');
            return;
        }
        
        setSearchingMusic(true);
        try {
            const sampleMusic = [
                { id: 1, title: 'Summer Vibes', artist: 'Beach Waves', duration: 180, preview_url: '' },
                { id: 2, title: 'Night City', artist: 'Urban Lights', duration: 210, preview_url: '' },
                { id: 3, title: 'Chill Lofi', artist: 'Study Beats', duration: 240, preview_url: '' },
                { id: 4, title: 'Party Time', artist: 'DJ Mix', duration: 200, preview_url: '' },
                { id: 5, title: 'Romantic Sunset', artist: 'Love Songs', duration: 220, preview_url: '' },
                { id: 6, title: 'Electronic Dreams', artist: 'Synth Wave', duration: 195, preview_url: '' },
                { id: 7, title: 'Acoustic Morning', artist: 'Guitar Vibes', duration: 185, preview_url: '' },
                { id: 8, title: 'Hip Hop Beats', artist: 'Street Sounds', duration: 210, preview_url: '' },
            ];
            
            const filtered = sampleMusic.filter(m => 
                m.title.toLowerCase().includes(musicSearch.toLowerCase()) || 
                m.artist.toLowerCase().includes(musicSearch.toLowerCase())
            );
            
            setTimeout(() => {
                setMusicResults(filtered);
                if (filtered.length === 0) {
                    toast.info('No music found, try different keywords');
                }
                setSearchingMusic(false);
            }, 500);
        } catch (error) {
            console.error('Music search error:', error);
            setSearchingMusic(false);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a photo or video');
            return;
        }
        
        setUploading(true);
        const formData = new FormData();
        formData.append('media', selectedFile);
        formData.append('caption', caption);
        formData.append('duration', duration);
        formData.append('musicStartTime', musicStartTime);
        
        if (localMusicFile) {
            formData.append('music', localMusicFile);
            formData.append('musicTitle', localMusicName);
        } else if (selectedMusic) {
            formData.append('musicTitle', selectedMusic.title);
            formData.append('musicUrl', selectedMusic.preview_url || '');
        }
        
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/status/create`, formData, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            toast.success('Status posted! It will disappear after 24 hours');
            if (onUpload) onUpload();
            if (onClose) onClose();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to post status');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-800 font-semibold text-lg">Add Status</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            
            {/* Media Preview */}
            {preview ? (
                <div className="mb-4">
                    {mediaType === 'video' ? (
                        <video src={preview} className="w-full h-64 object-cover rounded-xl" controls />
                    ) : (
                        <img src={preview} alt="Preview" className="w-full h-64 object-cover rounded-xl" />
                    )}
                    <button
                        onClick={() => {
                            setSelectedFile(null);
                            setPreview(null);
                        }}
                        className="mt-2 text-sm text-red-500 hover:text-red-600"
                    >
                        Remove
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-pink-500 transition"
                >
                    <span className="text-4xl">📸</span>
                    <span className="text-gray-500 text-sm">Click to add photo or video</span>
                </button>
            )}
            
            <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
            
            {/* Caption */}
            <input
                type="text"
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full mt-3 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                maxLength="150"
            />
            
            {/* Duration Selector */}
            <div className="mt-4">
                <label className="text-gray-600 text-sm font-medium">Status Duration</label>
                <div className="flex flex-wrap gap-2 mt-2">
                    {[5, 10, 15, 20, 30, 45, 60, 90].map(sec => (
                        <button
                            key={sec}
                            onClick={() => setDuration(sec)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition ${
                                duration === sec 
                                    ? 'bg-pink-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">How long your status will show</p>
            </div>
            
            {/* Music Section */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-gray-600 text-sm font-medium mb-2">🎵 Add Background Music</p>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                        onClick={() => musicFileInputRef.current?.click()}
                        className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 hover:border-pink-500 transition flex flex-col items-center gap-1"
                    >
                        <span className="text-xl">📱</span>
                        <span className="text-xs">Upload from Device</span>
                    </button>
                    
                    <button
                        onClick={() => setShowMusicSearch(!showMusicSearch)}
                        className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 hover:border-pink-500 transition flex flex-col items-center gap-1"
                    >
                        <span className="text-xl">🔍</span>
                        <span className="text-xs">Search Online</span>
                    </button>
                </div>
                
                <input type="file" ref={musicFileInputRef} accept="audio/*" onChange={handleLocalMusicSelect} className="hidden" />
                
                {/* Local Music Selected */}
                {localMusicFile && (
                    <div className="mt-2 p-3 bg-green-50 rounded-xl">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🎵</span>
                                <div>
                                    <p className="text-green-700 text-sm font-medium">{localMusicName}</p>
                                    <p className="text-green-500 text-xs">Local file • {Math.round(localMusicFile.size / 1024)} KB</p>
                                </div>
                            </div>
                            <button onClick={removeLocalMusic} className="text-red-500 hover:text-red-600">✕</button>
                        </div>
                        
                        <div className="mt-3">
                            <label className="text-xs text-gray-500">Music start position:</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={musicStartTime}
                                    onChange={(e) => setMusicStartTime(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs text-gray-500 w-12">{musicStartTime}%</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Music starts at {musicStartTime}% of the status duration</p>
                        </div>
                    </div>
                )}
                
                {/* Online Music Search */}
                {showMusicSearch && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Search for music..."
                                value={musicSearch}
                                onChange={(e) => setMusicSearch(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && searchMusic()}
                                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            <button
                                onClick={searchMusic}
                                disabled={searchingMusic}
                                className="px-4 py-2 bg-pink-500 text-white rounded-lg disabled:opacity-50"
                            >
                                {searchingMusic ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                        
                        {selectedMusic && !localMusicFile && (
                            <div className="mt-2 p-2 bg-pink-50 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-pink-700 text-sm font-medium">{selectedMusic.title}</p>
                                    <p className="text-pink-500 text-xs">{selectedMusic.artist}</p>
                                </div>
                                <button onClick={() => setSelectedMusic(null)} className="text-red-500">✕</button>
                            </div>
                        )}
                        
                        {musicResults.length > 0 && !selectedMusic && (
                            <div className="mt-3 max-h-40 overflow-y-auto space-y-2">
                                {musicResults.map(music => (
                                    <button
                                        key={music.id}
                                        onClick={() => {
                                            setSelectedMusic(music);
                                            setLocalMusicFile(null);
                                            setShowMusicSearch(false);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white rounded-lg transition border border-gray-100"
                                    >
                                        <p className="text-gray-800 text-sm font-medium">{music.title}</p>
                                        <p className="text-gray-500 text-xs">{music.artist}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full mt-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
                {uploading ? 'Posting...' : 'Post Status'}
            </button>
            <p className="text-xs text-gray-400 mt-3 text-center">Status disappears after 24 hours | Duration up to 90 seconds | Add music from device or search online</p>
        </div>
    );
}