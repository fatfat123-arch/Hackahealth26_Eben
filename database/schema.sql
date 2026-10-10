CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','caregiver') NOT NULL DEFAULT 'caregiver',
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX sessions_user_id (user_id), INDEX sessions_expires_at (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '', age TINYINT UNSIGNED NULL, birth_date DATE NULL,
  phone VARCHAR(80) NOT NULL DEFAULT '', phone_note VARCHAR(255) NOT NULL DEFAULT '', address TEXT NOT NULL,
  about TEXT NOT NULL, how_to TEXT NOT NULL, reminder TEXT NOT NULL,
  photo_path VARCHAR(500) NULL, photo_alt VARCHAR(255) NOT NULL DEFAULT '',
  dictionary JSON NOT NULL, communicates JSON NOT NULL, understanding_needs JSON NOT NULL,
  tools JSON NOT NULL, facilitators JSON NOT NULL, interests JSON NOT NULL, dislikes JSON NOT NULL,
  additional JSON NOT NULL, section_order JSON NOT NULL,
  created_by CHAR(36) NULL, archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX patients_name (name), INDEX patients_created_by (created_by),
  CONSTRAINT patients_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
