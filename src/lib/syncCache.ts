import Redis from 'ioredis';
import { createHash } from 'crypto';
import prisma from './prisma';
import NodeCache from 'node-cache';
import { LRUCache } from 'lru-cache';

// Cấu hình cache
const CACHE_CONFIG = {
  // Thời gian hết hạn của cache mặc định (30 ngày)
  DEFAULT_TTL: 30 * 24 * 60 * 60,
  
  // Số lượng tối đa các key trong cache
  MAX_ITEMS: Number(process.env.CACHE_MAX_ITEMS) || 10000,
  
  // Kích thước tối đa của cache (bytes - mặc định ~50MB)
  MAX_SIZE: Number(process.env.CACHE_MAX_SIZE) || 50 * 1024 * 1024,
  
  // Thời gian sống tối đa của cache (ms)
  MAX_AGE: Number(process.env.CACHE_MAX_AGE) || 30 * 24 * 60 * 60 * 1000,
  
  // Thời gian scan để làm sạch cache (giây)
  CLEANUP_INTERVAL: Number(process.env.CACHE_CLEANUP_INTERVAL) || 3600,
  
  // Ngưỡng sử dụng để trigger eviction (%)
  EVICTION_THRESHOLD: Number(process.env.CACHE_EVICTION_THRESHOLD) || 80
};

// Tạo LRU Cache cho fallback
const lruCache = new LRUCache({
  max: CACHE_CONFIG.MAX_ITEMS,
  maxSize: CACHE_CONFIG.MAX_SIZE,
  ttl: CACHE_CONFIG.MAX_AGE,
  allowStale: false,
  updateAgeOnGet: true,
  // Tính kích thước của cache item
  sizeCalculation: (value, key) => {
    // Chuyển đổi value thành chuỗi trước khi tính toán kích thước
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const keyStr = typeof key === 'string' ? key : String(key);
    const valueSize = Buffer.byteLength(valueStr);
    const keySize = Buffer.byteLength(keyStr);
    return valueSize + keySize;
  }
});

// Tạo cache cục bộ với node-cache
const localCache = new NodeCache({
  stdTTL: CACHE_CONFIG.DEFAULT_TTL,
  checkperiod: CACHE_CONFIG.CLEANUP_INTERVAL,
  useClones: false,
  deleteOnExpire: true
});

// Kết nối Redis dùng cho cache
let redis: Redis | null = null;
let isRedisAvailable = false;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'synchub:product:',
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      return Math.min(times * 100, 3000);
    }
  });
  
  // Đặt listener cho sự kiện kết nối và lỗi
  redis.on('connect', () => {
    console.log('[SyncCache] Kết nối Redis thành công');
    isRedisAvailable = true;
  });
  
  redis.on('error', (error) => {
    console.error('[SyncCache] Lỗi kết nối Redis:', error);
    isRedisAvailable = false;
  });
} catch (error) {
  console.error('[SyncCache] Không thể khởi tạo kết nối Redis:', error);
  isRedisAvailable = false;
  redis = null;
}

// Interface cho cache data
interface ProductSyncCache {
  productId: number;
  shopifyId: string;
  dataHash: string;
  lastSynced: string;
  syncCount: number;
  size?: number; // Kích thước của dữ liệu cache (bytes)
}

/**
 * Tạo hash từ dữ liệu sản phẩm để so sánh thay đổi
 */
export function createDataHash(data: any): string {
  const stringData = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('md5').update(stringData).digest('hex');
}

/**
 * Tạo cache key từ product ID
 */
function getCacheKey(productId: number | string): string {
  return `product:${productId}`;
}

/**
 * Thực hiện lưu vào cache
 * Sẽ thử Redis trước, nếu không khả dụng sẽ dùng local cache
 */
async function setCache(key: string, data: any, ttl: number = CACHE_CONFIG.DEFAULT_TTL): Promise<boolean> {
  const serializedData = JSON.stringify(data);
  
  try {
    if (isRedisAvailable && redis) {
      await redis.set(key, serializedData, 'EX', ttl);
      return true;
    } else {
      // Fallback sang local cache nếu Redis không khả dụng
      const success = localCache.set(key, data, ttl);
      // Đồng thời lưu vào LRU cache để có giới hạn kích thước
      lruCache.set(key, data);
      return success;
    }
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi lưu cache cho key ${key}:`, error);
    // Fallback sang local cache nếu Redis lỗi
    try {
      const success = localCache.set(key, data, ttl);
      lruCache.set(key, data);
      return success;
    } catch (innerError) {
      console.error(`[SyncCache] Lỗi khi fallback sang local cache:`, innerError);
      return false;
    }
  }
}

/**
 * Lấy dữ liệu từ cache
 * Sẽ thử Redis trước, nếu không khả dụng sẽ dùng local cache
 */
async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (isRedisAvailable && redis) {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } else {
      // Fallback sang local cache
      const fromLocalCache = localCache.get<T>(key);
      if (fromLocalCache !== undefined) {
        return fromLocalCache;
      }
      
      // Thử từ LRU cache nếu local cache không có
      const fromLruCache = lruCache.get(key) as T | undefined;
      return fromLruCache || null;
    }
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi lấy cache cho key ${key}:`, error);
    
    // Fallback sang local cache nếu Redis lỗi
    try {
      const fromLocalCache = localCache.get<T>(key);
      if (fromLocalCache !== undefined) {
        return fromLocalCache;
      }
      
      // Thử từ LRU cache
      const fromLruCache = lruCache.get(key) as T | undefined;
      return fromLruCache || null;
    } catch (innerError) {
      console.error(`[SyncCache] Lỗi khi fallback sang local cache:`, innerError);
      return null;
    }
  }
}

