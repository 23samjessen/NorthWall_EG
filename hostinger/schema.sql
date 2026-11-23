-- Run explicitly during the Hostinger setup command, never on a web request.
-- Text timestamps and hashes retain the exact existing audit representation.
CREATE TABLE IF NOT EXISTS `workspace` (
  `id` VARBINARY(400) NOT NULL,
  `payload` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `revision` BIGINT UNSIGNED NOT NULL,
  `last_hash` VARBINARY(64) NOT NULL,
  `updated_at` VARBINARY(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id` VARBINARY(400) NOT NULL,
  `sequence` BIGINT UNSIGNED NOT NULL,
  `timestamp` VARBINARY(40) NOT NULL,
  `actor_id` VARBINARY(400) NOT NULL,
  `actor_name` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `action` VARBINARY(80) NOT NULL,
  `object_id` VARBINARY(400) NOT NULL,
  `request_id` VARBINARY(100) NOT NULL,
  `changes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `previous_hash` VARBINARY(64) NOT NULL,
  `hash` VARBINARY(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_events_sequence_unique` (`sequence`),
  UNIQUE KEY `audit_events_hash_unique` (`hash`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

-- statement-breakpoint
-- Private portrait objects are stored outside the overwritten deployment tree.
-- Access remains behind the existing membership-protected profile-photo route.
CREATE TABLE IF NOT EXISTS `profile_photos` (
  `object_key` VARBINARY(512) NOT NULL,
  `body` MEDIUMBLOB NOT NULL,
  `byte_length` INT UNSIGNED NOT NULL,
  `content_type` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `http_metadata` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `custom_metadata` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `updated_at` VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`object_key`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;
