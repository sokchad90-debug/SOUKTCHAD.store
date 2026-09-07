-- ============================================================
-- Sokchad MySQL Database Schema
-- ============================================================
-- Run this SQL in your Hostinger phpMyAdmin to create all tables.
-- Go to: Hostinger hPanel → Databases → phpMyAdmin → SQL tab
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('buyer','seller','admin','super_admin','staff') DEFAULT 'buyer',
    avatar_url      VARCHAR(500) DEFAULT NULL,
    cover_url       VARCHAR(500) DEFAULT NULL,
    is_verified     BOOLEAN DEFAULT FALSE,
    verified_until  DATETIME DEFAULT NULL,
    is_banned       BOOLEAN DEFAULT FALSE,
    banned_until    DATETIME DEFAULT NULL,
    seller_id       VARCHAR(20) DEFAULT NULL UNIQUE,
    rating          DECIMAL(3,2) DEFAULT 0.00,
    total_sales     INT DEFAULT 0,
    total_purchases INT DEFAULT 0,
    location        VARCHAR(100) DEFAULT NULL,
    bio             TEXT DEFAULT NULL,
    language_pref   ENUM('en','fr','ar') DEFAULT 'en',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id         VARCHAR(50) PRIMARY KEY,
    name_en    VARCHAR(100) NOT NULL,
    name_fr    VARCHAR(100) NOT NULL,
    name_ar    VARCHAR(100) NOT NULL,
    icon       VARCHAR(50) NOT NULL,
    color      VARCHAR(10) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active  BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    seller_id       INT NOT NULL,
    title_en        VARCHAR(255) NOT NULL,
    title_fr        VARCHAR(255) DEFAULT '',
    title_ar        VARCHAR(255) DEFAULT '',
    description_en  TEXT,
    description_fr  TEXT,
    description_ar  TEXT,
    price           INT NOT NULL,
    category_id     VARCHAR(50),
    `condition`     ENUM('new','used','like_new') DEFAULT 'new',
    location        VARCHAR(100) DEFAULT '',
    is_pinned       BOOLEAN DEFAULT FALSE,
    pinned_until    DATETIME DEFAULT NULL,
    status          ENUM('active','sold','inactive') DEFAULT 'active',
    views           INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    image_url   VARCHAR(500) NOT NULL,
    sort_order  INT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment methods (admin-managed)
CREATE TABLE IF NOT EXISTS payment_methods (
    id           VARCHAR(50) PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    logo_url     VARCHAR(500) DEFAULT '',
    color        VARCHAR(10) DEFAULT '#000000',
    instructions TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seller payment methods (which methods each seller accepts)
CREATE TABLE IF NOT EXISTS seller_payment_methods (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    seller_id         INT NOT NULL,
    payment_method_id VARCHAR(50) NOT NULL,
    receiving_number  VARCHAR(30) NOT NULL,
    UNIQUE KEY (seller_id, payment_method_id),
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    product_id        INT NOT NULL,
    buyer_id          INT NOT NULL,
    seller_id         INT NOT NULL,
    amount            INT NOT NULL,
    payment_method_id VARCHAR(50),
    reference_id      VARCHAR(100) DEFAULT '',
    buyer_phone       VARCHAR(20) DEFAULT '',
    status            ENUM('pending','confirmed','disputed','cancelled','delivered','completed') DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reference (reference_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id        INT NOT NULL,
    seller_id       INT NOT NULL,
    product_id      INT,
    last_message    TEXT,
    last_message_at DATETIME,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    text            TEXT NOT NULL,
    text_en         TEXT DEFAULT NULL,
    text_fr         TEXT DEFAULT NULL,
    text_ar         TEXT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    product_id  INT NOT NULL,
    buyer_id    INT NOT NULL,
    seller_id   INT NOT NULL,
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT NOT NULL,
    photo_url   VARCHAR(500) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    reporter_id INT NOT NULL,
    reason      TEXT NOT NULL,
    status      ENUM('open','resolved','rejected') DEFAULT 'open',
    admin_notes TEXT DEFAULT NULL,
    resolved_by INT DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin staff
CREATE TABLE IF NOT EXISTS admin_staff (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL UNIQUE,
    permissions JSON NOT NULL DEFAULT ('[]'),
    created_by  INT DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blacklist
CREATE TABLE IF NOT EXISTS blacklist (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    username    VARCHAR(100) NOT NULL,
    reason      TEXT DEFAULT NULL,
    banned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Verification Requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_requests (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    id_front_url  VARCHAR(500) NOT NULL,
    id_back_url   VARCHAR(500) NOT NULL,
    selfie_url    VARCHAR(500) NOT NULL,
    receipt_url   VARCHAR(500) NOT NULL,
    status        ENUM('pending','approved','rejected') DEFAULT 'pending',
    admin_notes   TEXT DEFAULT NULL,
    reviewed_by   INT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Store Settings table (key-value for branding)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_settings (
    `key`   VARCHAR(100) PRIMARY KEY,
    value   TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Ad Banners table
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_banners (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) DEFAULT '',
    image_url   VARCHAR(500) NOT NULL,
    link        VARCHAR(500) DEFAULT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED: Default categories (run once after creating tables)
-- ============================================================
INSERT IGNORE INTO categories (id, name_en, name_fr, name_ar, icon, color, sort_order) VALUES
('electronics', 'Electronics', 'Electronique', 'إلكترونيات', 'devices', '#3B82F6', 1),
('vehicles', 'Vehicles', 'Vehicules', 'مركبات', 'directions-car', '#EF4444', 2),
('fashion', 'Fashion', 'Mode', 'أزياء', 'checkroom', '#EC4899', 3),
('home', 'Home & Garden', 'Maison & Jardin', 'منزل وحديقة', 'home', '#10B981', 4),
('agriculture', 'Agriculture', 'Agriculture', 'زراعة', 'grass', '#84CC16', 5),
('services', 'Services', 'Services', 'خدمات', 'build', '#8B5CF6', 6),
('sports', 'Sports', 'Sports', 'رياضة', 'sports-soccer', '#F59E0B', 7),
('other', 'Other', 'Autres', 'أخرى', 'more-horiz', '#6B7280', 8);
