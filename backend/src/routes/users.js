const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, email, age, bio, photos, interested_in, profile_completed, is_premium FROM users WHERE id = $1',
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        
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
        
        user.photos = photos;
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET ALL USERS FOR DISCOVERY - SIMPLIFIED WORKING VERSION
router.get('/discover', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        console.log('=== DISCOVER ENDPOINT ===');
        console.log('Current User ID:', userId);
        
        // Simple query to get all other users
        const result = await db.query(`
            SELECT id, name, age, bio, photos, is_premium, online_status
            FROM users
            WHERE id != $1
            ORDER BY id
        `, [userId]);
        
        console.log(`Found ${result.rows.length} other users`);
        
        // Format the response
        const users = result.rows.map(user => ({
            id: user.id,
            name: user.name,
            age: user.age,
            bio: user.bio || "Hello! I'm new here.",
            photos: user.photos || [],
            is_premium: user.is_premium || false,
            online_status: user.online_status || false,
            my_swipe_action: 'none',
            is_matched: false
        }));
        
        res.json(users);
    } catch (error) {
        console.error('Discover error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await db.query(
            'SELECT id, name, email, age, bio, photos, online_status FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        const user = result.rows[0];
        
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
        user.photos = photos;
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
    const { bio, interestedIn, gender, city } = req.body;
    
    try {
        let query = 'UPDATE users SET updated_at = NOW()';
        const values = [];
        let paramCount = 1;
        
        if (bio !== undefined) {
            query += `, bio = $${paramCount}`;
            values.push(bio);
            paramCount++;
        }
        if (interestedIn !== undefined) {
            query += `, interested_in = $${paramCount}`;
            values.push(interestedIn);
            paramCount++;
        }
        if (gender !== undefined) {
            query += `, gender = $${paramCount}`;
            values.push(gender);
            paramCount++;
        }
        if (city !== undefined) {
            query += `, city = $${paramCount}`;
            values.push(city);
            paramCount++;
        }
        
        query += ` WHERE id = $${paramCount} RETURNING id, name, email, age, bio, photos, interested_in, profile_completed, is_premium`;
        values.push(req.userId);
        
        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        
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
        user.photos = photos;
        
        res.json(user);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload photo
router.post('/upload-photo', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
        console.log('📁 Photo saved:', photoUrl);
        
        // Get current user's photos
        const userResult = await db.query('SELECT photos FROM users WHERE id = $1', [req.userId]);
        let photos = userResult.rows[0]?.photos || [];
        
        if (!Array.isArray(photos)) {
            photos = [];
        }
        
        photos = [photoUrl]; // Replace with new photo (only keep one)
        
        await db.query('UPDATE users SET photos = $1, updated_at = NOW() WHERE id = $2', [photos, req.userId]);
        
        res.json({ 
            success: true, 
            photos: photos,
            photoUrl: photoUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete photo
router.delete('/photo/:photoUrl', auth, async (req, res) => {
    try {
        const photoUrl = decodeURIComponent(req.params.photoUrl);
        console.log('🗑️ Deleting photo:', photoUrl);
        
        await db.query('UPDATE users SET photos = $1, updated_at = NOW() WHERE id = $2', [[], req.userId]);
        
        res.json({ success: true, photos: [] });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;