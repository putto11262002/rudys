-- Migration: Session Flow Refactor
-- Changes:
-- 1. Drop demand_snapshots table (no longer needed - demand is always computed)
-- 2. Rename sessions.status to sessions.last_phase
-- 3. Update session phase values to new simplified enum

-- Drop demand_snapshots table
DROP TABLE IF EXISTS demand_snapshots;

-- Add new last_phase column with new enum values
ALTER TABLE sessions ADD COLUMN last_phase text DEFAULT 'loading-lists';

-- Migrate existing status values to new phase values
UPDATE sessions SET last_phase = 'loading-lists' WHERE status IN ('draft', 'capturing_loading_lists');
UPDATE sessions SET last_phase = 'demand' WHERE status = 'review_demand';
UPDATE sessions SET last_phase = 'inventory' WHERE status = 'capturing_inventory';
UPDATE sessions SET last_phase = 'order' WHERE status IN ('review_order', 'completed');

-- Make last_phase NOT NULL after migration
ALTER TABLE sessions ALTER COLUMN last_phase SET NOT NULL;

-- Drop the old status column
ALTER TABLE sessions DROP COLUMN status;
