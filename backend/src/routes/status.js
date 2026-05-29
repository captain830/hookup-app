const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Ensure directories exist
const statusDir = path.join(__dirname, '../../uploads/status');
const musicDir = path.join(__dirname, '../../uploads/music');
if (!fs.existsSync(statusDir)) fs.mkdirSync(statusDir, { recursive: true });
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

// Configure multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'music') {
            cb(null, musicDir);
        } else {
            cb(null, statusDir);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'status-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'music') {
            if (file.mimetype.startsWith('audio/')) {
                cb(null, true);
            } else {
                cb(new Error('Only audio files are allowed'));
            }
        } else {
            if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else {
                cb(new Error('Only images and videos are allowed'));
            }
        }
    }
});

// Get base URL dynamically
const getBaseUrl = (req) => {
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};

// Create a status
router.post('/create', auth, upload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'music', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files['media']) {
            return res.status(400).json({ error: 'No media uploaded' });
        }

        const mediaFile = req.files['media'][0];
        const baseUrl = getBaseUrl(req);
        const mediaUrl = `${baseUrl}/uploads/status/${mediaFile.filename}`;
        const mediaType = mediaFile.mimetype.startsWith('video') ? 'video' : 'image';
        
        let musicUrl = null;
        let musicTitle = req.body.musicTitle || null;
        let musicStartTime = parseInt(req.body.musicStartTime) || 0;
        
        if (req.files['music'] && req.files['music'][0]) {
            const musicFile = req.files['music'][0];
            musicUrl = `${baseUrl}/uploads/music/${musicFile.filename}`;
            if (!musicTitle) {
                musicTitle = path.parse(musicFile.originalname).name;
            }
        }

        const { caption, duration } = req.body;

        const result = await db.query(
            `INSERT INTO status (user_id, media_url, media_type, caption, music_title, music_url, music_start_time, duration, expires_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '24 hours') 
             RETURNING *`,
            [req.userId, mediaUrl, mediaType, caption || '', musicTitle, musicUrl, musicStartTime, duration || 10]
        );

        res.json({ success: true, status: result.rows[0] });
    } catch (error) {
        console.error('Error creating status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all active statuses
router.get('/active', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        const result = await db.query(`
            SELECT s.*, u.name, u.photos as user_photo, u.id as user_id,
                   EXISTS(SELECT 1 FROM status_views WHERE status_id = s.id AND viewer_id = $1) as viewed_by_me
            FROM status s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > NOW()
            ORDER BY s.created_at DESC
        `, [userId]);
        
        const userStatuses = {};
        result.rows.forEach(status => {
            if (!userStatuses[status.user_id]) {
                userStatuses[status.user_id] = {
                    user_id: status.user_id,
                    name: status.name,
                    user_photo: status.user_photo,
                    statuses: []
                };
            }
            userStatuses[status.user_id].statuses.push(status);
        });
        
        const myStatuses = await db.query(`
            SELECT * FROM status 
            WHERE user_id = $1 AND expires_at > NOW()
            ORDER BY created_at DESC
        `, [userId]);
        
        res.json({ 
            stories: Object.values(userStatuses),
            myStatuses: myStatuses.rows
        });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single status with details (SIMPLIFIED - less likely to error)
router.get('/:statusId', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const userId = req.userId;
        
        // Record view
        await db.query(
            `INSERT INTO status_views (status_id, viewer_id) 
             VALUES ($1, $2) ON CONFLICT (status_id, viewer_id) DO NOTHING`,
            [statusId, userId]
        );
        
        // Get status with user info
        const result = await db.query(`
            SELECT s.*, u.name, u.photos as user_photo
            FROM status s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1 AND s.expires_at > NOW()
        `, [statusId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Status not found or expired' });
        }
        
        // Get viewers separately (simpler query)
        const viewers = await db.query(`
            SELECT sv.viewer_id as user_id, u2.name as user_name
            FROM status_views sv
            JOIN users u2 ON sv.viewer_id = u2.id
            WHERE sv.status_id = $1
        `, [statusId]);
        
        // Get reactions separately
        const reactions = await db.query(`
            SELECT sr.user_id, sr.reaction_type, u3.name as user_name
            FROM status_reactions sr
            JOIN users u3 ON sr.user_id = u3.id
            WHERE sr.status_id = $1
        `, [statusId]);
        
        // Get comments separately
        const comments = await db.query(`
            SELECT sc.id, sc.user_id, sc.comment, sc.created_at, u4.name as user_name
            FROM status_comments sc
            JOIN users u4 ON sc.user_id = u4.id
            WHERE sc.status_id = $1
            ORDER BY sc.created_at DESC
        `, [statusId]);
        
        // Get replies for each comment
        const commentsWithReplies = [];
        for (const comment of comments.rows) {
            const replies = await db.query(`
                SELECT sr.id, sr.user_id, sr.reply, sr.created_at, u5.name as user_name
                FROM status_replies sr
                JOIN users u5 ON sr.user_id = u5.id
                WHERE sr.comment_id = $1
                ORDER BY sr.created_at ASC
            `, [comment.id]);
            
            commentsWithReplies.push({
                ...comment,
                replies: replies.rows
            });
        }
        
        const statusData = {
            ...result.rows[0],
            viewers: viewers.rows,
            reactions: reactions.rows,
            comments: commentsWithReplies,
            likes_count: reactions.rows.filter(r => r.reaction_type === '❤️').length
        };
        
        res.json(statusData);
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add comment to status
router.post('/:statusId/comment', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const { comment } = req.body;
        const userId = req.userId;
        
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }
        
        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
        const userName = userResult.rows[0]?.name;
        
        const result = await db.query(
            `INSERT INTO status_comments (status_id, user_id, comment) 
             VALUES ($1, $2, $3) 
             RETURNING id, user_id, comment, created_at`,
            [statusId, userId, comment]
        );
        
        res.json({ 
            success: true, 
            comment: {
                id: result.rows[0].id,
                user_id: userId,
                user_name: userName,
                comment: result.rows[0].comment,
                created_at: result.rows[0].created_at,
                replies: []
            }
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reply to a comment
router.post('/:statusId/reply', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const { commentId, reply } = req.body;
        const userId = req.userId;
        
        if (!reply || reply.trim().length === 0) {
            return res.status(400).json({ error: 'Reply cannot be empty' });
        }
        
        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
        const userName = userResult.rows[0]?.name;
        
        const result = await db.query(
            `INSERT INTO status_replies (status_id, comment_id, user_id, reply) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, user_id, reply, created_at`,
            [statusId, commentId, userId, reply]
        );
        
        res.json({ 
            success: true, 
            reply: {
                id: result.rows[0].id,
                user_id: userId,
                user_name: userName,
                reply: result.rows[0].reply,
                created_at: result.rows[0].created_at
            }
        });
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete a comment
router.delete('/:statusId/comment/:commentId', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const commentId = parseInt(req.params.commentId);
        const userId = req.userId;
        
        const statusCheck = await db.query('SELECT user_id FROM status WHERE id = $1', [statusId]);
        if (statusCheck.rows[0]?.user_id !== userId) {
            return res.status(403).json({ error: 'Only status creator can delete comments' });
        }
        
        await db.query('DELETE FROM status_comments WHERE id = $1 AND status_id = $2', [commentId, statusId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add reaction
router.post('/:statusId/react', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const { reaction } = req.body;
        const userId = req.userId;
        
        await db.query(
            `INSERT INTO status_reactions (status_id, user_id, reaction_type) 
             VALUES ($1, $2, $3)
             ON CONFLICT (status_id, user_id) 
             DO UPDATE SET reaction_type = $3`,
            [statusId, userId, reaction]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Like a status
router.post('/:statusId/like', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const userId = req.userId;
        
        await db.query(
            `INSERT INTO status_reactions (status_id, user_id, reaction_type) 
             VALUES ($1, $2, '❤️')
             ON CONFLICT (status_id, user_id) 
             DO UPDATE SET reaction_type = '❤️'`,
            [statusId, userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error liking status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unlike
router.delete('/:statusId/like', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const userId = req.userId;
        
        await db.query(
            `DELETE FROM status_reactions WHERE status_id = $1 AND user_id = $2 AND reaction_type = '❤️'`,
            [statusId, userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error unliking status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Edit caption
router.put('/:statusId/caption', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        const { caption } = req.body;
        const userId = req.userId;
        
        const result = await db.query(
            'UPDATE status SET caption = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [caption, statusId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Status not found' });
        }
        
        res.json({ success: true, status: result.rows[0] });
    } catch (error) {
        console.error('Error updating caption:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete status
router.delete('/:statusId', auth, async (req, res) => {
    try {
        const statusId = parseInt(req.params.statusId);
        
        const result = await db.query(
            'DELETE FROM status WHERE id = $1 AND user_id = $2 RETURNING media_url, music_url',
            [statusId, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Status not found' });
        }
        
        // Delete files
        const mediaFile = result.rows[0].media_url.split('/').pop();
        const mediaPath = path.join(statusDir, mediaFile);
        if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
        
        if (result.rows[0].music_url) {
            const musicFile = result.rows[0].music_url.split('/').pop();
            const musicPath = path.join(musicDir, musicFile);
            if (fs.existsSync(musicPath)) fs.unlinkSync(musicPath);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;