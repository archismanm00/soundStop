
-- =========================================================
-- SOUNDSTOP: INITIAL DATABASE SCHEMA
-- Migration: 001_initial_schema.sql
-- Database: PostgreSQL
-- =========================================================

-- =========================================================
-- SECTION 0: EXTENSIONS AND ENUM TYPES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE product_condition AS ENUM (
    'new',
    'like_new',
    'very_good',
    'good',
    'acceptable'
);

CREATE TYPE product_status AS ENUM (
    'draft',
    'active',
    'sold',
    'inactive'
);

CREATE TYPE cart_status AS ENUM (
    'active',
    'converted',
    'abandoned'
);

CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled',
    'partially_refunded',
    'refunded'
);


-- =========================================================
-- SECTION 1: USERS, SELLERS, AND ADDRESSES
-- =========================================================

-- 1. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. SELLER PROFILES
CREATE TABLE seller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,

    store_name VARCHAR(150) NOT NULL,
    store_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 3. SAVED ADDRESSES
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    recipient_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),

    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),

    city VARCHAR(100) NOT NULL,
    state_region VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,

    country_code CHAR(2) NOT NULL
        CHECK (country_code ~ '^[A-Z]{2}$'),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user can have only one default address.
CREATE UNIQUE INDEX one_default_address_per_user
ON addresses(user_id)
WHERE is_default = TRUE;

CREATE INDEX idx_addresses_user_id
ON addresses(user_id);


-- =========================================================
-- SECTION 2: PRODUCT CATEGORIES
-- =========================================================

-- 4. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,

    -- Allows nested categories.
    parent_id UUID
        REFERENCES categories(id) ON DELETE SET NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_categories_parent_id
ON categories(parent_id);


-- =========================================================
-- SECTION 3: PRODUCTS AND PRODUCT IMAGES
-- =========================================================

-- 5. PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    seller_id UUID NOT NULL
        REFERENCES seller_profiles(id) ON DELETE RESTRICT,

    title VARCHAR(200) NOT NULL,
    description TEXT,

    -- Prices are stored in the smallest currency unit (cents).
    price_cents BIGINT NOT NULL
        CHECK (price_cents >= 0),

    condition product_condition NOT NULL,

    inventory_quantity INTEGER NOT NULL DEFAULT 1
        CHECK (inventory_quantity >= 0),

    status product_status NOT NULL DEFAULT 'draft',

    -- Optional manufacturer/catalog information.
    brand VARCHAR(150),
    release_year SMALLINT
        CHECK (
            release_year IS NULL
            OR release_year BETWEEN 1000 AND 9999
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_seller_id
ON products(seller_id);

CREATE INDEX idx_products_status
ON products(status);

CREATE INDEX idx_products_price
ON products(price_cents);

CREATE INDEX idx_products_condition
ON products(condition);


-- 6. PRODUCT-CATEGORY RELATIONSHIP
-- Supports multiple categories per product.
CREATE TABLE product_categories (
    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    category_id UUID NOT NULL
        REFERENCES categories(id) ON DELETE CASCADE,

    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category_id
ON product_categories(category_id);


-- 7. PRODUCT IMAGES
-- Actual image files are stored externally.
-- PostgreSQL stores their URLs and metadata.
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0
        CHECK (display_order >= 0),

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A product can have only one primary image.
CREATE UNIQUE INDEX one_primary_image_per_product
ON product_images(product_id)
WHERE is_primary = TRUE;

CREATE INDEX idx_product_images_product_id
ON product_images(product_id);


-- =========================================================
-- SECTION 4: SHOPPING CARTS
-- =========================================================

-- 8. CARTS
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    status cart_status NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can have only one active cart.
CREATE UNIQUE INDEX one_active_cart_per_user
ON carts(user_id)
WHERE status = 'active';

CREATE INDEX idx_carts_user_id
ON carts(user_id);


-- 9. CART ITEMS
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cart_id UUID NOT NULL
        REFERENCES carts(id) ON DELETE CASCADE,

    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (cart_id, product_id)
);

CREATE INDEX idx_cart_items_cart_id
ON cart_items(cart_id);

CREATE INDEX idx_cart_items_product_id
ON cart_items(product_id);


-- =========================================================
-- SECTION 5: ORDERS AND ORDER ITEMS
-- =========================================================

-- 10. ORDERS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    -- Reference to the original saved address.
    -- The snapshot below remains available if it is deleted.
    shipping_address_id UUID
        REFERENCES addresses(id) ON DELETE SET NULL,

    status order_status NOT NULL DEFAULT 'pending',

    -- Monetary values are stored in cents.
    subtotal_cents BIGINT NOT NULL
        CHECK (subtotal_cents >= 0),

    shipping_cents BIGINT NOT NULL DEFAULT 0
        CHECK (shipping_cents >= 0),

    tax_cents BIGINT NOT NULL DEFAULT 0
        CHECK (tax_cents >= 0),

    discount_cents BIGINT NOT NULL DEFAULT 0
        CHECK (discount_cents >= 0),

    total_cents BIGINT NOT NULL
        CHECK (total_cents >= 0),

    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency ~ '^[A-Z]{3}$'),

    -- Shipping address snapshot.
    shipping_recipient_name VARCHAR(150) NOT NULL,
    shipping_phone_number VARCHAR(30),

    shipping_address_line1 VARCHAR(255) NOT NULL,
    shipping_address_line2 VARCHAR(255),

    shipping_city VARCHAR(100) NOT NULL,
    shipping_state_region VARCHAR(100),
    shipping_postal_code VARCHAR(20) NOT NULL,
    shipping_country_code CHAR(2) NOT NULL
        CHECK (shipping_country_code ~ '^[A-Z]{2}$'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        total_cents =
        subtotal_cents + shipping_cents + tax_cents - discount_cents
    )
);