/**
 * Xóa cache theo key
 */
async function deleteCache(key: string): Promise<boolean> {
  try {
    // Xóa từ tất cả các cache
    if (isRedisAvailable && redis) {
      await redis.del(key);
    }
    
    localCache.del(key);
    lruCache.delete(key);
    
    return true;
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi xóa cache cho key ${key}:`, error);
    return false;
  }
}

/**
 * Lấy thông tin cache của sản phẩm
 */
export async function getProductSyncCache(productId: number | string): Promise<ProductSyncCache | null> {
  try {
    const cacheKey = getCacheKey(productId);
    return await getCache<ProductSyncCache>(cacheKey);
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi lấy cache cho sản phẩm ${productId}:`, error);
    return null;
  }
}

/**
 * Cập nhật cache cho sản phẩm
 */
export async function updateProductSyncCache(
  productId: number | string, 
  dataHash: string,
  shopifyId?: string
): Promise<void> {
  try {
    const cacheKey = getCacheKey(productId);
    const now = new Date().toISOString();
    
    // Lấy cache hiện tại nếu có
    const existingCache = await getProductSyncCache(productId);
    
    const newCache: ProductSyncCache = {
      productId: Number(productId),
      shopifyId: shopifyId || (existingCache ? existingCache.shopifyId : ''),
      dataHash,
      lastSynced: now,
      syncCount: existingCache ? existingCache.syncCount + 1 : 1
    };
    
    // Tính kích thước của object để quản lý cache size
    const serialized = JSON.stringify(newCache);
    newCache.size = Buffer.byteLength(serialized);
    
    // Lưu cache với thời hạn từ cấu hình
    await setCache(cacheKey, newCache, CACHE_CONFIG.DEFAULT_TTL);
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi cập nhật cache cho sản phẩm ${productId}:`, error);
  }
}

/**
 * Xóa cache của sản phẩm
 */
export async function clearProductSyncCache(productId: number | string): Promise<boolean> {
  try {
    const cacheKey = getCacheKey(productId);
    return await deleteCache(cacheKey);
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi xóa cache cho sản phẩm ${productId}:`, error);
    return false;
  }
}

/**
 * Kiểm tra xem sản phẩm có thay đổi thực sự không
 */
export async function hasProductChanged(
  productId: number | string,
  nhanhData: any,
  shopifyData?: any
): Promise<boolean> {
  try {
    // Kiểm tra cache để biết phiên bản đã đồng bộ gần nhất
    const cachedVersion = await getProductSyncCache(productId);
    
    if (!cachedVersion) return true; // Luôn đồng bộ nếu không có trong cache
    
    // So sánh hash của dữ liệu mới với phiên bản đã cache
    const newDataHash = createDataHash(nhanhData);
    
    // Nếu không thay đổi, bỏ qua đồng bộ
    if (newDataHash === cachedVersion.dataHash) {
      console.log(`[SyncCache] Bỏ qua sản phẩm ${productId} - không có thay đổi thực sự`);
      return false;
    }
    
    // Nếu có thay đổi, cập nhật cache và thực hiện đồng bộ
    await updateProductSyncCache(productId, newDataHash, shopifyData?.id);
    return true;
  } catch (error) {
    console.error(`[SyncCache] Lỗi khi kiểm tra thay đổi sản phẩm ${productId}:`, error);
    return true; // Mặc định là thực hiện đồng bộ nếu có lỗi
  }
}

/**
 * Xóa cache cũ dựa trên thời gian hoặc kích thước
 */
