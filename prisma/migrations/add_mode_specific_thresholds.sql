-- Migration: Add Mode-Specific Threshold Configuration Table
-- This migration adds support for different threshold values based on assignment mode

-- Create the new table for mode-specific thresholds
CREATE TABLE IF NOT EXISTS `MEETING_TYPE_MODE_THRESHOLD` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `MEETING_TYPE` enum('DR','VIP','Weekly','General','Augent','Other') NOT NULL,
  `ASSIGNMENT_MODE` varchar(20) NOT NULL,
  `URGENT_THRESHOLD_DAYS` int NOT NULL,
  `GENERAL_THRESHOLD_DAYS` int NOT NULL,
  `created_at` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `MEETING_TYPE_MODE_THRESHOLD_meetingType_assignmentMode_key` (`MEETING_TYPE`,`ASSIGNMENT_MODE`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default mode-specific threshold configurations
-- BALANCE mode
INSERT IGNORE INTO `MEETING_TYPE_MODE_THRESHOLD` (`MEETING_TYPE`, `ASSIGNMENT_MODE`, `URGENT_THRESHOLD_DAYS`, `GENERAL_THRESHOLD_DAYS`) VALUES
('DR', 'BALANCE', 7, 30),
('VIP', 'BALANCE', 7, 15),
('Augent', 'BALANCE', 7, 15),
('Weekly', 'BALANCE', 3, 15),
('General', 'BALANCE', 7, 15),
('Other', 'BALANCE', 3, 7);

-- NORMAL mode
INSERT IGNORE INTO `MEETING_TYPE_MODE_THRESHOLD` (`MEETING_TYPE`, `ASSIGNMENT_MODE`, `URGENT_THRESHOLD_DAYS`, `GENERAL_THRESHOLD_DAYS`) VALUES
('DR', 'NORMAL', 10, 30),
('VIP', 'NORMAL', 7, 15),
('Augent', 'NORMAL', 10, 15),
('Weekly', 'NORMAL', 7, 15),
('General', 'NORMAL', 10, 15),
('Other', 'NORMAL', 7, 10);

-- URGENT mode
INSERT IGNORE INTO `MEETING_TYPE_MODE_THRESHOLD` (`MEETING_TYPE`, `ASSIGNMENT_MODE`, `URGENT_THRESHOLD_DAYS`, `GENERAL_THRESHOLD_DAYS`) VALUES
('DR', 'URGENT', 14, 45),
('VIP', 'URGENT', 7, 15),
('Augent', 'URGENT', 14, 30),
('Weekly', 'URGENT', 14, 30),
('General', 'URGENT', 14, 30),
('Other', 'URGENT', 7, 15);