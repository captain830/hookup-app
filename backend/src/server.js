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
    maxHttpBufferSize: 1e8
});

// Configure multer for post media uploads
const postStorage = multer.diskStorage({
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
    storage: postStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images and videos are allowed'));
    }
});

// Ensure uploads directories exist
['uploads', 'uploads/posts', 'uploads/profiles', 'uploads/status'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// CORS middleware
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
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'https://hookup-app-fawn.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static('uploads'));

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

// Auth middleware - FIXED to properly extract user ID from JWT
const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('❌ JWT verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Log the decoded token to see its structure
        console.log('🔑 JWT decoded payload:', JSON.stringify(decoded));
        
        // Try all possible ID field names
        const userId = decoded.id || decoded.userId || decoded.user_id || decoded.sub;
        
        console.log('🔑 Extracted user ID:', userId, 'Type:', typeof userId);
        
        if (!userId) {
            console.log('❌ No user ID found in token. Token fields:', Object.keys(decoded));
            return res.status(401).json({ error: 'Invalid token - no user ID found' });
        }
        
        req.user = { 
            id: parseInt(userId, 10),
            ...decoded 
        };
        
        console.log('✅ Auth successful for user:', req.user.id);
        next();
    });
};

// Auto-create tables if they don't exist
async function ensureTablesExist() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                content TEXT,
                media_url TEXT,
                media_type VARCHAR(10),
                location TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, post_id)
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS shares (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        console.log('✅ Database tables verified/created');
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
    }
}

// Call on startup
ensureTablesExist();

// GET /api/posts - Fetch posts with counts
app.get('/api/posts', auth, async (req, res) => {
    try {
        console.log('📥 Fetching posts for user:', req.user.id);
        const userId = req.user.id;
        
        const result = await db.query(`
            SELECT 
                p.id, p.user_id, p.content, p.media_url, p.media_type, p.location, p.created_at,
                u.name as user_name, u.photos as user_photos,
                COALESCE((SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id), 0) as likes_count,
                COALESCE((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id), 0) as comments_count,
                COALESCE((SELECT COUNT(*) FROM shares s WHERE s.post_id = p.id), 0) as shares_count,
                EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 50
        `, [userId]);
        
        const posts = await Promise.all(result.rows.map(async (row) => {
            let postComments = [];
            try {
                const commentsResult = await db.query(`
                    SELECT c.id, c.user_id, c.content, c.created_at, u.name as user_name
                    FROM comments c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.post_id = $1
                    ORDER BY c.created_at ASC
                    LIMIT 20
                `, [row.id]);
                postComments = commentsResult.rows;
            } catch (err) {
                // comments table might not exist yet
            }
            
            return {
                id: row.id,
                user_id: row.user_id,
                content: row.content,
                media_url: row.media_url,
                media_type: row.media_type,
                location: row.location,
                created_at: row.created_at,
                user_name: row.user_name || 'Unknown',
                user_photo: Array.isArray(row.user_photos) ? row.user_photos[0] : row.user_photos,
                likes_count: parseInt(row.likes_count) || 0,
                comments_count: parseInt(row.comments_count) || 0,
                shares_count: parseInt(row.shares_count) || 0,
                is_liked: row.is_liked || false,
                comments: postComments
            };
        }));
        
        console.log(`✅ Found ${posts.length} posts`);
        res.json({ posts });
    } catch (error) {
        console.error('❌ Error fetching posts:', error.message);
        res.json({ posts: [] });
    }
});

