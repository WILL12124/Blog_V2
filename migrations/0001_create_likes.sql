-- Migration: Create post_likes table
-- Tracks like counts per post slug

CREATE TABLE IF NOT EXISTS post_likes (
  slug TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0
);
