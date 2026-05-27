const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const User = require('../models/User');
const db = require('../config/database');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage (better for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Upload single photo to Cloudinary
router.post('/photo', auth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'hookup-app/users',
                    transformation: [
                        { width: 500, height: 500, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        // Get current user and update photos array
        const currentUser = await User.findById(req.userId);
        const photos = [...(currentUser.photos || []), result.secure_url];
        const updatedUser = await User.update(req.userId, { photos });

        res.json({ 
            success: true, 
            photos: updatedUser.photos,
            photoUrl: result.secure_url
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete photo from Cloudinary
router.delete('/photo/:photoUrl', auth, async (req, res) => {
    try {
        const photoUrl = decodeURIComponent(req.params.photoUrl);
        
        // Extract public ID from Cloudinary URL
        const publicId = photoUrl.split('/hookup-app/users/')[1]?.split('.')[0];
        if (publicId) {
            await cloudinary.uploader.destroy(`hookup-app/users/${publicId}`);
        }

        // Remove from user's photos array
        const currentUser = await User.findById(req.userId);
        const photos = (currentUser.photos || []).filter(p => p !== photoUrl);
        const updatedUser = await User.update(req.userId, { photos });

        res.json({ success: true, photos: updatedUser.photos });
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;