// POST /api/posts - Create post (FIXED - ensures userId is integer)
app.post('/api/posts', auth, upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        
        console.log('📝 POST - userId:', userId, 'Type:', typeof userId);
        
        // Convert to integer and validate
        const userIdInt = parseInt(userId, 10);
        
        if (!userIdInt || isNaN(userIdInt)) {
            console.error('❌ Invalid user ID:', userId);
            return res.status(401).json({ error: 'Invalid user ID: ' + userId });
        }
        
        if (!content && !req.file) {
            return res.status(400).json({ error: 'Post must have content or media' });
        }
        
        const mediaUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;
        const mediaType = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : null;
        
        console.log('📝 Inserting post - userIdInt:', userIdInt, 'content:', content?.substring(0, 50));
        
        const result = await db.query(
            `INSERT INTO posts (user_id, content, media_url, media_type) VALUES ($1, $2, $3, $4) RETURNING *`,
            [userIdInt, content || '', mediaUrl, mediaType]
        );
        
        const post = result.rows[0];
        
        // Get user info
        let userName = 'Unknown';
        let userPhoto = null;
        try {
            const userResult = await db.query('SELECT name, photos FROM users WHERE id = $1', [userIdInt]);
            if (userResult.rows.length > 0) {
                userName = userResult.rows[0].name || 'Unknown';
                const photos = userResult.rows[0].photos;
                userPhoto = Array.isArray(photos) ? photos[0] : photos;
            }
        } catch (err) {
            console.log('⚠️ Could not fetch user info:', err.message);
        }
        
        const responsePost = {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            media_url: post.media_url,
            media_type: post.media_type,
            created_at: post.created_at,
            user_name: userName,
            user_photo: userPhoto,
            likes_count: 0,
            comments_count: 0,
            shares_count: 0,
            is_liked: false,
            comments: []
        };
        
        io.emit('new-post', { post: responsePost });
        
        console.log('✅ Post created:', responsePost.id);
        res.status(201).json({ post: responsePost });
        
    } catch (error) {
        console.error('❌ POST ERROR:', error.message);
        console.error('❌ Full error:', error);
        res.status(500).json({ error: 'Failed to create post: ' + error.message });
    }
});

// POST /api/posts/:postId/like
app.post('/api/posts/:postId/like', auth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query(
            'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT (user_id, post_id) DO NOTHING',
            [parseInt(userId), parseInt(postId)]
        );
        
        const countResult = await db.query('SELECT COUNT(*) as count FROM likes WHERE post_id = $1', [postId]);
        const likesCount = parseInt(countResult.rows[0].count);
        
        res.json({ success: true, likes_count: likesCount });
    } catch (error) {
        console.error('Error liking post:', error.message);
        res.json({ success: false, likes_count: 0 });
    }
});

// DELETE /api/posts/:postId/like (Unlike)
app.delete('/api/posts/:postId/like', auth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [parseInt(userId), parseInt(postId)]);
        
        const countResult = await db.query('SELECT COUNT(*) as count FROM likes WHERE post_id = $1', [postId]);
        const likesCount = parseInt(countResult.rows[0].count);
        
        res.json({ success: true, likes_count: likesCount });
    } catch (error) {
        console.error('Error unliking post:', error.message);
        res.json({ success: false, likes_count: 0 });
    }
});

// POST /api/posts/:postId/comment
app.post('/api/posts/:postId/comment', auth, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }
        
        const result = await db.query(
            'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
            [parseInt(userId), parseInt(postId), content.trim()]
        );
        
        const comment = result.rows[0];
        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [parseInt(userId)]);
        comment.user_name = userResult.rows[0]?.name || 'Unknown';
        
        const countResult = await db.query('SELECT COUNT(*) as count FROM comments WHERE post_id = $1', [postId]);
        const commentsCount = parseInt(countResult.rows[0].count);
        
        res.status(201).json({ comment, comments_count: commentsCount });
    } catch (error) {
        console.error('Error adding comment:', error.message);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// POST /api/posts/:postId/share
app.post('/api/posts/:postId/share', auth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query('INSERT INTO shares (user_id, post_id) VALUES ($1, $2)', [parseInt(userId), parseInt(postId)]);
        
        const countResult = await db.query('SELECT COUNT(*) as count FROM shares WHERE post_id = $1', [postId]);
        const sharesCount = parseInt(countResult.rows[0].count);
        
        res.json({ success: true, shares_count: sharesCount });
    } catch (error) {
        console.error('Error sharing post:', error.message);
        res.json({ success: false, shares_count: 0 });
    }
});

