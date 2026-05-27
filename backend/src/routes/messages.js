const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get conversation with a user - with NaN validation
router.get('/conversation/:userId', auth, async (req, res) => {
    try {
        const currentUserId = req.userId;
        const otherUserId = parseInt(req.params.userId);
        
        // Validate IDs
        if (isNaN(currentUserId) || isNaN(otherUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await db.query(
            `SELECT m.id, m.from_user, m.to_user, m.message, m.is_read, m.created_at,
                    u1.name as from_name, u2.name as to_name 
             FROM messages m
             JOIN users u1 ON m.from_user = u1.id
             JOIN users u2 ON m.to_user = u2.id
             WHERE (m.from_user = $1 AND m.to_user = $2) OR (m.from_user = $2 AND m.to_user = $1)
             ORDER BY m.created_at ASC
             LIMIT 100`,
            [currentUserId, otherUserId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send a message - with NaN validation
router.post('/send', auth, async (req, res) => {
    const { to, message } = req.body;
    const from = req.userId;
    
    // Validate IDs
    if (isNaN(from) || isNaN(to)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    
    if (message.length > 1000) {
        return res.status(400).json({ error: 'Message too long (max 1000 characters).' });
    }
    
    try {
        const result = await db.query(
            `INSERT INTO messages (from_user, to_user, message) 
             VALUES ($1, $2, $3) 
             RETURNING id, from_user, to_user, message, created_at`,
            [from, to, message]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all conversations (inbox)
router.get('/conversations', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const chatUsers = await db.query(
            `SELECT DISTINCT 
                CASE 
                    WHEN from_user = $1 THEN to_user
                    ELSE from_user
                END as other_user_id
             FROM messages
             WHERE from_user = $1 OR to_user = $1`,
            [userId]
        );
        
        if (chatUsers.rows.length === 0) {
            return res.json([]);
        }
        
        const conversations = [];
        
        for (const chatUser of chatUsers.rows) {
            const otherUserId = chatUser.other_user_id;
            
            const userResult = await db.query(
                'SELECT id, name, age, photos, online_status FROM users WHERE id = $1',
                [otherUserId]
            );
            
            if (userResult.rows.length === 0) continue;
            
            const lastMessageResult = await db.query(
                `SELECT message, from_user, created_at 
                 FROM messages 
                 WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId, otherUserId]
            );
            
            const unreadResult = await db.query(
                'SELECT COUNT(*) FROM messages WHERE to_user = $1 AND from_user = $2 AND is_read = false',
                [userId, otherUserId]
            );
            
            const user = userResult.rows[0];
            const lastMessage = lastMessageResult.rows[0];
            const unreadCount = parseInt(unreadResult.rows[0].count);
            
            let photos = [];
            if (user.photos) {
                if (Array.isArray(user.photos)) {
                    photos = user.photos;
                } else if (typeof user.photos === 'string') {
                    let clean = user.photos.replace(/[{}"]/g, '');
                    if (clean) {
                        photos = clean.split(',').map(p => p.trim());
                    }
                }
            }
            
            conversations.push({
                id: user.id,
                name: user.name,
                age: user.age,
                photos: photos,
                online_status: user.online_status || false,
                last_message: {
                    text: lastMessage?.message || '',
                    from_me: lastMessage?.from_user === userId,
                    time: lastMessage?.created_at || null
                },
                unread_count: unreadCount
            });
        }
        
        conversations.sort((a, b) => {
            const timeA = a.last_message.time ? new Date(a.last_message.time) : new Date(0);
            const timeB = b.last_message.time ? new Date(b.last_message.time) : new Date(0);
            return timeB - timeA;
        });
        
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await db.query(
            'SELECT COUNT(*) FROM messages WHERE to_user = $1 AND is_read = false',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark messages as read - with NaN validation
router.put('/read/:userId', auth, async (req, res) => {
    try {
        const currentUserId = req.userId;
        const otherUserId = parseInt(req.params.userId);
        
        if (isNaN(currentUserId) || isNaN(otherUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        await db.query(
            `UPDATE messages 
             SET is_read = true 
             WHERE from_user = $1 AND to_user = $2 AND is_read = false`,
            [otherUserId, currentUserId]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a single message - with NaN validation
router.delete('/message/:messageId', auth, async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    const userId = req.userId;
    
    if (isNaN(messageId) || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }
    
    try {
        const check = await db.query(
            'SELECT from_user FROM messages WHERE id = $1',
            [messageId]
        );
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        if (check.rows[0].from_user !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }
        
        await db.query('DELETE FROM messages WHERE id = $1', [messageId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete entire conversation - with NaN validation
router.delete('/conversation/:userId', auth, async (req, res) => {
    const currentUserId = req.userId;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(currentUserId) || isNaN(otherUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    try {
        await db.query(
            'DELETE FROM messages WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)',
            [currentUserId, otherUserId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Block a user - with NaN validation
router.post('/block/:userId', auth, async (req, res) => {
    const blockerId = req.userId;
    const blockedId = parseInt(req.params.userId);
    
    if (isNaN(blockerId) || isNaN(blockedId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (blockerId === blockedId) {
        return res.status(400).json({ error: 'Cannot block yourself.' });
    }
    
    try {
        await db.query(
            'INSERT INTO blocks (blocker, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [blockerId, blockedId]
        );
        res.json({ success: true, message: 'User blocked successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Report a user - with NaN validation
router.post('/report/:userId', auth, async (req, res) => {
    const { reason } = req.body;
    const reporterId = req.userId;
    const reportedId = parseInt(req.params.userId);
    
    if (isNaN(reporterId) || isNaN(reportedId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    try {
        await db.query(
            'INSERT INTO reports (reporter, reported_user, reason) VALUES ($1, $2, $3)',
            [reporterId, reportedId, reason || 'No reason provided']
        );
        res.json({ success: true, message: 'User reported successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;