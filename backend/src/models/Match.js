const db = require('../config/database');

class Match {
    static async createSwipe(swiper, swiped, action) {
        // Check if already swiped
        const existing = await db.query(
            'SELECT * FROM swipes WHERE swiper = $1 AND swiped = $2',
            [swiper, swiped]
        );
        
        if (existing.rows.length > 0) {
            return { error: 'Already swiped on this user' };
        }

        // Insert swipe
        await db.query(
            'INSERT INTO swipes (swiper, swiped, action) VALUES ($1, $2, $3)',
            [swiper, swiped, action]
        );

        if (action === 'like') {
            // Check for mutual like
            const mutual = await db.query(
                'SELECT * FROM swipes WHERE swiper = $1 AND swiped = $2 AND action = $3',
                [swiped, swiper, 'like']
            );

            if (mutual.rows.length > 0) {
                // Create match
                const match = await db.query(
                    `INSERT INTO matches (user1, user2, status, action_by) 
                     VALUES ($1, $2, 'matched', $3) 
                     ON CONFLICT (user1, user2) DO UPDATE SET status = 'matched'
                     RETURNING *`,
                    [Math.min(swiper, swiped), Math.max(swiper, swiped), swiper]
                );
                return { matched: true, match: match.rows[0] };
            }
        }
        
        return { matched: false };
    }

    static async getUserMatches(userId) {
        const result = await db.query(
            `SELECT m.*, 
                    u1.id as user1_id, u1.name as user1_name, u1.photos as user1_photos, u1.online_status as user1_online,
                    u2.id as user2_id, u2.name as user2_name, u2.photos as user2_photos, u2.online_status as user2_online
             FROM matches m
             JOIN users u1 ON m.user1 = u1.id
             JOIN users u2 ON m.user2 = u2.id
             WHERE (m.user1 = $1 OR m.user2 = $1) AND m.status = 'matched'
             ORDER BY m.created_at DESC`,
            [userId]
        );
        
        return result.rows.map(match => ({
            ...match,
            otherUser: match.user1_id == userId ? 
                { id: match.user2_id, name: match.user2_name, photos: match.user2_photos, online_status: match.user2_online } :
                { id: match.user1_id, name: match.user1_name, photos: match.user1_photos, online_status: match.user1_online }
        }));
    }
}

module.exports = Match;