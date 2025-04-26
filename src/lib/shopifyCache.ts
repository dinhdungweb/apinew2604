import { Redis } from 'ioredis';

// Khởi tạo Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Cache key prefix
const CACHE_PREFIX = 'shopify:';
const CACHE_EXPIRATION = 5 * 60; // 5 phút (giây)

// Cache chia sẻ cho sản phẩm Shopify
let shopifyProductsCache: any[] | null = null;
let shopifyCacheTimestamp: number = 0;

// Lấy dữ liệu từ cache
export const getShopifyCache = async () => {
  try {
    const cacheKey = `${CACHE_PREFIX}products`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return [];
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to in-memory cache if Redis fails
    return shopifyProductsCache || [];
  }
};

export const getShopifyCacheInfo = async () => {
  try {
    const cacheKey = `${CACHE_PREFIX}products`;
    const cachedData = await redis.get(cacheKey);
    const ttl = await redis.ttl(cacheKey);
    
    return {
      cache: cachedData ? JSON.parse(cachedData) : null,
      timestamp: Date.now() - (CACHE_EXPIRATION - ttl) * 1000,
      isExpired: ttl < 0,
      itemCount: cachedData ? JSON.parse(cachedData).length : 0
    };
  } catch (error) {
    console.error('Cache info error:', error);
    // Fallback to in-memory cache
    return {
      cache: shopifyProductsCache,
      timestamp: shopifyCacheTimestamp,
      isExpired: (Date.now() - shopifyCacheTimestamp) > CACHE_EXPIRATION * 1000,
      itemCount: shopifyProductsCache?.length || 0
    };
  }
};

// Lưu dữ liệu vào cache
export const setShopifyCache = async (products: any[]) => {
  // Fallback variables for in-memory caching
  shopifyProductsCache = products;
  shopifyCacheTimestamp = Date.now();
  
  try {
    const cacheKey = `${CACHE_PREFIX}products`;
    await redis.setex(cacheKey, CACHE_EXPIRATION, JSON.stringify(products));
    console.log(`Cache đã được cập nhật với ${products.length} sản phẩm, hết hạn sau ${CACHE_EXPIRATION} giây`);
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

// Xóa cache
export const clearShopifyCache = async () => {
  // Clear in-memory cache
  shopifyProductsCache = null;
  shopifyCacheTimestamp = 0;
  
  try {
    const cacheKey = `${CACHE_PREFIX}products`;
    await redis.del(cacheKey);
    console.log('Cache đã được xóa');
    return true;
  } catch (error) {
    console.error('Cache clear error:', error);
    return false;
  }
};

// Kiểm tra cache đã hết hạn chưa
export const isCacheExpired = async () => {
  try {
    const cacheKey = `${CACHE_PREFIX}products`;
    const ttl = await redis.ttl(cacheKey);
    return ttl < 0;
  } catch (error) {
    console.error('Cache TTL check error:', error);
    // Fallback to in-memory cache
    if (!shopifyProductsCache) return true;
    return (Date.now() - shopifyCacheTimestamp) > CACHE_EXPIRATION * 1000;
  }
};

// Cache cho từng sản phẩm riêng biệt
export const getProductCache = async (productId: string) => {
  try {
    const cacheKey = `${CACHE_PREFIX}product:${productId}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Product cache error:', error);
    return null;
  }
};

export const setProductCache = async (productId: string, data: any) => {
  try {
    const cacheKey = `${CACHE_PREFIX}product:${productId}`;
    await redis.setex(cacheKey, CACHE_EXPIRATION, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Product cache error:', error);
    return false;
  }
};

// Các thiết lập cho cache
export const CACHE_CONFIG = {
  EXPIRATION: CACHE_EXPIRATION,
  MAX_RETRIES: 5,
  TIMEOUT: 15000,
  ttl: CACHE_EXPIRATION,
  refreshMode: 'auto'
}; 