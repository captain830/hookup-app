-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18),
    gender VARCHAR(50),
    interested_in VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city VARCHAR(100),
    bio TEXT,
    photos TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    coins INTEGER DEFAULT 0,
    online_status BOOLEAN DEFAULT false,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(50) DEFAULT 'user',
    is_banned BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    user1 INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2 INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    action_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1, user2)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reported_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Swipes/likes table
CREATE TABLE IF NOT EXISTS swipes (
    id SERIAL PRIMARY KEY,
    swiper INTEGER REFERENCES users(id) ON DELETE CASCADE,
    swiped INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) CHECK (action IN ('like', 'pass')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(swiper, swiped)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_id VARCHAR(255),
    amount DECIMAL(10, 2),
    currency VARCHAR(3),
    status VARCHAR(50),
    plan_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_location ON users(latitude, longitude);
CREATE INDEX idx_users_age ON users(age);
CREATE INDEX idx_users_is_premium ON users(is_premium);
CREATE INDEX idx_messages_users ON messages(from_user, to_user);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_matches_users ON matches(user1, user2);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_swipes_swiper ON swipes(swiper);
CREATE INDEX idx_swipes_swiped ON swipes(swiped);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();