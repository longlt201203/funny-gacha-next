-- CreateTable
CREATE TABLE `PullHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bannerName` VARCHAR(191) NOT NULL,
    `pullBatchId` VARCHAR(191) NOT NULL,
    `pullOrder` INTEGER NOT NULL,
    `rarity` INTEGER NOT NULL,
    `itemType` ENUM('WEAPON', 'CHARACTER') NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `itemImage` VARCHAR(191) NOT NULL,
    `featured` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
