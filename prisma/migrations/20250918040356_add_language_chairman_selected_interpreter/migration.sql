/*
  Warnings:

  - The values [Augent] on the enum `MEETING_TYPE_MODE_THRESHOLD_MEETING_TYPE` will be removed. If these variants are still used in the database, this will fail.
  - The values [Augent] on the enum `MEETING_TYPE_MODE_THRESHOLD_MEETING_TYPE` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `MEETING_TYPE` on table `BOOKING_PLAN` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `BOOKING_PLAN` DROP FOREIGN KEY `fk_booking_language`;

-- DropForeignKey
ALTER TABLE `BOOKING_PLAN` DROP FOREIGN KEY `fk_booking_selected_interpreter`;

-- AlterTable
ALTER TABLE `BOOKING_PLAN` MODIFY `MEETING_TYPE` ENUM('DR', 'VIP', 'Weekly', 'General', 'Urgent', 'President', 'Other') NOT NULL;

-- AlterTable
ALTER TABLE `MEETING_TYPE_MODE_THRESHOLD` MODIFY `MEETING_TYPE` ENUM('DR', 'VIP', 'Weekly', 'General', 'Urgent', 'President', 'Other') NOT NULL;

-- AlterTable
ALTER TABLE `MEETING_TYPE_PRIORITY` MODIFY `MEETING_TYPE` ENUM('DR', 'VIP', 'Weekly', 'General', 'Urgent', 'President', 'Other') NOT NULL;

-- AddForeignKey
ALTER TABLE `BOOKING_PLAN` ADD CONSTRAINT `BOOKING_PLAN_LANGUAGE_CODE_fkey` FOREIGN KEY (`LANGUAGE_CODE`) REFERENCES `LANGUAGE`(`CODE`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BOOKING_PLAN` ADD CONSTRAINT `BOOKING_PLAN_SELECTED_INTERPRETER_EMP_CODE_fkey` FOREIGN KEY (`SELECTED_INTERPRETER_EMP_CODE`) REFERENCES `EMPLOYEE`(`EMP_CODE`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `BOOKING_PLAN` RENAME INDEX `idx_booking_chairman_email` TO `BOOKING_PLAN_CHAIRMAN_EMAIL_idx`;

-- RenameIndex
ALTER TABLE `BOOKING_PLAN` RENAME INDEX `idx_booking_language_code` TO `BOOKING_PLAN_LANGUAGE_CODE_idx`;

-- RenameIndex
ALTER TABLE `BOOKING_PLAN` RENAME INDEX `idx_booking_selected_interpreter` TO `BOOKING_PLAN_SELECTED_INTERPRETER_EMP_CODE_idx`;
