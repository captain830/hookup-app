const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Report = require('../models/Report');
const db = require('../config/database');

const router = express.Router();

// Get all users (admin only)
router.get('/users', auth, admin, async (req, res) => {
    try {
        const users = await User.getAllForAdmin();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ban a user
router.post('/ban-user', auth, admin, async (req, res) => {
    const { userId } = req.body;
    
    try {
        await User.banUser(userId);
        res.json({ success: true, message: 'User banned successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unban a user
router.post('/unban-user', auth, admin, async (req, res) => {
    const { userId } = req.body;
    
    try {
        await db.query('UPDATE users SET is_banned = false WHERE id = $1', [userId]);
        res.json({ success: true, message: 'User unbanned successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all reports
router.get('/reports', auth, admin, async (req, res) => {
    try {
        const reports = await Report.getAllPending();
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resolve a report
router.post('/resolve-report', auth, admin, async (req, res) => {
    const { reportId, action } = req.body; // action: 'ban' or 'dismiss'
    
    try {
        if (action === 'ban') {
            // Get the reported user from the report
            const report = await db.query('SELECT reported_user FROM reports WHERE id = $1', [reportId]);
            if (report.rows[0]) {
                await User.banUser(report.rows[0].reported_user);
            }
        }
        
        await Report.resolve(reportId, action);
        res.json({ success: true, message: 'Report resolved successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get dashboard stats
router.get('/stats', auth, admin, async (req, res) => {
    try {
        const totalUsers = await db.query('SELECT COUNT(*) FROM users');
        const premiumUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_premium = true');
        const bannedUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_banned = true');
        const pendingReports = await db.query('SELECT COUNT(*) FROM reports WHERE status = $1', ['pending']);
        const totalMatches = await db.query('SELECT COUNT(*) FROM matches WHERE status = $1', ['matched']);
        const totalRevenue = await db.query('SELECT SUM(amount) FROM payments WHERE status = $1', ['paid']);
        
        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count),
            premiumUsers: parseInt(premiumUsers.rows[0].count),
            bannedUsers: parseInt(bannedUsers.rows[0].count),
            pendingReports: parseInt(pendingReports.rows[0].count),
            totalMatches: parseInt(totalMatches.rows[0].count),
            totalRevenue: totalRevenue.rows[0].sum || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;