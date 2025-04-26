-- AlterTable
ALTER TABLE `productmapping` MODIFY `nhanhData` TEXT NOT NULL,
    MODIFY `errorMsg` TEXT NULL;

-- AlterTable
ALTER TABLE `setting` MODIFY `value` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `synclog` MODIFY `details` TEXT NULL;
