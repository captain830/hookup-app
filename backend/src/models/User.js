const db = require('../config/database');

class User {
    static async create(userData) {
        const { name, email, password, age, gender, interested_in, latitude, longitude, city, bio } = userData;
        const result = await db.query(
            `INSERT INTO users (name, email, password, age, gender, interested_in, latitude, longitude, city, bio) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id, name, email, age, gender, interested_in, city, bio, is_verified, is_premium, coins, role`,
            [name, email, password, age, gender, interested_in, latitude, longitude, city, bio]
        );
        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await db.query(
            'SELECT id, name, email, age, gender, interested_in, city, bio, photos, is_verified, is_premium, coins, online_status, role, is_banned FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    static async update(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
        const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
        const result = await db.query(query, [id, ...values]);
        return result.rows[0];
    }

    static async findNearby(userId, lat, lng, maxDistance = 50) {
        // Simple query to get other users (without distance calculation for now)
        const result = await db.query(
            `SELECT id, name, age, gender, bio, photos, online_status, is_premium
             FROM users 
             WHERE id != $1 AND is_banned = false 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );
        return result.rows;
    }

    static async getAllForAdmin() {
        const result = await db.query('SELECT id, name, email, age, is_verified, is_premium, is_banned, role, created_at FROM users ORDER BY created_at DESC');
        return result.rows;
    }

    static async banUser(userId) {
        const result = await db.query('UPDATE users SET is_banned = true WHERE id = $1 RETURNING id', [userId]);
        return result.rows[0];
    }

    static async updatePremium(userId, isPremium) {
        const result = await db.query('UPDATE users SET is_premium = $2 WHERE id = $1 RETURNING id, is_premium', [userId, isPremium]);
        return result.rows[0];
    }

    static async addCoins(userId, coins) {
        const result = await db.query('UPDATE users SET coins = coins + $2 WHERE id = $1 RETURNING coins', [userId, coins]);
        return result.rows[0];
    }
}

module.exports = User;