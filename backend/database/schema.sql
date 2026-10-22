-- TpayX Production Database Schema for MySQL / MariaDB (aaPanel)
-- Generated on 2026-10-22T07:36:53.677Z

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(32) NOT NULL UNIQUE,
  `mobile` VARCHAR(20) NOT NULL UNIQUE,
  `username` VARCHAR(100) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin` VARCHAR(20) DEFAULT NULL,
  `ref_code` VARCHAR(32) NOT NULL UNIQUE,
  `parent_id` INT DEFAULT 0,
  `inr_balance` DECIMAL(14, 2) DEFAULT 0.00,
  `bcoin_balance` DECIMAL(14, 2) DEFAULT 0.00,
  `usdt_balance` DECIMAL(14, 2) DEFAULT 0.00,
  `total_earnings` DECIMAL(14, 2) DEFAULT 0.00,
  `today_profit` DECIMAL(14, 2) DEFAULT 0.00,
  `yesterday_profit` DECIMAL(14, 2) DEFAULT 0.00,
  `is_blocked` TINYINT(1) DEFAULT 0,
  `role` VARCHAR(20) DEFAULT 'user',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_mobile` (`mobile`),
  INDEX `idx_users_ref_code` (`ref_code`),
  INDEX `idx_users_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bank Accounts Table
CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `account_holder` VARCHAR(100) NOT NULL,
  `bank_name` VARCHAR(100) NOT NULL,
  `account_number` VARCHAR(64) NOT NULL,
  `ifsc_code` VARCHAR(32) NOT NULL,
  `upi_id` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bank_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `seller_id` INT DEFAULT NULL,
  `asset_type` VARCHAR(20) DEFAULT 'INR',
  `type` VARCHAR(20) DEFAULT 'Buy',
  `amount` DECIMAL(14, 2) NOT NULL,
  `quota` DECIMAL(14, 2) DEFAULT 0.00,
  `expected_income` DECIMAL(14, 2) DEFAULT 0.00,
  `status` VARCHAR(32) DEFAULT 'Pending',
  `utr` VARCHAR(100) DEFAULT NULL,
  `screenshot_path` TEXT DEFAULT NULL,
  `payment_method` VARCHAR(50) DEFAULT 'Bank',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_order_id` (`order_id`),
  INDEX `idx_orders_user_id` (`user_id`),
  INDEX `idx_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `balance_after` DECIMAL(14, 2) DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_txn_user_id` (`user_id`),
  INDEX `idx_txn_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. User Tasks Table
CREATE TABLE IF NOT EXISTS `user_tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `task_key` VARCHAR(50) NOT NULL,
  `completed` TINYINT(1) DEFAULT 0,
  `claimed` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_task` (`user_id`, `task_key`),
  INDEX `idx_task_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Messages Table
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Settings Table
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  `value` LONGTEXT DEFAULT NULL,
  `description` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Commission Slabs Table
CREATE TABLE IF NOT EXISTS `commission_slabs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `min_amount` DECIMAL(14, 2) NOT NULL,
  `max_amount` DECIMAL(14, 2) NOT NULL,
  `commission_percent` DECIMAL(5, 2) NOT NULL,
  `flat_bonus` DECIMAL(14, 2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Price Ranges Table
CREATE TABLE IF NOT EXISTS `price_ranges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `label` VARCHAR(100) NOT NULL,
  `min_val` DECIMAL(14, 2) NOT NULL,
  `max_val` DECIMAL(14, 2) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Products Table
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `income` DECIMAL(14, 2) NOT NULL,
  `quota` DECIMAL(14, 2) NOT NULL,
  `color` VARCHAR(50) DEFAULT 'blue',
  `type` VARCHAR(50) DEFAULT 'Bank',
  `percent` VARCHAR(20) DEFAULT '2.5%',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Sliders Table
CREATE TABLE IF NOT EXISTS `sliders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `image_data` LONGTEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Withdrawals Table
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `status` VARCHAR(32) DEFAULT 'Pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_with_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Disputes Table
CREATE TABLE IF NOT EXISTS `disputes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `user_mobile` VARCHAR(20) DEFAULT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(32) DEFAULT 'Open',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Active OTPs Table
CREATE TABLE IF NOT EXISTS `otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mobile` VARCHAR(20) NOT NULL UNIQUE,
  `otp` VARCHAR(10) NOT NULL,
  `expires_at` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
