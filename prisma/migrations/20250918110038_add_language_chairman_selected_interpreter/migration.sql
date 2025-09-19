-- Migration: Add language, chairman email, and selected interpreter fields
-- This migration adds support for language selection, chairman email for DR meetings,
-- and selected interpreter for President meetings

-- Add new columns to BOOKING_PLAN table
ALTER TABLE BOOKING_PLAN 
ADD COLUMN LANGUAGE_CODE VARCHAR(16) NULL,
ADD COLUMN CHAIRMAN_EMAIL VARCHAR(255) NULL,
ADD COLUMN SELECTED_INTERPRETER_EMP_CODE VARCHAR(64) NULL;

-- Add foreign key constraints
ALTER TABLE BOOKING_PLAN 
ADD CONSTRAINT fk_booking_language 
FOREIGN KEY (LANGUAGE_CODE) REFERENCES LANGUAGE(CODE);

ALTER TABLE BOOKING_PLAN 
ADD CONSTRAINT fk_booking_selected_interpreter 
FOREIGN KEY (SELECTED_INTERPRETER_EMP_CODE) REFERENCES EMPLOYEE(EMP_CODE);

-- Add indexes for performance
CREATE INDEX idx_booking_language_code ON BOOKING_PLAN(LANGUAGE_CODE);
CREATE INDEX idx_booking_chairman_email ON BOOKING_PLAN(CHAIRMAN_EMAIL);
CREATE INDEX idx_booking_selected_interpreter ON BOOKING_PLAN(SELECTED_INTERPRETER_EMP_CODE);

-- Update MeetingType enum to include President and fix Augent to Urgent
-- Note: This updates the enum to include the new President type and fixes the typo
ALTER TABLE BOOKING_PLAN MODIFY COLUMN MEETING_TYPE ENUM('DR','VIP','Weekly','General','Urgent','President','Other');
