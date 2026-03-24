-- Game Documentation Tables
-- Run this SQL on your MySQL/MariaDB server to enable the Documentation feature.

CREATE TABLE IF NOT EXISTS `game_documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(80) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `updated_by` VARCHAR(100) DEFAULT 'admin',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_game_key` (`game_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `game_document_versions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `game_key` VARCHAR(80) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `saved_by` VARCHAR(100) DEFAULT 'admin',
  `saved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_game_key` (`game_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
