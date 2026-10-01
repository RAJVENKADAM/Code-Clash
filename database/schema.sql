-- Coding Challenge Platform - SQL Schema Reference
-- This is a reference schema. The actual implementation uses MongoDB/Mongoose.
-- PostgreSQL compatible schema for production deployment.

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    otp VARCHAR(6),
    otp_expiry TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    total_score DOUBLE PRECISION DEFAULT 0,
    challenges_completed INTEGER DEFAULT 0,
    last_active_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_score ON users(total_score DESC);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    examples JSONB DEFAULT '[]',
    constraints TEXT DEFAULT '',
    starter_code TEXT DEFAULT 'function solution(input) { return input; }',
    test_cases JSONB NOT NULL,
    active_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    total_submissions INTEGER DEFAULT 0,
    total_accepted INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_challenges_active ON challenges(active_date DESC, is_active);
CREATE INDEX idx_challenges_slug ON challenges(slug);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    challenge_id UUID NOT NULL REFERENCES challenges(id),
    code TEXT NOT NULL,
    language VARCHAR(20) DEFAULT 'java' CHECK (language = 'java'),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR', 'DISQUALIFIED')),
    score DOUBLE PRECISION DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    execution_time DOUBLE PRECISION DEFAULT 0,
    memory_used DOUBLE PRECISION DEFAULT 0,
    time_to_solve INTEGER DEFAULT 0,
    output TEXT DEFAULT '',
    error TEXT DEFAULT '',
    results JSONB DEFAULT '[]',
    violation_count INTEGER DEFAULT 0,
    is_disqualified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_submissions_user ON submissions(user_id, created_at DESC);
CREATE INDEX idx_submissions_challenge ON submissions(challenge_id, status);
CREATE INDEX idx_submissions_score ON submissions(score DESC);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    participants INTEGER DEFAULT 0,
    total_score DOUBLE PRECISION DEFAULT 0,
    average_score DOUBLE PRECISION DEFAULT 0,
    bayesian_score DOUBLE PRECISION DEFAULT 0,
    top_k_score DOUBLE PRECISION DEFAULT 0,
    rank INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_bayesian ON organizations(bayesian_score DESC);
CREATE INDEX idx_organizations_rank ON organizations(rank ASC);

-- OTP cleanup function (run on schedule)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    UPDATE users
    SET otp = NULL, otp_expiry = NULL
    WHERE otp_expiry < NOW() AND is_verified = FALSE;
END;
$$ LANGUAGE plpgsql;
