/*
  Warnings:

  - You are about to drop the column `POOL_PROCESSING` on the `ASSIGNMENT_LOG` table. All the data in the column will be lost.
  - You are about to drop the column `POOL_DEADLINE_TIME` on the `BOOKING_PLAN` table. All the data in the column will be lost.
  - You are about to drop the column `POOL_ENTRY_TIME` on the `BOOKING_PLAN` table. All the data in the column will be lost.
  - You are about to drop the column `POOL_PROCESSING_ATTEMPTS` on the `BOOKING_PLAN` table. All the data in the column will be lost.
  - You are about to drop the column `POOL_STATUS` on the `BOOKING_PLAN` table. All the data in the column will be lost.
  - You are about to drop the `AUTO_APPROVAL_LOG` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `POOL_ENTRY_HISTORY` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `POOL_PROCESSING_LOG` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `POOL_PROCESSING_LOG_ENTRY` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `POOL_ENTRY_HISTORY` DROP FOREIGN KEY `POOL_ENTRY_HISTORY_BOOKING_ID_fkey`;

-- DropForeignKey
ALTER TABLE `POOL_PROCESSING_LOG_ENTRY` DROP FOREIGN KEY `POOL_PROCESSING_LOG_ENTRY_BOOKING_ID_fkey`;

-- DropForeignKey
ALTER TABLE `POOL_PROCESSING_LOG_ENTRY` DROP FOREIGN KEY `POOL_PROCESSING_LOG_ENTRY_LOG_ID_fkey`;

-- DropIndex
DROP INDEX `BOOKING_PLAN_POOL_DEADLINE_TIME_idx` ON `BOOKING_PLAN`;

-- DropIndex
DROP INDEX `BOOKING_PLAN_POOL_STATUS_POOL_DEADLINE_TIME_idx` ON `BOOKING_PLAN`;

-- DropIndex
DROP INDEX `BOOKING_PLAN_POOL_STATUS_idx` ON `BOOKING_PLAN`;

-- AlterTable
ALTER TABLE `ASSIGNMENT_LOG` DROP COLUMN `POOL_PROCESSING`;

-- AlterTable
ALTER TABLE `BOOKING_PLAN` DROP COLUMN `POOL_DEADLINE_TIME`,
    DROP COLUMN `POOL_ENTRY_TIME`,
    DROP COLUMN `POOL_PROCESSING_ATTEMPTS`,
    DROP COLUMN `POOL_STATUS`;

-- DropTable
DROP TABLE `AUTO_APPROVAL_LOG`;

-- DropTable
DROP TABLE `POOL_ENTRY_HISTORY`;

-- DropTable
DROP TABLE `POOL_PROCESSING_LOG`;

-- DropTable
DROP TABLE `POOL_PROCESSING_LOG_ENTRY`;

-- CreateTable
CREATE TABLE `MEETING_TYPE_MODE_THRESHOLD` (
    `ID` INTEGER NOT NULL AUTO_INCREMENT,
    `MEETING_TYPE` ENUM('DR', 'VIP', 'Weekly', 'General', 'Augent', 'Other') NOT NULL,
    `ASSIGNMENT_MODE` VARCHAR(20) NOT NULL,
    `URGENT_THRESHOLD_DAYS` INTEGER NOT NULL,
    `GENERAL_THRESHOLD_DAYS` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `MEETING_TYPE_MODE_THRESHOLD_MEETING_TYPE_ASSIGNMENT_MODE_key`(`MEETING_TYPE`, `ASSIGNMENT_MODE`),
    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
