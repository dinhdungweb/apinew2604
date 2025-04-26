-- AlterTable
ALTER TABLE `ProductMapping` MODIFY `nhanhData` TEXT NOT NULL,
    MODIFY `errorMsg` TEXT NULL;

-- AlterTable
ALTER TABLE `Setting` MODIFY `value` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `SyncLog` MODIFY `details` TEXT NULL;
