-- Production-grade database indexes for performance optimization
-- Run these migrations to ensure proper query performance at scale

-- ==================== USER INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_users_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON "User"(createdAt DESC);

-- ==================== PRODUCT INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_products_category ON "Product"(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON "Product"(price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON "Product"(createdAt DESC);

-- ==================== SELLER PRODUCT INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_seller_products_seller_id ON "SellerProduct"(sellerId, status);
CREATE INDEX IF NOT EXISTS idx_seller_products_category ON "SellerProduct"(category, subCategory);
CREATE INDEX IF NOT EXISTS idx_seller_products_price ON "SellerProduct"(currentPrice);
CREATE INDEX IF NOT EXISTS idx_seller_products_demand_score ON "SellerProduct"(demandScore DESC);
CREATE INDEX IF NOT EXISTS idx_seller_products_conversion_rate ON "SellerProduct"(conversionRate DESC);
CREATE INDEX IF NOT EXISTS idx_seller_products_published ON "SellerProduct"(publishedAt DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_seller_products_search ON "SellerProduct" USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ==================== CART & ORDER INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON "Cart"(userId);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON "CartItem"(cartId);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON "Order"(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON "Order"(status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON "OrderItem"(orderId);

-- ==================== BUY REQUEST INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_buy_requests_user_id ON "BuyRequest"(userId, status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_buy_requests_status ON "BuyRequest"(status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_buy_requests_delivery_date ON "BuyRequest"(deliveryDate) WHERE status != 'cancelled';

-- ==================== CHAT INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON "ChatMessage"(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_intent ON "ChatMessage"(intent) WHERE intent IS NOT NULL;

-- ==================== ACTIVITY LOG INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON "ActivityLog"(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON "ActivityLog"(action, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_composite ON "ActivityLog"(userId, action, createdAt DESC);

-- ==================== WALLET INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON "Wallet"(userId);
CREATE INDEX IF NOT EXISTS idx_wallets_ai_authorized ON "Wallet"(isAiAuthorized) WHERE isAiAuthorized = true;
CREATE INDEX IF NOT EXISTS idx_wallets_locked ON "Wallet"(isLocked) WHERE isLocked = true;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON "WalletTransaction"(walletId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type_status ON "WalletTransaction"(type, status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON "WalletTransaction"(orderId) WHERE orderId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON "WalletTransaction"(referenceId) WHERE referenceId IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_authorizations_wallet_id ON "WalletAuthorization"(walletId, status);
CREATE INDEX IF NOT EXISTS idx_wallet_authorizations_status ON "WalletAuthorization"(status, expiresAt);

CREATE INDEX IF NOT EXISTS idx_wallet_spending_limits_wallet_id ON "WalletSpendingLimit"(walletId, limitType);

CREATE INDEX IF NOT EXISTS idx_wallet_audit_logs_wallet_id ON "WalletAuditLog"(walletId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_logs_action ON "WalletAuditLog"(action, createdAt DESC);

-- ==================== SELLER INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON "Seller"(userId);
CREATE INDEX IF NOT EXISTS idx_sellers_store_name ON "Seller"(storeName);
CREATE INDEX IF NOT EXISTS idx_sellers_vendor_tier ON "Seller"(vendorTier);
CREATE INDEX IF NOT EXISTS idx_sellers_verified ON "Seller"(isVerified) WHERE isVerified = true;

CREATE INDEX IF NOT EXISTS idx_seller_ai_analytics_seller_id ON "SellerAiAnalytics"(sellerId);

-- ==================== PRICE HISTORY INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_price_history_seller_id ON "PriceHistory"(sellerId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON "PriceHistory"(productId, createdAt DESC);

-- ==================== DEMAND METRICS INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_demand_metrics_seller_id ON "DemandMetrics"(sellerId, scope, createdAt DESC);

-- ==================== LISTING TEMPLATE INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_listing_templates_seller_id ON "ListingTemplate"(sellerId, category);
CREATE INDEX IF NOT EXISTS idx_listing_templates_active ON "ListingTemplate"(isActive) WHERE isActive = true;

-- ==================== AI MEMORY INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON "UserPreferences"(userId);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON "UserMemory"(userId);
CREATE INDEX IF NOT EXISTS idx_ranking_personalization_user_id ON "RankingPersonalization"(userId);
CREATE INDEX IF NOT EXISTS idx_auto_decision_logs_user_id ON "AutoDecisionLog"(userId, createdAt DESC);

-- ==================== FEATURE FLAG INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON "FeatureFlag"(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON "FeatureFlag"(isEnabled) WHERE isEnabled = true;

-- ==================== COMPOSITE INDEXES FOR COMMON QUERIES ====================
CREATE INDEX IF NOT EXISTS idx_seller_products_category_price ON "SellerProduct"(category, currentPrice, demandScore DESC);
CREATE INDEX IF NOT EXISTS idx_seller_products_seller_category ON "SellerProduct"(sellerId, category, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON "Order"(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_date ON "WalletTransaction"(walletId, createdAt DESC);

-- ==================== ANALYZE & VACUUM ====================
ANALYZE;
