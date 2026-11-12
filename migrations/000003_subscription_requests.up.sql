CREATE TABLE IF NOT EXISTS subscription_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    user_email VARCHAR(255) NOT NULL DEFAULT '',
    user_name VARCHAR(255) NOT NULL DEFAULT '',
    current_plan VARCHAR(64) NOT NULL DEFAULT 'standard',
    requested_plan VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    admin_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_user ON subscription_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON subscription_requests(status);