CREATE INDEX idx_orders_user_id
ON orders(user_id);

CREATE INDEX idx_orders_status
ON orders(status);

CREATE INDEX idx_orders_created_at
ON orders(created_at DESC);


-- 11. ORDER ITEMS
-- Preserve product and seller information at purchase time.
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    -- Original product reference.
    -- Snapshots remain available if the product is deleted.
    product_id UUID
        REFERENCES products(id) ON DELETE SET NULL,

    seller_id UUID
        REFERENCES seller_profiles(id) ON DELETE SET NULL,

    -- Historical product snapshot.
    product_name VARCHAR(200) NOT NULL,
    product_description TEXT,
    product_condition product_condition NOT NULL,

    seller_store_name VARCHAR(150) NOT NULL,

    unit_price_cents BIGINT NOT NULL
        CHECK (unit_price_cents >= 0),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    line_total_cents BIGINT NOT NULL
        CHECK (line_total_cents >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        line_total_cents = unit_price_cents * quantity
    )
);

CREATE INDEX idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX idx_order_items_product_id
ON order_items(product_id);

CREATE INDEX idx_order_items_seller_id
ON order_items(seller_id);


-- =========================================================
-- SECTION 6: PAYMENTS AND STRIPE INTEGRATION
-- =========================================================

-- 12. PAYMENTS
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    status payment_status NOT NULL DEFAULT 'pending',

    amount_cents BIGINT NOT NULL
        CHECK (amount_cents > 0),

    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency ~ '^[A-Z]{3}$'),

    -- Stripe identifiers.
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_checkout_session_id VARCHAR(255) UNIQUE,

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id
ON payments(order_id);

CREATE INDEX idx_payments_status
ON payments(status);


-- 13. STRIPE WEBHOOK EVENTS
-- Stores processed webhook IDs to prevent duplicate processing.
CREATE TABLE stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(150) NOT NULL,

    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- SECTION 7: AUTOMATIC UPDATED_AT MANAGEMENT
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_seller_profiles_updated_at
BEFORE UPDATE ON seller_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_addresses_updated_at
BEFORE UPDATE ON addresses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();