import { Redis } from 'ioredis';

// Khởi tạo Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Cache key prefix
const CACHE_PREFIX = 'nhanh:';
const CACHE_EXPIRATION = 5 * 60; // 5 phút (giây)

// Lấy dữ liệu sản phẩm Nhanh.vn từ cache
export const getNhanhProductCache = async (productId: string) => {
  try {
    const cacheKey = `${CACHE_PREFIX}product:${productId}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Nhanh cache error:', error);
    return null;
  }
};

// Lưu dữ liệu sản phẩm Nhanh.vn vào cache
export const setNhanhProductCache = async (productId: string, data: any) => {
  try {
    const cacheKey = `${CACHE_PREFIX}product:${productId}`;
    await redis.setex(cacheKey, CACHE_EXPIRATION, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Nhanh cache error:', error);
    return false;
  }
};

// Cache cho kết quả tìm kiếm Nhanh.vn
export const getNhanhSearchCache = async (searchQuery: string) => {
  try {
    const cacheKey = `${CACHE_PREFIX}search:${searchQuery}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Nhanh search cache error:', error);
    return null;
  }
};

export const setNhanhSearchCache = async (searchQuery: string, results: any[]) => {
  try {
    const cacheKey = `${CACHE_PREFIX}search:${searchQuery}`;
    await redis.setex(cacheKey, CACHE_EXPIRATION, JSON.stringify(results));
    return true;
  } catch (error) {
    console.error('Nhanh search cache error:', error);
    return false;
  }
};

// Lấy dữ liệu tồn kho từ cache
export const getNhanhInventoryCache = async (productId: string) => {
  try {
    const cacheKey = `${CACHE_PREFIX}inventory:${productId}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    console.error('Nhanh inventory cache error:', error);
    return null;
  }
};

export const setNhanhInventoryCache = async (productId: string, data: any) => {
  try {
    const cacheKey = `${CACHE_PREFIX}inventory:${productId}`;
    await redis.setex(cacheKey, CACHE_EXPIRATION, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Nhanh inventory cache error:', error);
    return false;
  }
};

// Xóa cache
export const clearNhanhCache = async (pattern: string = '*') => {
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    console.log(`Đã xóa ${keys.length} cache keys`);
    return true;
  } catch (error) {
    console.error('Nhanh cache clear error:', error);
    return false;
  }
};

// Cấu hình cache
export const NHANH_CACHE_CONFIG = {
  EXPIRATION: CACHE_EXPIRATION,
  MAX_RETRIES: 3,
  TIMEOUT: 10000
}; 