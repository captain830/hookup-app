const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Swipe on a user (like or pass)
router.post('/swipe', auth, async (req, res) => {
    const { targetUserId, action } = req.body;
    const swiperId = req.userId;
    
    if (!['like', 'pass'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action.' });
    }
    
    if (targetUserId === swiperId) {
        return res.status(400).json({ error: 'Cannot swipe on yourself.' });
    }
    
    try {
        // Check if already swiped
        const existingSwipe = await db.query(
            'SELECT * FROM swipes WHERE swiper = $1 AND swiped = $2',
            [swiperId, targetUserId]
        );
        
        if (existingSwipe.rows.length > 0) {
            // Update existing swipe
            await db.query(
                'UPDATE swipes SET action = $1 WHERE swiper = $2 AND swiped = $3',
                [action, swiperId, targetUserId]
            );
        } else {
            // Insert new swipe
            await db.query(
                'INSERT INTO swipes (swiper, swiped, action) VALUES ($1, $2, $3)',
                [swiperId, targetUserId, action]
            );
        }
        
        let isMatch = false;
        let matchCreated = false;
        
        // If it's a like, check for mutual like
        if (action === 'like') {
            const mutualLike = await db.query(
                'SELECT * FROM swipes WHERE swiper = $1 AND swiped = $2 AND action = $3',
                [targetUserId, swiperId, 'like']
            );
            
            if (mutualLike.rows.length > 0) {
                isMatch = true;
                
                // Check if match already exists
                const existingMatch = await db.query(
                    'SELECT * FROM matches WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)',
                    [swiperId, targetUserId]
                );
                
                if (existingMatch.rows.length === 0) {
                    // Create a match record
                    await db.query(
                        `INSERT INTO matches (user1, user2, status, action_by) 
                         VALUES ($1, $2, 'matched', $3)`,
                        [Math.min(swiperId, targetUserId), Math.max(swiperId, targetUserId), swiperId]
                    );
                    matchCreated = true;
                }
            }
        }
        
        res.json({ 
            success: true, 
            matched: isMatch,
            matchCreated: matchCreated,
            message: isMatch ? "It's a match! 🎉 You can now chat!" : "Swipe recorded"
        });
        
    } catch (error) {
        console.error('Swipe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's matches
router.get('/my-matches', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        const query = `
            SELECT 
                m.id,
                m.created_at,
                CASE 
                    WHEN m.user1 = $1 THEN u2.id
                    ELSE u1.id
                END as match_id,
                CASE 
                    WHEN m.user1 = $1 THEN u2.name
                    ELSE u1.name
                END as match_name,
                CASE 
                    WHEN m.user1 = $1 THEN u2.age
                    ELSE u1.age
                END as match_age,
                CASE 
                    WHEN m.user1 = $1 THEN u2.bio
                    ELSE u1.bio
                END as match_bio,
                CASE 
                    WHEN m.user1 = $1 THEN u2.photos
                    ELSE u1.photos
                END as match_photos,
                CASE 
                    WHEN m.user1 = $1 THEN u2.online_status
                    ELSE u1.online_status
                END as match_online_status
            FROM matches m
            JOIN users u1 ON m.user1 = u1.id
            JOIN users u2 ON m.user2 = u2.id
            WHERE (m.user1 = $1 OR m.user2 = $1) AND m.status = 'matched'
            ORDER BY m.created_at DESC
        `;
        
        const result = await db.query(query, [userId]);
        
        const matches = result.rows.map(row => ({
            id: row.id,
            created_at: row.created_at,
            otherUser: {
                id: row.match_id,
                name: row.match_name,
                age: row.match_age,
                bio: row.match_bio,
                photos: row.match_photos || [],
                online_status: row.match_online_status
            }
        }));
        
        res.json(matches);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;