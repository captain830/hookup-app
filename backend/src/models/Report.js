const db = require('../config/database');

class Report {
    static async create(reporter, reportedUser, reason) {
        const result = await db.query(
            'INSERT INTO reports (reporter, reported_user, reason) VALUES ($1, $2, $3) RETURNING *',
            [reporter, reportedUser, reason]
        );
        return result.rows[0];
    }

    static async getAllPending() {
        const result = await db.query(
            `SELECT r.*, u1.name as reporter_name, u2.name as reported_name 
             FROM reports r
             JOIN users u1 ON r.reporter = u1.id
             JOIN users u2 ON r.reported_user = u2.id
             WHERE r.status = 'pending'
             ORDER BY r.created_at DESC`
        );
        return result.rows;
    }

    static async resolve(reportId, action) {
        const result = await db.query(
            'UPDATE reports SET status = $2 WHERE id = $1 RETURNING *',
            [reportId, action === 'ban' ? 'resolved' : 'dismissed']
        );
        return result.rows[0];
    }
}

module.exports = Report;