-- CreateTable
CREATE TABLE `GachaState` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bannerName` VARCHAR(191) NOT NULL,
    `currentPity` INTEGER NOT NULL DEFAULT 0,
    `fourStarPity` INTEGER NOT NULL DEFAULT 0,
    `totalPity` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GachaState_bannerName_key`(`bannerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