// DELETE /api/posts/:postId
app.delete('/api/posts/:postId', auth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        const postResult = await db.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
        if (postResult.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        if (postResult.rows[0].user_id !== parseInt(userId)) return res.status(403).json({ error: 'Not authorized' });
        
        await db.query('DELETE FROM posts WHERE id = $1', [postId]);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

console.log('✅ Community posts routes loaded');

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!', timestamp: new Date() });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// ========== SOCKET.IO - COMPLETE IMPLEMENTATION ==========
const connectedUsers = new Map();
const activeCalls = new Map();
const userSockets = new Map();

const cleanupUserCalls = (userId, reason = 'User disconnected') => {
    const numericUserId = Number(userId);
    const callsToCleanup = [];
    for (let [callKey, callData] of activeCalls.entries()) {
        if (callData.caller === numericUserId || callData.receiver === numericUserId) {
            const otherParty = callData.caller === numericUserId ? callData.receiver : callData.caller;
            const otherSocketId = connectedUsers.get(otherParty);
            if (otherSocketId) {
                io.to(otherSocketId).emit('call-ended', { from: numericUserId, reason, timestamp: Date.now() });
            }
            callsToCleanup.push(callKey);
        }
    }
    callsToCleanup.forEach(key => activeCalls.delete(key));
    if (callsToCleanup.length > 0) console.log(`🧹 Cleaned up ${callsToCleanup.length} calls for user ${numericUserId}`);
};

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    socket.connectionTime = new Date();

    socket.on('user-online', async (userId) => {
        const numericUserId = Number(userId);
        const existingSocketId = connectedUsers.get(numericUserId);
        if (existingSocketId && existingSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingSocketId);
            if (oldSocket) { oldSocket.disconnect(true); }
        }
        connectedUsers.set(numericUserId, socket.id);
        userSockets.set(socket.id, numericUserId);
        socket.userId = numericUserId;
        try {
            await db.query('UPDATE users SET online_status = true, last_active = NOW() WHERE id = $1', [numericUserId]);
            io.emit('user-status-changed', { userId: numericUserId, status: 'online', timestamp: Date.now() });
            socket.emit('connection-confirmed', { userId: numericUserId, timestamp: Date.now() });
        } catch (error) { console.error('Error updating online status:', error); }
    });

    socket.on('join-post', (postId) => { socket.join(`post-${postId}`); });
    socket.on('leave-post', (postId) => { socket.leave(`post-${postId}`); });
    socket.on('commenting', (data) => { socket.to(`post-${data.postId}`).emit('user-commenting', { ...data, timestamp: Date.now() }); });

    socket.on('join-chat', (roomId) => { socket.join(roomId); socket.to(roomId).emit('user-joined-room', { userId: socket.userId, roomId, timestamp: Date.now() }); });
    socket.on('leave-chat', (roomId) => { socket.leave(roomId); socket.to(roomId).emit('user-left-room', { userId: socket.userId, roomId, timestamp: Date.now() }); });

    socket.on('private-message', (data) => {
        const { from, to, message, messageId, tempId, image } = data;
        const numericTo = Number(to);
        const numericFrom = Number(from);
        const recipientSocketId = connectedUsers.get(numericTo);
        const messageData = { id: messageId, from: numericFrom, to: numericTo, message, image, created_at: new Date().toISOString(), tempId };
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('new-message', messageData);
            socket.emit('message-delivered', { messageId, tempId, timestamp: Date.now() });
            const roomId = [numericFrom, numericTo].sort().join('-');
            io.to(roomId).emit('message-sent', messageData);
        } else {
            socket.emit('message-stored', { messageId, tempId, status: 'stored', timestamp: Date.now() });
        }
    });

    socket.on('typing', (data) => {
        const recipientSocketId = connectedUsers.get(Number(data.to));
        if (recipientSocketId) io.to(recipientSocketId).emit('user-typing', { from: Number(data.from), isTyping: true, timestamp: Date.now() });
    });

    socket.on('stop-typing', (data) => {
        const recipientSocketId = connectedUsers.get(Number(data.to));
        if (recipientSocketId) io.to(recipientSocketId).emit('user-typing', { from: Number(data.from), isTyping: false, timestamp: Date.now() });
    });

    socket.on('mark-read', async (data) => {
        try {
            const result = await db.query('UPDATE messages SET is_read = true WHERE from_user = $1 AND to_user = $2 AND is_read = false RETURNING id', [Number(data.from), Number(data.to)]);
            const senderSocketId = connectedUsers.get(Number(data.from));
            if (senderSocketId) io.to(senderSocketId).emit('messages-read', { by: Number(data.to), from: Number(data.from), count: result.rowCount, timestamp: Date.now() });
        } catch (error) { console.error('Error marking messages as read:', error); }
    });

    socket.on('new-user-registered', (userData) => { io.emit('user-list-update', { action: 'new', user: userData, timestamp: Date.now() }); });
    socket.on('user-profile-updated', (userId) => { io.emit('profile-updated', { userId: Number(userId), timestamp: Date.now() }); });

    socket.on('call-signal', ({ to, signal, from }) => {
        const recipientSocketId = connectedUsers.get(Number(to));
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call-signal', { signal, from: Number(from), timestamp: Date.now() });
            socket.emit('signal-delivered', { to: Number(to), signalType: signal?.type || 'candidate', timestamp: Date.now() });
        } else {
            socket.emit('call-error', { message: 'User is offline', code: 'USER_OFFLINE', timestamp: Date.now() });
            cleanupUserCalls(Number(from), 'Recipient offline');
        }
    });

    socket.on('call-user', ({ to, from, isVideo }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        if (!connectedUsers.has(numericFrom)) { socket.emit('call-error', { message: 'You are not online', code: 'CALLER_OFFLINE' }); return; }
        const callKey1 = `${numericFrom}-${numericTo}`;
        const callKey2 = `${numericTo}-${numericFrom}`;
        if (activeCalls.has(callKey1) || activeCalls.has(callKey2)) { socket.emit('call-error', { message: 'Call already active', code: 'CALL_ACTIVE' }); return; }
        const recipientSocketId = connectedUsers.get(numericTo);
        if (recipientSocketId) {
            const callKey = `${numericFrom}-${numericTo}`;
            const callData = { id: callKey, caller: numericFrom, receiver: numericTo, startTime: new Date(), isVideo: Boolean(isVideo), status: 'ringing', callerSocket: socket.id, receiverSocket: recipientSocketId };
            activeCalls.set(callKey, callData);
            io.to(recipientSocketId).emit('incoming-call', { from: numericFrom, isVideo: Boolean(isVideo), callerInfo: { id: numericFrom, socketId: socket.id }, callId: callKey, timestamp: Date.now() });
            socket.emit('call-status-update', { to: numericTo, from: numericFrom, status: 'ringing', callId: callKey, timestamp: Date.now() });
            const callTimeout = setTimeout(() => {
                const activeCall = activeCalls.get(callKey);
                if (activeCall && activeCall.status === 'ringing') {
                    const callerSocket = io.sockets.sockets.get(activeCall.callerSocket);
                    const receiverSocket = io.sockets.sockets.get(activeCall.receiverSocket);
                    if (callerSocket) callerSocket.emit('call-rejected', { from: numericTo, reason: 'No answer', callId: callKey, timestamp: Date.now() });
                    if (receiverSocket) receiverSocket.emit('call-missed', { from: numericFrom, callId: callKey, timestamp: Date.now() });
                    activeCalls.delete(callKey);
                }
            }, 30000);
            callData.timeout = callTimeout;
            activeCalls.set(callKey, callData);
        } else { socket.emit('call-error', { message: 'User is offline', code: 'USER_OFFLINE' }); }
    });

    socket.on('accept-call', ({ to, from }) => {
        const numericTo = Number(to);
        const numericFrom = Number(from);
        const callKey = `${numericTo}-${numericFrom}`;
        const reverseCallKey = `${numericFrom}-${numericTo}`;
        let callData = activeCalls.get(callKey) || activeCalls.get(reverseCallKey);
        if (callData) {
            if (callData.timeout) clearTimeout(callData.timeout);
            callData.accepted = true;
            callData.status = 'connected';
            const activeKey = activeCalls.has(callKey) ? callKey : reverseCallKey;
            activeCalls.set(activeKey, callData);
            const callerSocketId = connectedUsers.get(numericTo);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call-accepted', { from: numericFrom, callId: activeKey, timestamp: Date.now() });
                socket.emit('call-connected', { to: numericTo, from: numericFrom, callId: activeKey, timestamp: Date.now() });
            } else { activeCalls.delete(activeKey); socket.emit('call-error', { message: 'Caller disconnected', code: 'CALLER_OFFLINE' }); }
        } else { socket.emit('call-error', { message: 'No active call', code: 'NO_CALL' }); }
    });

    socket.on('reject-call', ({ to, from, reason }) => {
        const callKey1 = `${Number(to)}-${Number(from)}`;
        const callKey2 = `${Number(from)}-${Number(to)}`;
        let callData = activeCalls.get(callKey1) || activeCalls.get(callKey2);
        if (callData?.timeout) clearTimeout(callData.timeout);
        activeCalls.delete(callKey1);
        activeCalls.delete(callKey2);
        const callerSocketId = connectedUsers.get(Number(to));
        if (callerSocketId) io.to(callerSocketId).emit('call-rejected', { from: Number(from), reason: reason || 'Call declined', timestamp: Date.now() });
        socket.emit('call-rejected-confirmed', { to: Number(to), reason: reason || 'Call declined', timestamp: Date.now() });
    });

    socket.on('end-call', ({ to, from }) => {
        const keysToDelete = [];
        for (let [callKey, callData] of activeCalls.entries()) {
            if ((callData.caller === Number(from) && callData.receiver === Number(to)) || (callData.caller === Number(to) && callData.receiver === Number(from))) {
                if (callData.timeout) clearTimeout(callData.timeout);
                const otherParty = callData.caller === Number(from) ? callData.receiver : callData.caller;
                const otherSocketId = connectedUsers.get(otherParty);
                if (otherSocketId) io.to(otherSocketId).emit('call-ended', { from: Number(from), reason: 'Call ended', callId: callKey, timestamp: Date.now() });
                keysToDelete.push(callKey);
            }
        }
        keysToDelete.forEach(key => activeCalls.delete(key));
        socket.emit('call-ended-confirmed', { to: Number(to), from: Number(from), timestamp: Date.now() });
    });

    socket.on('save-call-log', async (data) => {
        try {
            const result = await db.query(
                'INSERT INTO call_logs (caller_id, receiver_id, call_type, duration, status, started_at, ended_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
                [data.callerId, data.receiverId, data.callType, data.duration, data.status, data.startedAt]
            );
            const callerSocketId = connectedUsers.get(data.callerId);
            const receiverSocketId = connectedUsers.get(data.receiverId);
            if (callerSocketId) io.to(callerSocketId).emit('call-log-updated', result.rows[0]);
            if (receiverSocketId) io.to(receiverSocketId).emit('call-log-updated', result.rows[0]);
        } catch (error) { console.error('Error saving call log:', error); }
    });

    socket.on('cancel-call', ({ to, from }) => {
        const callKey = `${Number(from)}-${Number(to)}`;
        const reverseCallKey = `${Number(to)}-${Number(from)}`;
        let callData = activeCalls.get(callKey) || activeCalls.get(reverseCallKey);
        if (callData?.timeout) clearTimeout(callData.timeout);
        activeCalls.delete(callKey);
        activeCalls.delete(reverseCallKey);
        const recipientSocketId = connectedUsers.get(Number(to));
        if (recipientSocketId) io.to(recipientSocketId).emit('call-cancelled', { from: Number(from), timestamp: Date.now() });
        socket.emit('call-cancelled-confirmed', { to: Number(to), timestamp: Date.now() });
    });

    socket.on('disconnect', async (reason) => {
        let disconnectedUserId = socket.userId;
        if (!disconnectedUserId) {
            for (let [userId, socketId] of connectedUsers.entries()) { if (socketId === socket.id) { disconnectedUserId = userId; break; } }
        }
        if (disconnectedUserId) {
            cleanupUserCalls(disconnectedUserId, 'User disconnected');
            connectedUsers.delete(disconnectedUserId);
            userSockets.delete(socket.id);
            try {
                await db.query('UPDATE users SET online_status = false, last_active = NOW() WHERE id = $1', [disconnectedUserId]);
                io.emit('user-status-changed', { userId: disconnectedUserId, status: 'offline', timestamp: Date.now() });
            } catch (error) { console.error('Error updating offline status:', error); }
        }
        userSockets.delete(socket.id);
    });

    socket.on('error', (error) => { console.error(`❌ Socket error for ${socket.id}:`, error); });
});

setInterval(() => {
    const now = Date.now();
    for (let [callKey, callData] of activeCalls.entries()) {
        if (now - callData.startTime.getTime() > 5 * 60 * 1000) {
            [callData.caller, callData.receiver].forEach(userId => {
                const socketId = connectedUsers.get(userId);
                if (socketId) io.to(socketId).emit('call-ended', { reason: 'Call timed out', callId: callKey, timestamp: Date.now() });
            });
            if (callData.timeout) clearTimeout(callData.timeout);
            activeCalls.delete(callKey);
        }
    }
}, 5 * 60 * 1000);

process.on('SIGTERM', () => {
    for (let [userId, socketId] of connectedUsers.entries()) {
        io.to(socketId).emit('server-shutdown', { message: 'Server is shutting down', timestamp: Date.now() });
    }
    io.close(() => { process.exit(0); });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📝 Community posts API ready`);
});

module.exports = { app, server, io };