-- CreateTable
CREATE TABLE `ScheduledSync` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `syncType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NULL,
    `executionTime` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
