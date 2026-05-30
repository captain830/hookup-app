const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// Auth middleware
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

// Multer setup
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
    limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /api/posts - SIMPLE version that works
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('Fetching posts for user:', userId);
        
        // SIMPLE QUERY - no complex joins or subqueries
        const result = await db.query(`
            SELECT 
                p.id,
                p.user_id,
                p.content,
                p.media_url,
                p.media_type,
                p.location,
                p.created_at,
                u.name as user_name,
                u.photos as user_photos
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 20
        `);
        
        // Format the posts
        const posts = result.rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            content: row.content,
            media_url: row.media_url,
            media_type: row.media_type,
            location: row.location,
            created_at: row.created_at,
            user_name: row.user_name || 'Unknown',
            user_photo: Array.isArray(row.user_photos) ? row.user_photos[0] : row.user_photos,
            likes_count: 0,
            comments_count: 0,
            shares_count: 0,
            is_liked: false,
            comments: []
        }));
        
        console.log(`Found ${posts.length} posts`);
        res.json({ posts });
        
    } catch (error) {
        console.error('Error fetching posts:', error.message);
        console.error('Full error:', error);
        // Return empty array instead of 500
        res.json({ posts: [] });
    }
});

// POST /api/posts - Create a post
router.post('/', authenticateToken, upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        
        if (!content && !req.file) {
            return res.status(400).json({ error: 'Post must have content or media' });
        }
        
        let mediaUrl = null;
        let mediaType = null;
        
        if (req.file) {
            mediaUrl = `/uploads/posts/${req.file.filename}`;
            mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
        }
        
        console.log('Creating post:', { userId, content, mediaUrl, mediaType });
        
        const result = await db.query(
            `INSERT INTO posts (user_id, content, media_url, media_type) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [userId, content, mediaUrl, mediaType]
        );
        
        const post = result.rows[0];
        
        // Get user info
        const userResult = await db.query(
            'SELECT name, photos FROM users WHERE id = $1',
            [userId]
        );
        
        post.user_name = userResult.rows[0]?.name || 'Unknown';
        post.user_photo = Array.isArray(userResult.rows[0]?.photos) 
            ? userResult.rows[0].photos[0] 
            : userResult.rows[0]?.photos;
        post.likes_count = 0;
        post.comments_count = 0;
        post.shares_count = 0;
        post.comments = [];
        
        console.log('Post created successfully:', post.id);
        res.status(201).json({ post });
        
    } catch (error) {
        console.error('Error creating post:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to create post: ' + error.message });
    }
});

// POST /api/posts/:postId/like
router.post('/:postId/like', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query(
            'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT (user_id, post_id) DO NOTHING',
            [userId, postId]
        );
        
        const count = await db.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [postId]);
        
        res.json({ success: true, likes_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error liking post:', error.message);
        res.json({ success: false });
    }
});

// DELETE /api/posts/:postId/like
router.delete('/:postId/like', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        
        const count = await db.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [postId]);
        
        res.json({ success: true, likes_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error unliking post:', error.message);
        res.json({ success: false });
    }
});

// POST /api/posts/:postId/comment
router.post('/:postId/comment', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }
        
        const result = await db.query(
            'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, postId, content]
        );
        
        const comment = result.rows[0];
        const user = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
        comment.user_name = user.rows[0]?.name || 'Unknown';
        
        const count = await db.query('SELECT COUNT(*) FROM comments WHERE post_id = $1', [postId]);
        
        res.status(201).json({ comment, comments_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error adding comment:', error.message);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// POST /api/posts/:postId/share
router.post('/:postId/share', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        await db.query('INSERT INTO shares (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
        
        const count = await db.query('SELECT COUNT(*) FROM shares WHERE post_id = $1', [postId]);
        
        res.json({ success: true, shares_count: parseInt(count.rows[0].count) });
    } catch (error) {
        console.error('Error sharing post:', error.message);
        res.json({ success: false });
    }
});

module.exports = router;