export async function evictOldCache(maxAge: number = CACHE_CONFIG.MAX_AGE): Promise<number> {
  let evictedCount = 0;
  
  try {
    // Nếu sử dụng Redis
    if (isRedisAvailable && redis) {
      // Lấy tất cả keys
      const keys = await redis.keys('synchub:product:product:*');
      const now = Date.now();
      
      for (const key of keys) {
        try {
          const value = await redis.get(key);
          if (!value) continue;
          
          const cache = JSON.parse(value) as ProductSyncCache;
          const lastSynced = new Date(cache.lastSynced).getTime();
          
          // Xóa nếu quá cũ
          if (now - lastSynced > maxAge) {
            await redis.del(key);
            evictedCount++;
          }
        } catch (error) {
          console.error(`[SyncCache] Lỗi khi xử lý key: ${key}`, error);
        }
      }
    } 
    
    // Làm sạch node-cache (xóa tất cả các key hết hạn)
    const localEvicted = localCache.keys().filter(key => {
      const ttl = localCache.getTtl(key);
      if (ttl && ttl < Date.now()) {
        localCache.del(key);
        return true;
      }
      return false;
    }).length;
    
    evictedCount += localEvicted;
    
    // LRU cache tự động quản lý kích thước và sẽ tự động evict
    // khi cần thiết, không cần xử lý thêm
    
    return evictedCount;
  } catch (error) {
    console.error('[SyncCache] Lỗi khi evict cache cũ:', error);
    return 0;
  }
}

/**
 * Lấy thống kê cache
 */
export async function getSyncCacheStats(): Promise<{
  totalCached: number;
  recentlySynced: number;
  redisAvailable: boolean;
  cacheSize: number;
  memoryUsage: number;
  evictionPolicy: string;
}> {
  try {
    let keys: string[] = [];
    let totalSize = 0;
    const now = new Date();
    let recentlySynced = 0;
    
    // Nếu sử dụng Redis
    if (isRedisAvailable && redis) {
      keys = await redis.keys('synchub:product:product:*');
      
      // Đếm số sản phẩm được đồng bộ trong 24h qua
      if (keys.length > 0) {
        const values = await redis.mget(keys);
        
        values.forEach(value => {
          if (!value) return;
          
          try {
            const cache = JSON.parse(value) as ProductSyncCache;
            const lastSynced = new Date(cache.lastSynced);
            const hoursSinceSync = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceSync < 24) {
              recentlySynced++;
            }
            
            // Tính kích thước cache
            if (cache.size) {
              totalSize += cache.size;
            } else {
              totalSize += Buffer.byteLength(value);
            }
          } catch (error) {}
        });
      }
    } else {
      // Nếu dùng local cache
      const localStats = localCache.getStats();
      keys = localCache.keys();
      
      // Đếm số sản phẩm được đồng bộ trong 24h qua
      for (const key of keys) {
        const value = localCache.get<ProductSyncCache>(key);
        if (!value) continue;
        
        try {
          const lastSynced = new Date(value.lastSynced);
          const hoursSinceSync = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceSync < 24) {
            recentlySynced++;
          }
        } catch (error) {}
      }
      
      // Kích thước ước tính từ node-cache
      totalSize = localStats.ksize + localStats.vsize;
    }
    
    // Lấy thông tin sử dụng bộ nhớ
    const memUsage = process.memoryUsage();
    
    return {
      totalCached: keys.length,
      recentlySynced,
      redisAvailable: isRedisAvailable,
      cacheSize: totalSize,
      memoryUsage: memUsage.heapUsed,
      evictionPolicy: 'LRU (Least Recently Used)'
    };
  } catch (error) {
    console.error('[SyncCache] Lỗi khi lấy thống kê cache:', error);
    
    // Trả về thông tin tối thiểu nếu có lỗi
    return {
      totalCached: -1,
      recentlySynced: -1,
      redisAvailable: isRedisAvailable,
      cacheSize: -1,
      memoryUsage: -1,
      evictionPolicy: 'LRU (Least Recently Used)'
    };
  }
}

// Thiết lập cron job để làm sạch cache cũ định kỳ
setInterval(async () => {
  console.log('[SyncCache] Bắt đầu evict cache cũ...');
  const evictedCount = await evictOldCache();
  console.log(`[SyncCache] Đã xóa ${evictedCount} cache cũ`);
}, CACHE_CONFIG.CLEANUP_INTERVAL * 1000);

// Khởi tạo kiểm tra Redis mỗi 30 giây
setInterval(async () => {
  if (redis) {
    try {
      // Ping để kiểm tra kết nối Redis
      await redis.ping();
      if (!isRedisAvailable) {
        console.log('[SyncCache] Đã phục hồi kết nối Redis');
        isRedisAvailable = true;
      }
    } catch (error) {
      if (isRedisAvailable) {
        console.error('[SyncCache] Mất kết nối Redis, chuyển sang local cache');
        isRedisAvailable = false;
      }
    }
  }
}, 30000); 