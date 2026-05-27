const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

router.post('/register', [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('age').isInt({ min: 18, max: 120 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, age, gender, interestedIn } = req.body;

    try {
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(
            `INSERT INTO users (name, email, password, age, gender, interested_in, profile_completed, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW()) 
             RETURNING id, name, email, age`,
            [name, email, hashedPassword, age, gender || null, interestedIn || null]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'my_secret_key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                age: user.age,
                profile_completed: true
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const result = await db.query(
            'SELECT id, name, email, age, password, profile_completed, is_premium, role FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last active
        await db.query('UPDATE users SET last_active = NOW(), online_status = true WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'my_secret_key',
            { expiresIn: '7d' }
        );

        delete user.password;

        res.json({
            token,
            user: {
                ...user,
                profile_completed: user.profile_completed || true
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;