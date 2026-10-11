CREATE TABLE IF NOT EXISTS account_security_lock (
  id TINYINT PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO account_security_lock (id) VALUES (1);

CREATE TABLE IF NOT EXISTS role_reauthentication (
  user_id CHAR(36) PRIMARY KEY,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  window_start DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT role_reauth_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_audit (
  id CHAR(36) PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  target_user_id CHAR(36) NOT NULL,
  previous_role ENUM('admin','caregiver') NULL,
  new_role ENUM('admin','caregiver') NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  action_type ENUM('ROLE_PROMOTED','ROLE_DEMOTED') NOT NULL,
  request_id CHAR(36) NOT NULL,
  result ENUM('success','failure') NOT NULL,
  reason_code VARCHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  INDEX security_audit_target_date (target_user_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No foreign keys here: deleting an account must never remove its audit history.
CREATE TRIGGER IF NOT EXISTS security_audit_no_update BEFORE UPDATE ON security_audit
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='AUDIT_IMMUTABLE';
CREATE TRIGGER IF NOT EXISTS security_audit_no_delete BEFORE DELETE ON security_audit
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='AUDIT_IMMUTABLE';

-- Install with a migration account. The runtime account only needs EXECUTE;
-- it must not have direct INSERT/UPDATE permission on users.role (see docs).
CREATE OR REPLACE PROCEDURE change_user_role(
  IN p_session_hash CHAR(64),
  IN p_verified_password_hash VARCHAR(255),
  IN p_target CHAR(36),
  IN p_role VARCHAR(16),
  IN p_expected_role VARCHAR(16),
  IN p_request_id CHAR(36),
  IN p_ip VARCHAR(45),
  IN p_user_agent VARCHAR(512)
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_actor CHAR(36) DEFAULT NULL;
  DECLARE v_actor_role VARCHAR(16) DEFAULT NULL;
  DECLARE v_password VARCHAR(255) DEFAULT NULL;
  DECLARE v_previous VARCHAR(16) DEFAULT NULL;
  DECLARE v_archived DATETIME(3) DEFAULT NULL;
  DECLARE v_admins INT DEFAULT 0;
  DECLARE v_lock TINYINT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SELECT id INTO v_lock FROM account_security_lock WHERE id=1 FOR UPDATE;
  IF v_lock IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_SECURITY_UNAVAILABLE';
  END IF;
  SELECT u.id,u.role,u.password_hash INTO v_actor,v_actor_role,v_password
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=p_session_hash AND s.expires_at>NOW(3) AND u.archived_at IS NULL
    LIMIT 1 FOR UPDATE;
  IF v_actor IS NULL OR v_actor_role<>'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_FORBIDDEN';
  END IF;
  IF p_verified_password_hash IS NULL OR BINARY v_password<>BINARY p_verified_password_hash THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_REAUTH_REQUIRED';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin','caregiver')
    OR p_expected_role IS NULL OR p_expected_role NOT IN ('admin','caregiver')
    OR p_role=p_expected_role THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_INVALID';
  END IF;
  IF v_actor=p_target THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_SELF_CHANGE';
  END IF;
  SELECT role,archived_at INTO v_previous,v_archived FROM users WHERE id=p_target FOR UPDATE;
  IF v_previous IS NULL OR v_archived IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_TARGET_UNAVAILABLE';
  END IF;
  IF v_previous<>p_expected_role THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_STALE';
  END IF;
  IF p_role='caregiver' THEN
    SELECT COUNT(*) INTO v_admins FROM users WHERE role='admin' AND archived_at IS NULL;
    IF v_admins<=1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ROLE_LAST_ADMIN';
    END IF;
  END IF;
  UPDATE users SET role=p_role WHERE id=p_target;
  INSERT INTO security_audit
    (id,actor_user_id,target_user_id,previous_role,new_role,action_type,request_id,result,ip_address,user_agent)
    VALUES (UUID(),v_actor,p_target,v_previous,p_role,
      IF(p_role='admin','ROLE_PROMOTED','ROLE_DEMOTED'),p_request_id,'success',p_ip,p_user_agent);
  DELETE FROM sessions WHERE user_id=p_target;
  COMMIT;
END;
