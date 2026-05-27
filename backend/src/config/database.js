// config/database.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000, // Increased to 60 seconds for cold starts
    idleTimeoutMillis: 30000,
    keepAlive: true,
    max: 5,
    min: 0,
    acquireTimeoutMillis: 60000
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('⚠️ Database pool error:', err.message);
});

// Test connection with retry for cold starts
const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await pool.query('SELECT NOW()');
            console.log('✅ Connected to Neon PostgreSQL -', result.rows[0].now);
            return true;
        } catch (err) {
            console.log(`⏳ Database attempt ${i + 1}/${retries}: ${err.message}`);
            if (i < retries - 1) {
                console.log(`   Waiting 3 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('❌ Failed to connect to database after multiple attempts');
    console.log('💡 Wake up your database at: https://console.neon.tech/');
    return false;
};

connectWithRetry();

module.exports = {
    query: async (text, params) => {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            console.error('Query error:', err.message);
            // If it's a connection error, try once more
            if (err.message.includes('connection') || err.message.includes('timeout')) {
                console.log('Retrying query...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await pool.query(text, params);
            }
            throw err;
        }
    },
    pool
};