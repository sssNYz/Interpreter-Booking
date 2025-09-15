-- Migration: Add DR_TYPE and OTHER_TYPE fields to BOOKING_PLAN table
-- Date: 2024-12-19
-- This migration adds new fields to support enhanced meeting type categorization

-- Add DR_TYPE enum column
ALTER TABLE `BOOKING_PLAN` 
ADD COLUMN `DR_TYPE` ENUM('PR-PR', 'DR-k', 'DR-II', 'DR-I', 'Other') NULL 
COMMENT 'DR Type when Meeting Type is DR';

-- Add OTHER_TYPE varchar column
ALTER TABLE `BOOKING_PLAN` 
ADD COLUMN `OTHER_TYPE` VARCHAR(255) NULL 
COMMENT 'Custom meeting type name when Meeting Type is Other or DR Type is Other';

-- Add OTHER_TYPE_SCOPE enum column
ALTER TABLE `BOOKING_PLAN` 
ADD COLUMN `OTHER_TYPE_SCOPE` ENUM('meeting_type', 'dr_type') NULL 
COMMENT 'Scope of the other type (meeting_type or dr_type)';

-- Add index on DR_TYPE for better query performance
CREATE INDEX `BOOKING_PLAN_DR_TYPE_idx` ON `BOOKING_PLAN` (`DR_TYPE`);

-- Add index on OTHER_TYPE_SCOPE for better query performance
CREATE INDEX `BOOKING_PLAN_OTHER_TYPE_SCOPE_idx` ON `BOOKING_PLAN` (`OTHER_TYPE_SCOPE`);


