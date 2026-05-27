const db = require('../config/database');

class Message {
    static async create(fromUser, toUser, message) {
        const result = await db.query(
            'INSERT INTO messages (from_user, to_user, message) VALUES ($1, $2, $3) RETURNING *',
            [fromUser, toUser, message]
        );
        return result.rows[0];
    }

    static async getConversation(user1, user2) {
        const result = await db.query(
            `SELECT m.*, u1.name as from_name, u2.name as to_name 
             FROM messages m
             JOIN users u1 ON m.from_user = u1.id
             JOIN users u2 ON m.to_user = u2.id
             WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
             ORDER BY created_at ASC`,
            [user1, user2]
        );
        return result.rows;
    }

    static async markAsRead(messageId) {
        const result = await db.query('UPDATE messages SET is_read = true WHERE id = $1 RETURNING *', [messageId]);
        return result.rows[0];
    }

    static async getUnreadCount(userId) {
        const result = await db.query(
            'SELECT COUNT(*) FROM messages WHERE to_user = $1 AND is_read = false',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }
}

module.exports = Message;