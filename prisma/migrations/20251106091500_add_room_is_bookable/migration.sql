-- Add bookable flag to ROOM table
ALTER TABLE `ROOM`
  ADD COLUMN `IS_BOOKABLE` BOOLEAN NOT NULL DEFAULT TRUE AFTER `IS_ACTIVE`;

-- Optional: index to speed up filtering by bookable
CREATE INDEX `IDX_ROOM_IS_BOOKABLE` ON `ROOM` (`IS_BOOKABLE`);



