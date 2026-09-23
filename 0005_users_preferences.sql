ALTER TABLE users ADD COLUMN frequency TEXT DEFAULT 'daily';
ALTER TABLE users ADD COLUMN paused_until TEXT;
ALTER TABLE users ADD COLUMN verification_token TEXT;
