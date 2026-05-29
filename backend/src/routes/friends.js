const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Send friend request
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const toUserId = parseInt(req.params.userId);
    
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }
    
    // Check if already friends or request exists
    const existing = await db.query(
      `SELECT * FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [fromUserId, toUserId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Friend request already exists or already friends' });
    }
    
    await db.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [fromUserId, toUserId]
    );
    
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.put('/accept/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendUserId = parseInt(req.params.userId);
    
    const result = await db.query(
      `UPDATE friendships SET status = 'accepted', updated_at = NOW() 
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING *`,
      [friendUserId, currentUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject friend request
router.put('/reject/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendUserId = parseInt(req.params.userId);
    
    await db.query(
      `UPDATE friendships SET status = 'rejected' 
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [friendUserId, currentUserId]
    );
    
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// Unfriend / Cancel request
router.delete('/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    
    await db.query(
      `DELETE FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [currentUserId, otherUserId]
    );
    
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Unfriend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Get friends list
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const friends = await db.query(
      `SELECT DISTINCT u.id, u.name, u.photos, u.online_status, u.bio, u.age,
              f.status, f.created_at as friends_since
       FROM friendships f
       JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id)
       WHERE (f.user_id = $1 OR f.friend_id = $1) 
         AND f.status = 'accepted' 
         AND u.id != $1
       ORDER BY u.name`,
      [userId]
    );
    
    res.json(friends.rows);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Get pending friend requests (incoming)
router.get('/requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const requests = await db.query(
      `SELECT u.id, u.name, u.photos, u.age, f.created_at as requested_at
       FROM friendships f
       JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    res.json(requests.rows);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

// Get sent friend requests
router.get('/sent-requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sent = await db.query(
      `SELECT u.id, u.name, u.photos, u.age, f.created_at as sent_at
       FROM friendships f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    res.json(sent.rows);
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ error: 'Failed to get sent requests' });
  }
});

// Check friendship status with a user
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    
    const result = await db.query(
      `SELECT * FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [currentUserId, otherUserId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ status: 'none' });
    }
    
    res.json({ status: result.rows[0].status });
  } catch (error) {
    console.error('Check friendship status error:', error);
    res.status(500).json({ error: 'Failed to check friendship status' });
  }
});

module.exports = router;