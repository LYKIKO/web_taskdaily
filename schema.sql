CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('daily', 'custom') NOT NULL DEFAULT 'custom',
  priority ENUM('normal', 'high') NOT NULL DEFAULT 'normal',
  done TINYINT(1) NOT NULL DEFAULT 0,
  last_done_date DATE NULL,
  created_at BIGINT NOT NULL
);
