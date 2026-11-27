-- Standalone Hostinger authentication. No application workspace tables are changed.
CREATE TABLE IF NOT EXISTS nw_auth_accounts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  user_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  temporary_expires_at BIGINT UNSIGNED NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  password_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nw_auth_flows (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  purpose VARCHAR(10) CHARACTER SET ascii NOT NULL,
  stage VARCHAR(20) CHARACTER SET ascii NOT NULL,
  invitation_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  member_id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  account_version INT UNSIGNED NULL,
  otp_mac CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  otp_generation INT UNSIGNED NOT NULL DEFAULT 1,
  otp_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at BIGINT UNSIGNED NOT NULL,
  resend_at BIGINT UNSIGNED NOT NULL,
  verified_at BIGINT UNSIGNED NULL,
  delivered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX nw_auth_flows_email (email),
  INDEX nw_auth_flows_account (account_id),
  INDEX nw_auth_flows_expiry (expires_at),
  CONSTRAINT nw_auth_flow_account_fk FOREIGN KEY (account_id) REFERENCES nw_auth_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nw_auth_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_version INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  last_seen_at BIGINT UNSIGNED NOT NULL,
  absolute_expires_at BIGINT UNSIGNED NOT NULL,
  INDEX nw_auth_sessions_account (account_id),
  INDEX nw_auth_sessions_expiry (absolute_expires_at),
  CONSTRAINT nw_auth_session_account_fk FOREIGN KEY (account_id) REFERENCES nw_auth_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nw_auth_limits (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  started_at BIGINT UNSIGNED NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX nw_auth_limits_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nw_auth_events (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  email_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ip_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event VARCHAR(64) CHARACTER SET ascii NOT NULL,
  outcome VARCHAR(12) CHARACTER SET ascii NOT NULL,
  detail VARCHAR(200) CHARACTER SET ascii NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX nw_auth_events_account_time (account_id, created_at),
  INDEX nw_auth_events_time (created_at)
) ENGINE=InnoDB;

-- One-use password-recovery links; token bytes are never stored in plaintext.
CREATE TABLE IF NOT EXISTS nw_auth_resets (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_version INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX nw_auth_resets_account (account_id),
  INDEX nw_auth_resets_expiry (expires_at),
  CONSTRAINT nw_auth_resets_account_fk FOREIGN KEY (account_id) REFERENCES nw_auth_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
