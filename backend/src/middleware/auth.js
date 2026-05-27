const jwt = require('jsonwebtoken');
const db = require('../config/database');

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_secret_key');
        const userId = decoded.userId;
        
        // Verify user exists in database
        const result = await db.query('SELECT id, name, email, role, is_banned FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        if (result.rows[0].is_banned) {
            return res.status(401).json({ error: 'Account banned' });
        }
        
        req.userId = userId;
        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};