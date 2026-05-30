const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const friendsRouter = require('./routes/friends');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const statusRoutes = require('./routes/status');
const jwt = require('jsonwebtoken');

dotenv.config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchRoutes = require('./routes/matches');
const messageRoutes = require('./routes/messages');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const db = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
   cors: {
        origin: [FRONTEND_URL, 'http://localhost:5173', 'https://hookup-app-fawn.vercel.app'],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e8 // 100 MB for signaling data
});

// Configure multer for post media uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/posts';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
});

// Ensure uploads directories exist
['uploads', 'uploads/posts', 'uploads/profiles', 'uploads/status'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// CORS middleware - MUST be first
app.use((req, res, next) => {
    const allowedOrigins = [FRONTEND_URL, 'http://localhost:5173', 'https://hookup-app-fawn.vercel.app'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
     if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Use cors middleware
app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'https://hookup-app-fawn.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Other middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static('uploads', {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/friends', friendsRouter);

// ========== COMMUNITY POSTS ROUTES ==========

// Middleware to verify token for posts
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Get posts with filtering
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const { filter = 'all', limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;
        
        let query;
        let params = [userId];
        
        switch(filter) {
            case 'friends':
                query = `
                    SELECT DISTINCT p.*, 
                        u.name as user_name, 
                        u.photos[1] as user_photo,
                        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                        (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
                        TRUE as is_friend
                    FROM posts p
                    JOIN users u ON p.user_id = u.id
                    JOIN friends f ON (f.user_id = $1 AND f.friend_id = p.user_id) 
                                   OR (f.friend_id = $1 AND f.user_id = p.user_id)
                    WHERE f.status = 'accepted'
                    ORDER BY p.created_at DESC
                    LIMIT $2 OFFSET $3
                `;
                params.push(limit, offset);
                break;
                
            case 'matches':
                query = `
                    SELECT DISTINCT p.*,
                        u.name as user_name,
                        u.photos[1] as user_photo,
                        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                        (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
                        TRUE as is_match
                    FROM posts p
                    JOIN users u ON p.user_id = u.id
                    JOIN matches m ON (m.user1_id = $1 AND m.user2_id = p.user_id)
                                  OR (m.user2_id = $1 AND m.user1_id = p.user_id)
                    WHERE m.status = 'active'
                    ORDER BY p.created_at DESC
                    LIMIT $2 OFFSET $3
                `;
                params.push(limit, offset);
                break;
                
            case 'new':
                query = `
                    SELECT DISTINCT p.*,
                        u.name as user_name,
                        u.photos[1] as user_photo,
                        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                        (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
                        TRUE as is_new
                    FROM posts p
                    JOIN users u ON p.user_id = u.id
                    WHERE p.user_id != $1
                        AND NOT EXISTS(
                            SELECT 1 FROM friends 
                            WHERE (user_id = $1 AND friend_id = p.user_id)
                               OR (friend_id = $1 AND user_id = p.user_id)
                        )
                        AND NOT EXISTS(
                            SELECT 1 FROM matches
                            WHERE (user1_id = $1 AND user2_id = p.user_id)
                               OR (user2_id = $1 AND user1_id = p.user_id)
                        )
                    ORDER BY p.created_at DESC
                    LIMIT $2 OFFSET $3
                `;
                params.push(limit, offset);
                break;
                
            default: // 'all'
                query = `
                    SELECT DISTINCT p.*,
                        u.name as user_name,
                        u.photos[1] as user_photo,
                        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                        (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
                        EXISTS(
                            SELECT 1 FROM friends 
                            WHERE ((user_id = $1 AND friend_id = p.user_id)
                               OR (friend_id = $1 AND user_id = p.user_id))
                              AND status = 'accepted'
                        ) as is_friend,
                        EXISTS(
                            SELECT 1 FROM matches
                            WHERE (user1_id = $1 AND user2_id = p.user_id)
                               OR (user2_id = $1 AND user1_id = p.user_id)
                        ) as is_match
                    FROM posts p
                    JOIN users u ON p.user_id = u.id
                    ORDER BY p.created_at DESC
                    LIMIT $2 OFFSET $3
                `;
                params.push(limit, offset);
        }
        
        const result = await db.query(query, params);
        
        // Fetch comments for each post
        const posts = await Promise.all(result.rows.map(async (post) => {
            const commentsResult = await db.query(
                `SELECT c.*, u.name as user_name 
                 FROM comments c 
                 JOIN users u ON c.user_id = u.id 
                 WHERE c.post_id = $1 
                 ORDER BY c.created_at ASC 
                 LIMIT 50`,
                [post.id]
            );
            return {
                ...post,
                comments: commentsResult.rows
            };
        }));
        
        res.json({ posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Create post
app.post('/api/posts', authenticateToken, upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        
        if (!content && !req.file) {
            return res.status(400).json({ error: 'Post must have content or media' });
        }
        
        const mediaUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;
        const mediaType = req.file?.mimetype.startsWith('video') ? 'video' : 'image';
        
        const result = await db.query(
            `INSERT INTO posts (user_id, content, media_url, media_type) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [userId, content, mediaUrl, mediaType]
        );
        
        const post = result.rows[0];
        const userResult = await db.query(
            'SELECT name, photos FROM users WHERE id = $1',
            [userId]
        );
        
        post.user_name = userResult.rows[0].name;
        post.user_photo = userResult.rows[0].photos?.[0];
        post.likes_count = 0;
        post.comments_count = 0;
        post.shares_count = 0;
        post.comments = [];
        
        // Notify connected users about new post
        io.emit('new-post', { post });
        
        res.status(201).json({ post });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Get single post
app.get('/api/posts/:postId', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            `SELECT p.*, 
                u.name as user_name, 
                u.photos[1] as user_photo,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.id = $2`,
            [userId, postId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Fetch comments
        const commentsResult = await db.query(
            `SELECT c.*, u.name as user_name 
             FROM comments c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.post_id = $1 
             ORDER BY c.created_at ASC`,
            [postId]
        );
        
        const post = {
            ...result.rows[0],
            comments: commentsResult.rows
        };
        
        res.json({ post });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// Delete post
app.delete('/api/posts/:postId', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
        
        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (postResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }
        
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Like post
app.post('/api/posts/:postId/like', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        // Check if already liked
        const existingLike = await db.query(
            'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
        );
        
        if (existingLike.rows.length > 0) {
            return res.status(400).json({ error: 'Post already liked' });
        }
        
        await db.query(
            'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
            [userId, postId]
        );
        
        // Get updated likes count
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM likes WHERE post_id = $1',
            [postId]
        );
        
        // Notify post owner via socket
        const postResult = await db.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
        if (postResult.rows.length > 0) {
            const postOwnerId = postResult.rows[0].user_id;
            const postOwnerSocketId = connectedUsers.get(postOwnerId);
            if (postOwnerSocketId && postOwnerId !== userId) {
                io.to(postOwnerSocketId).emit('post-liked', {
                    postId,
                    likedBy: userId,
                    timestamp: Date.now()
                });
            }
        }
        
        res.json({ 
            success: true, 
            likes_count: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// Unlike post
app.delete('/api/posts/:postId/like', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
        );
        
        if (result.rowCount === 0) {
            return res.status(400).json({ error: 'Post not liked yet' });
        }
        
        // Get updated likes count
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM likes WHERE post_id = $1',
            [postId]
        );
        
        res.json({ 
            success: true, 
            likes_count: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error unliking post:', error);
        res.status(500).json({ error: 'Failed to unlike post' });
    }
});

// Comment on post
app.post('/api/posts/:postId/comment', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }
        
        const result = await db.query(
            `INSERT INTO comments (user_id, post_id, content) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [userId, postId, content]
        );
        
        const comment = result.rows[0];
        const userResult = await db.query(
            'SELECT name FROM users WHERE id = $1',
            [userId]
        );
        
        comment.user_name = userResult.rows[0].name;
        
        // Get updated comments count
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
            [postId]
        );
        
        // Notify post owner via socket
        const postResult = await db.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
        if (postResult.rows.length > 0 && postResult.rows[0].user_id !== userId) {
            const postOwnerId = postResult.rows[0].user_id;
            const postOwnerSocketId = connectedUsers.get(postOwnerId);
            if (postOwnerSocketId) {
                io.to(postOwnerSocketId).emit('post-commented', {
                    postId,
                    commentId: comment.id,
                    commentedBy: userId,
                    timestamp: Date.now()
                });
            }
        }
        
        // Broadcast comment to post room
        io.to(`post-${postId}`).emit('new-comment', {
            postId,
            comment,
            timestamp: Date.now()
        });
        
        res.status(201).json({ 
            comment,
            comments_count: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Delete comment
app.delete('/api/posts/:postId/comment/:commentId', authenticateToken, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;
        
        const commentResult = await db.query(
            'SELECT * FROM comments WHERE id = $1 AND post_id = $2',
            [commentId, postId]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        if (commentResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }
        
        await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Share post
app.post('/api/posts/:postId/share', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query(
            'INSERT INTO shares (user_id, post_id) VALUES ($1, $2)',
            [userId, postId]
        );
        
        // Get updated shares count
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM shares WHERE post_id = $1',
            [postId]
        );
        
        res.json({ 
            success: true, 
            shares_count: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error sharing post:', error);
        res.status(500).json({ error: 'Failed to share post' });
    }
});

// Search users for @mentions
app.get('/api/posts/mentions/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 1) {
            return res.json({ users: [] });
        }
        
        const result = await db.query(
            `SELECT id, name, photos[1] as photo 
             FROM users 
             WHERE name ILIKE $1 AND id != $2
             LIMIT 5`,
            [`%${q}%`, req.user.id]
        );
        
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Get trending/popular posts
app.get('/api/posts/trending', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;
        
        const result = await db.query(
            `SELECT p.*, 
                u.name as user_name, 
                u.photos[1] as user_photo,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                (SELECT COUNT(*) FROM shares WHERE post_id = p.id) as shares_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as is_liked,
                ((SELECT COUNT(*) FROM likes WHERE post_id = p.id) * 2 +
                 (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 3 +
                 (SELECT COUNT(*) FROM shares WHERE post_id = p.id) * 4) as popularity_score
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.created_at > NOW() - INTERVAL '24 hours'
             ORDER BY popularity_score DESC
             LIMIT $2`,
            [userId, limit]
        );
        
        res.json({ posts: result.rows });
    } catch (error) {
        console.error('Error fetching trending posts:', error);
        res.status(500).json({ error: 'Failed to fetch trending posts' });
    }
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!', timestamp: new Date() });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Test auth endpoint
app.get('/api/test-auth', (req, res) => {
    console.log('Test auth headers:', req.headers.authorization);
    res.json({ message: 'Auth test endpoint reached', headers: req.headers.authorization });
});

// ========== SOCKET.IO - COMPLETE IMPLEMENTATION ==========
const connectedUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callKey -> callData
const userSockets = new Map(); // socketId -> userId (reverse mapping)

// Helper function to clean up calls involving a user
const cleanupUserCalls = (userId, reason = 'User disconnected') => {
    const numericUserId = Number(userId);
    const callsToCleanup = [];
    
    // Find all calls involving this user
    for (let [callKey, callData] of activeCalls.entries()) {
        if (callData.caller === numericUserId || callData.receiver === numericUserId) {
            const otherParty = callData.caller === numericUserId ? callData.receiver : callData.caller;
            const otherSocketId = connectedUsers.get(otherParty);
            
            if (otherSocketId) {
                io.to(otherSocketId).emit('call-ended', {
                    from: numericUserId,
                    reason: reason,
                    timestamp: Date.now()
                });
            }
            
            callsToCleanup.push(callKey);
        }
    }
    
    // Remove cleaned calls
    callsToCleanup.forEach(key => activeCalls.delete(key));
    
    if (callsToCleanup.length > 0) {
        console.log(`🧹 Cleaned up ${callsToCleanup.length} calls for user ${numericUserId}`);
    }
};

// Helper function to notify user about call events
const notifyCallEvent = (toUserId, event, data) => {
    const socketId = connectedUsers.get(Number(toUserId));
    if (socketId) {
        io.to(socketId).emit(event, {
            ...data,
            timestamp: Date.now()
        });
        return true;
    }
    return false;
};

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    // Track socket connection time
    socket.connectionTime = new Date();

    // ========== USER ONLINE/OFFLINE MANAGEMENT ==========
    
    // User comes online
    socket.on('user-online', async (userId) => {
        console.log(`👤 User-online event received for user: ${userId} from socket: ${socket.id}`);
        
        const numericUserId = Number(userId);
        
        // If user already has a socket, disconnect the old one
        const existingSocketId = connectedUsers.get(numericUserId);
        if (existingSocketId && existingSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingSocketId);
            if (oldSocket) {
                console.log(`🔄 Disconnecting old socket ${existingSocketId} for user ${numericUserId}`);
                oldSocket.disconnect(true);
            }
        }
        
        // Store the mapping
        connectedUsers.set(numericUserId, socket.id);
        userSockets.set(socket.id, numericUserId);
        socket.userId = numericUserId;
        
        console.log('📊 Current connected users:', Array.from(connectedUsers.entries()));
        
        try {
            await db.query(
                'UPDATE users SET online_status = true, last_active = NOW() WHERE id = $1', 
                [numericUserId]
            );
            
            // Broadcast online status to all connected clients
            io.emit('user-status-changed', { 
                userId: numericUserId, 
                status: 'online',
                timestamp: Date.now()
            });
            
            console.log(`✅ User ${numericUserId} is now online (socket: ${socket.id})`);
            
            // Notify user of any pending calls or messages
            socket.emit('connection-confirmed', {
                userId: numericUserId,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    });

    // ========== POSTS ROOM MANAGEMENT ==========
    
    // Join post room for real-time comment updates
    socket.on('join-post', (postId) => {
        const room = `post-${postId}`;
        socket.join(room);
        console.log(`📢 Socket ${socket.id} joined post room: ${room}`);
    });
    
    // Leave post room
    socket.on('leave-post', (postId) => {
        const room = `post-${postId}`;
        socket.leave(room);
        console.log(`👋 Socket ${socket.id} left post room: ${room}`);
    });
    
    // User is commenting on a post
    socket.on('commenting', (data) => {
        const { postId, userId } = data;
        socket.to(`post-${postId}`).emit('user-commenting', {
            postId,
            userId,
            timestamp: Date.now()
        });
    });

    // ========== CHAT ROOM MANAGEMENT ==========
    
    // Join a specific chat room
    socket.on('join-chat', (roomId) => {
        socket.join(roomId);
        console.log(`📢 Socket ${socket.id} joined room: ${roomId}`);
        
        // Notify room members
        socket.to(roomId).emit('user-joined-room', {
            userId: socket.userId,
            roomId: roomId,
            timestamp: Date.now()
        });
    });

    // Leave chat room
    socket.on('leave-chat', (roomId) => {
        socket.leave(roomId);
        console.log(`👋 Socket ${socket.id} left room: ${roomId}`);
        
        socket.to(roomId).emit('user-left-room', {
            userId: socket.userId,
            roomId: roomId,
            timestamp: Date.now()
        });
    });

    // ========== MESSAGING ==========
    
    // Send private message
    socket.on('private-message', (data) => {
        const { from, to, message, messageId, tempId, image } = data;
        console.log(`💬 Message from ${from} to ${to}`);
        
        const numericTo = Number(to);
        const numericFrom = Number(from);
        const recipientSocketId = connectedUsers.get(numericTo);
        
        const messageData = {
            id: messageId,
            from: numericFrom,
            to: numericTo,
            message: message,
            image: image,
            created_at: new Date().toISOString(),
            tempId: tempId
        };
        
        if (recipientSocketId) {
            // Deliver message to recipient
            io.to(recipientSocketId).emit('new-message', messageData);
            
            // Confirm delivery to sender
            socket.emit('message-delivered', { 
                messageId, 
                tempId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Message delivered to user ${numericTo}`);
            
            // Also emit to chat room if exists
            const roomId = [numericFrom, numericTo].sort().join('-');
            io.to(roomId).emit('message-sent', messageData);
            
        } else {
            console.log(`⚠️ User ${numericTo} not connected, message stored in DB only`);
            
            // Notify sender that message was stored but not delivered
            socket.emit('message-stored', {
                messageId,
                tempId,
                status: 'stored',
                timestamp: Date.now()
            });
        }
    });

    // User is typing
    socket.on('typing', (data) => {
        const { from, to } = data;
        const recipientSocketId = connectedUsers.get(Number(to));
        
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('user-typing', { 
                from: Number(from), 
                isTyping: true,
                timestamp: Date.now()
            });
        }
    });

    // User stopped typing
    socket.on('stop-typing', (data) => {
        const { from, to } = data;
        const recipientSocketId = connectedUsers.get(Number(to));
        
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('user-typing', { 
                from: Number(from), 
                isTyping: false,
                timestamp: Date.now()
            });
        }
    });

    // Mark messages as read
    socket.on('mark-read', async (data) => {
        const { from, to } = data;
        const numericFrom = Number(from);
        const numericTo = Number(to);
        
        try {
            const result = await db.query(
                `UPDATE messages SET is_read = true 
                 WHERE from_user = $1 AND to_user = $2 AND is_read = false
                 RETURNING id`,
                [numericFrom, numericTo]
            );
            
            const updatedCount = result.rowCount;
            
            // Notify the sender that messages were read
            const senderSocketId = connectedUsers.get(numericFrom);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages-read', { 
                    by: numericTo, 
                    from: numericFrom,
                    count: updatedCount,
                    timestamp: Date.now()
                });
            }
            
            console.log(`✅ Marked ${updatedCount} messages as read from ${numericFrom} to ${numericTo}`);
        } catch (error) {
            console.error('Error marking messages as read:', error);
            socket.emit('error', { message: 'Failed to mark messages as read' });
        }
    });

    // ========== USER UPDATES ==========
    
    // New user registered
    socket.on('new-user-registered', async (userData) => {
        io.emit('user-list-update', { 
            action: 'new', 
            user: userData,
            timestamp: Date.now()
        });
        console.log(`🆕 New user registered: ${userData.name}`);
    });

    // User updated profile
    socket.on('user-profile-updated', async (userId) => {
        io.emit('profile-updated', { 
            userId: Number(userId),
            timestamp: Date.now()
        });
        console.log(`📸 User ${userId} updated profile`);
    });

    // ========== CALL SIGNALING - COMPLETE IMPLEMENTATION ==========
    
    // Forward call signals (ICE candidates, SDP offers/answers)
    socket.on('call-signal', ({ to, signal, from }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        
        console.log(`📡 Signal from ${numericFrom} to ${numericTo}, type: ${signal?.type || 'candidate'}`);
        
        const recipientSocketId = connectedUsers.get(numericTo);
        
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call-signal', { 
                signal, 
                from: numericFrom,
                timestamp: Date.now()
            });
            console.log(`✅ Signal forwarded to user ${numericTo}`);
            
            // Confirm signal delivery to sender
            socket.emit('signal-delivered', {
                to: numericTo,
                signalType: signal?.type || 'candidate',
                timestamp: Date.now()
            });
        } else {
            console.log(`❌ User ${numericTo} not connected for signaling`);
            socket.emit('call-error', { 
                message: 'User is offline or not connected',
                code: 'USER_OFFLINE',
                timestamp: Date.now()
            });
            
            // Clean up any existing call between these users
            cleanupUserCalls(numericFrom, 'Recipient offline');
        }
    });

    // Initiate call
    socket.on('call-user', ({ to, from, isVideo }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        
        console.log(`📞 Call initiated from ${numericFrom} to ${numericTo}, video: ${isVideo}`);
        console.log('Current connected users:', Array.from(connectedUsers.entries()));
        
        // Check if caller is online
        if (!connectedUsers.has(numericFrom)) {
            socket.emit('call-error', {
                message: 'You are not registered as online. Please reconnect.',
                code: 'CALLER_OFFLINE',
                timestamp: Date.now()
            });
            return;
        }
        
        // Check if there's already an active call between these users
        const callKey1 = `${numericFrom}-${numericTo}`;
        const callKey2 = `${numericTo}-${numericFrom}`;
        
        if (activeCalls.has(callKey1) || activeCalls.has(callKey2)) {
            const existingCall = activeCalls.get(callKey1) || activeCalls.get(callKey2);
            
            socket.emit('call-error', { 
                message: 'There is already an active call between these users',
                code: 'CALL_ACTIVE',
                existingCall: {
                    startTime: existingCall.startTime,
                    isVideo: existingCall.isVideo
                },
                timestamp: Date.now()
            });
            console.log('❌ Call rejected - already active');
            return;
        }
        
        const recipientSocketId = connectedUsers.get(numericTo);
        
        if (recipientSocketId) {
            // Create unique call key
            const callKey = `${numericFrom}-${numericTo}`;
            
            // Track the call
            const callData = {
                id: callKey,
                caller: numericFrom,
                receiver: numericTo,
                startTime: new Date(),
                isVideo: Boolean(isVideo),
                status: 'ringing',
                callerSocket: socket.id,
                receiverSocket: recipientSocketId
            };
            
            activeCalls.set(callKey, callData);
            
            // Notify the recipient of incoming call
            io.to(recipientSocketId).emit('incoming-call', {
                from: numericFrom,
                isVideo: Boolean(isVideo),
                callerInfo: { 
                    id: numericFrom,
                    socketId: socket.id
                },
                callId: callKey,
                timestamp: Date.now()
            });
            
            console.log(`✅ Incoming call notification sent to ${numericTo}, callId: ${callKey}`);
            
            // Notify caller that call is ringing
            socket.emit('call-status-update', {
                to: numericTo,
                from: numericFrom,
                status: 'ringing',
                callId: callKey,
                timestamp: Date.now()
            });
            
            // Set timeout for unanswered calls (30 seconds)
            const callTimeout = setTimeout(() => {
                const activeCall = activeCalls.get(callKey);
                if (activeCall && activeCall.status === 'ringing') {
                    console.log(`⏰ Call ${callKey} timed out`);
                    
                    // Notify both parties
                    const callerSocket = io.sockets.sockets.get(activeCall.callerSocket);
                    const receiverSocket = io.sockets.sockets.get(activeCall.receiverSocket);
                    
                    if (callerSocket) {
                        callerSocket.emit('call-rejected', {
                            from: numericTo,
                            reason: 'No answer',
                            callId: callKey,
                            timestamp: Date.now()
                        });
                    }
                    
                    if (receiverSocket) {
                        receiverSocket.emit('call-missed', {
                            from: numericFrom,
                            callId: callKey,
                            timestamp: Date.now()
                        });
                    }
                    
                    activeCalls.delete(callKey);
                }
            }, 30000);
            
            // Store timeout reference
            callData.timeout = callTimeout;
            activeCalls.set(callKey, callData);
            
        } else {
            console.log(`❌ User ${numericTo} is offline`);
            console.log('Available users:', Array.from(connectedUsers.keys()));
            
            socket.emit('call-error', { 
                message: 'User is offline or not connected',
                code: 'USER_OFFLINE',
                timestamp: Date.now()
            });
        }
    });


    // Accept call
    socket.on('accept-call', ({ to, from }) => {
        const numericTo = Number(to);  // Original caller
        const numericFrom = Number(from);  // Person accepting
        
        console.log(`✅ Call accepted by ${numericFrom} for ${numericTo}`);
        
        // Find the active call
        const callKey = `${numericTo}-${numericFrom}`;
        const reverseCallKey = `${numericFrom}-${numericTo}`;
        let callData = activeCalls.get(callKey) || activeCalls.get(reverseCallKey);
        
        if (callData) {
            // Clear the timeout
            if (callData.timeout) {
                clearTimeout(callData.timeout);
            }
            
            // Update call data
            callData.accepted = true;
            callData.acceptedTime = new Date();
            callData.status = 'connected';
            
            // Use the correct key
            const activeKey = activeCalls.has(callKey) ? callKey : reverseCallKey;
            activeCalls.set(activeKey, callData);
            
            // Notify the original caller
            const callerSocketId = connectedUsers.get(numericTo);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call-accepted', { 
                    from: numericFrom,
                    callId: activeKey,
                    timestamp: Date.now()
                });
                console.log(`📞 Call established between ${numericTo} and ${numericFrom}`);
                
                // Also notify the acceptor for confirmation
                socket.emit('call-connected', {
                    to: numericTo,
                    from: numericFrom,
                    callId: activeKey,
                    timestamp: Date.now()
                });
            } else {
                console.log(`❌ Original caller ${numericTo} disconnected`);
                socket.emit('call-error', { 
                    message: 'Caller disconnected',
                    code: 'CALLER_OFFLINE',
                    timestamp: Date.now()
                });
                
                // Clean up the call
                activeCalls.delete(activeKey);
            }
        } else {
            console.log(`❌ No active call found between ${numericTo} and ${numericFrom}`);
            socket.emit('call-error', {
                message: 'No active call found',
                code: 'NO_CALL',
                timestamp: Date.now()
            });
        }
    });

    // Reject call
    socket.on('reject-call', ({ to, from, reason }) => {
        const numericTo = Number(to);  // Original caller
        const numericFrom = Number(from);  // Person rejecting
        
        console.log(`❌ Call rejected by ${numericFrom} for ${numericTo}, reason: ${reason || 'No reason'}`);
        
        // Find and clean up the call
        const callKey1 = `${numericTo}-${numericFrom}`;
        const callKey2 = `${numericFrom}-${numericTo}`;
        
        let callData = activeCalls.get(callKey1) || activeCalls.get(callKey2);
        if (callData && callData.timeout) {
            clearTimeout(callData.timeout);
        }
        
        activeCalls.delete(callKey1);
        activeCalls.delete(callKey2);
        
        console.log('Active calls after reject:', Array.from(activeCalls.entries()));
        
        // Notify the original caller
        const callerSocketId = connectedUsers.get(numericTo);
        if (callerSocketId) {
            io.to(callerSocketId).emit('call-rejected', {
                from: numericFrom,
                reason: reason || 'Call declined',
                timestamp: Date.now()
            });
        }
        
        // Confirm rejection to the rejector
        socket.emit('call-rejected-confirmed', {
            to: numericTo,
            reason: reason || 'Call declined',
            timestamp: Date.now()
        });
    });

    // End call
    socket.on('end-call', ({ to, from }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        
        console.log(`🔴 Call ended by ${numericFrom} for ${numericTo}`);
        
        // Find and clean up all possible call key combinations
        const keysToDelete = [];
        for (let [callKey, callData] of activeCalls.entries()) {
            if ((callData.caller === numericFrom && callData.receiver === numericTo) ||
                (callData.caller === numericTo && callData.receiver === numericFrom)) {
                
                if (callData.timeout) {
                    clearTimeout(callData.timeout);
                }
                
                // Notify the other party
                const otherParty = callData.caller === numericFrom ? callData.receiver : callData.caller;
                const otherSocketId = connectedUsers.get(otherParty);
                
                if (otherSocketId) {
                    io.to(otherSocketId).emit('call-ended', {
                        from: numericFrom,
                        reason: 'Call ended by user',
                        callId: callKey,
                        timestamp: Date.now()
                    });
                }
                
                keysToDelete.push(callKey);
            }
        }
        
        // Remove cleaned calls
        keysToDelete.forEach(key => activeCalls.delete(key));
        
        console.log('Active calls after end:', Array.from(activeCalls.entries()));
        
        // Confirm end to the person who ended the call
        socket.emit('call-ended-confirmed', {
            to: numericTo,
            from: numericFrom,
            timestamp: Date.now()
        });
    });

    // Store call logs
    socket.on('save-call-log', async (data) => {
        const { callerId, receiverId, callType, duration, status, startedAt } = data;
        
        try {
            const result = await db.query(
                `INSERT INTO call_logs (caller_id, receiver_id, call_type, duration, status, started_at, ended_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 RETURNING *`,
                [callerId, receiverId, callType, duration, status, startedAt]
            );
            
            // Emit to both users for UI update
            const callerSocketId = connectedUsers.get(callerId);
            const receiverSocketId = connectedUsers.get(receiverId);
            
            if (callerSocketId) {
                io.to(callerSocketId).emit('call-log-updated', result.rows[0]);
            }
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('call-log-updated', result.rows[0]);
            }
            
        } catch (error) {
            console.error('Error saving call log:', error);
        }
    });

    // Cancel call (before it's answered)
    socket.on('cancel-call', ({ to, from }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        
        console.log(`🚫 Call cancelled by ${numericFrom} for ${numericTo}`);
        
        // Find and clean up the call
        const callKey = `${numericFrom}-${numericTo}`;
        const reverseCallKey = `${numericTo}-${numericFrom}`;
        
        let callData = activeCalls.get(callKey) || activeCalls.get(reverseCallKey);
        if (callData && callData.timeout) {
            clearTimeout(callData.timeout);
        }
        
        activeCalls.delete(callKey);
        activeCalls.delete(reverseCallKey);
        
        // Notify the recipient that the call was cancelled
        const recipientSocketId = connectedUsers.get(numericTo);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call-cancelled', {
                from: numericFrom,
                timestamp: Date.now()
            });
        }
        
        socket.emit('call-cancelled-confirmed', {
            to: numericTo,
            timestamp: Date.now()
        });
    });

    // ========== DISCONNECT HANDLING ==========
    
    // User disconnected
    socket.on('disconnect', async (reason) => {
        console.log(`🔌 Client disconnecting: ${socket.id}, reason: ${reason}`);
        
        let disconnectedUserId = socket.userId;
        
        // Find user by socket ID if not set
        if (!disconnectedUserId) {
            for (let [userId, socketId] of connectedUsers.entries()) {
                if (socketId === socket.id) {
                    disconnectedUserId = userId;
                    break;
                }
            }
        }
        
        // Clean up all references
        if (disconnectedUserId) {
            console.log(`👤 User ${disconnectedUserId} disconnected`);
            
            // Clean up all active calls involving this user
            cleanupUserCalls(disconnectedUserId, 'User disconnected');
            
            // Remove from connected users
            connectedUsers.delete(disconnectedUserId);
            userSockets.delete(socket.id);
            
            // Update database
            try {
                await db.query(
                    'UPDATE users SET online_status = false, last_active = NOW() WHERE id = $1', 
                    [disconnectedUserId]
                );
                
                // Broadcast offline status
                io.emit('user-status-changed', { 
                    userId: disconnectedUserId, 
                    status: 'offline',
                    timestamp: Date.now()
                });
                
                console.log(`✅ User ${disconnectedUserId} marked as offline`);
            } catch (error) {
                console.error('Error updating offline status:', error);
            }
        }
        
        // Clean up user sockets mapping
        userSockets.delete(socket.id);
        
        console.log('Remaining active calls:', Array.from(activeCalls.entries()));
        console.log('Remaining connected users:', Array.from(connectedUsers.entries()));
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
    });
});

// Periodic cleanup of stale calls (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes
    
    for (let [callKey, callData] of activeCalls.entries()) {
        const callAge = now - callData.startTime.getTime();
        
        if (callAge > staleTimeout) {
            console.log(`🧹 Cleaning up stale call: ${callKey}, age: ${Math.round(callAge / 1000)}s`);
            
            // Notify both parties if possible
            [callData.caller, callData.receiver].forEach(userId => {
                const socketId = connectedUsers.get(userId);
                if (socketId) {
                    io.to(socketId).emit('call-ended', {
                        reason: 'Call timed out',
                        callId: callKey,
                        timestamp: Date.now()
                    });
                }
            });
            
            if (callData.timeout) {
                clearTimeout(callData.timeout);
            }
            
            activeCalls.delete(callKey);
        }
    }
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received. Cleaning up...');
    
    // Notify all connected users
    for (let [userId, socketId] of connectedUsers.entries()) {
        io.to(socketId).emit('server-shutdown', {
            message: 'Server is shutting down for maintenance',
            timestamp: Date.now()
        });
    }
    
    // Close all connections
    io.close(() => {
        console.log('✅ All connections closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 Test API: http://localhost:${PORT}/api/test`);
    console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
    console.log(`💬 WebSocket ready for real-time chat`);
    console.log(`📞 WebRTC signaling ready for calls`);
    console.log(`📝 Community posts API ready`);
    console.log(`🕐 Server started at: ${new Date().toISOString()}`);
});

module.exports = { app, server, io };