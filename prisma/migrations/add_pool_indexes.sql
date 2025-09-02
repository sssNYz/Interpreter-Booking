-- Add database indexes for pool queries
-- These indexes optimize pool processing queries for better performance

-- Index for pool status queries
CREATE INDEX IF NOT EXISTS idx_pool_status ON BOOKING_PLAN(POOL_STATUS);

-- Index for pool deadline queries
CREATE INDEX IF NOT EXISTS idx_pool_deadline ON BOOKING_PLAN(POOL_DEADLINE_TIME);

-- Combined index for pool ready queries (status + deadline)
CREATE INDEX IF NOT EXISTS idx_pool_ready ON BOOKING_PLAN(POOL_STATUS, POOL_DEADLINE_TIME);

-- Index for pool entry time queries (for processing order)
CREATE INDEX IF NOT EXISTS idx_pool_entry_time ON BOOKING_PLAN(POOL_ENTRY_TIME);

-- Combined index for pool processing queries (status + entry time)
CREATE INDEX IF NOT EXISTS idx_pool_processing ON BOOKING_PLAN(POOL_STATUS, POOL_ENTRY_TIME);