import { PrismaClient } from '@prisma/client';
import { createRetryableApiCall, withRetry, RetryOptions } from './retry-utils';
// Tạo logger đơn giản để thay thế
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || '')
};
import prisma from './prisma';

// Initialize Prisma Client
// const prismaClient = new PrismaClient();

/**
 * Cấu trúc cấu hình API Nhanh.vn
 */
export interface NhanhApiSettings {
  nhanh_app_id: string;
  nhanh_business_id: string;
  nhanh_api_key: string;
}

/**
 * Kết quả trả về từ API Nhanh.vn
 */
export interface NhanhApiResult {
  code: number;
  data?: any;
  error?: string;
}

/**
 * Lấy thông tin sản phẩm từ Nhanh.vn theo ID
 */
export async function getNhanhProductById(id: string | number, settings: NhanhApiSettings): Promise<any> {
  return await callNhanhAPI('product/search', { id }, settings);
}

/**
 * Search products on Nhanh.vn by specified criteria
 */
export async function searchNhanhProducts(
  criteria: { [key: string]: any },
  settings: NhanhApiSettings
): Promise<NhanhApiResult> {
  const NHANH_APP_ID = settings.nhanh_app_id;
  const NHANH_BUSINESS_ID = settings.nhanh_business_id;
  const NHANH_API_KEY = settings.nhanh_api_key;

  try {
    const response = await fetch('https://open.nhanh.vn/api/product/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'version': '2.0',
        'appId': NHANH_APP_ID || '',
        'businessId': NHANH_BUSINESS_ID || '',
        'accessToken': NHANH_API_KEY || '',
        'data': JSON.stringify(criteria)
      })
    });

    if (!response.ok) {
      return {
        code: 0,
        error: `Connection error: ${response.status} ${response.statusText}`
      };
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[Nhanh API] Error searching products:`, error.message);
    return {
      code: 0,
      error: error.message
    };
  }
}

/**
 * Trích xuất thông tin tồn kho từ dữ liệu sản phẩm Nhanh.vn
 */
export function extractInventoryData(productData: any): number {
  let inventoryQuantity = 0;
  
  try {
    if (!productData) return 0;
    
    // Kiểm tra dữ liệu có đúng cấu trúc không
    if (productData.inventory) {
      const inventory = productData.inventory;
      
      // Trường hợp 1: Có trường remain
      if (typeof inventory.remain === 'number') {
        inventoryQuantity = inventory.remain;
      }
      
      // Trường hợp 2: Có thông tin kho chi tiết
      if (inventory.depots && Object.keys(inventory.depots).length > 0) {
        // Xem xét kho mặc định 175080 nếu có
        if (inventory.depots['175080'] && typeof inventory.depots['175080'].available === 'number') {
          inventoryQuantity = inventory.depots['175080'].available;
        } else {
          // Hoặc tính tổng từ tất cả các kho
          let total = 0;
          Object.values(inventory.depots).forEach((depot: any) => {
            if (depot && typeof depot.available === 'number') {
              total += depot.available;
            }
          });
          inventoryQuantity = total;
        }
      }
    }
    
    return Math.max(0, inventoryQuantity); // Đảm bảo không trả về số âm
  } catch (error) {
    console.error('[Nhanh] Lỗi khi trích xuất thông tin tồn kho:', error);
    return 0;
  }
}

/**
 * Trích xuất thông tin giá từ dữ liệu sản phẩm Nhanh.vn
 */
export function extractPriceData(productData: any): { price: number; compareAtPrice: number } {
  let price = 0;
  let compareAtPrice = 0;
  
  try {
    if (!productData) return { price: 0, compareAtPrice: 0 };
    
    // Lấy giá chính
    price = typeof productData.price === 'number' ? productData.price : 0;
    
    // Lấy giá so sánh (giá gốc)
    if (typeof productData.priceOriginal === 'number' && productData.priceOriginal > price) {
      compareAtPrice = productData.priceOriginal;
    } else if (typeof productData.importPrice === 'number' && productData.importPrice > price) {
      compareAtPrice = productData.importPrice;
    }
    
    return { price, compareAtPrice };
  } catch (error) {
    console.error('[Nhanh] Lỗi khi trích xuất thông tin giá:', error);
    return { price: 0, compareAtPrice: 0 };
  }
}

/**
 * Lấy cấu hình API của Nhanh.vn từ database
 */
export async function getNhanhApiSettings(): Promise<NhanhApiSettings> {
  try {
    // Lọc chỉ lấy các cài đặt cần thiết cho Nhanh API
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['nhanh_api_key', 'nhanh_app_id', 'nhanh_business_id']
        }
      }
    });

    // Chuyển đổi thành object
    const result: Record<string, string> = {};
    settings.forEach((item: { key: string; value: string }) => {
      result[item.key] = item.value;
    });

    // Kiểm tra các trường bắt buộc
    if (!result.nhanh_api_key || !result.nhanh_app_id || !result.nhanh_business_id) {
      throw new Error('Thiếu cấu hình API Nhanh.vn');
    }

    return {
      nhanh_api_key: result.nhanh_api_key,
      nhanh_app_id: result.nhanh_app_id,
      nhanh_business_id: result.nhanh_business_id
    };
  } catch (error: any) {
    logger.error('Lỗi khi lấy cấu hình Nhanh API', { error: error.message });
    throw new Error(`Không thể lấy cấu hình Nhanh API: ${error.message}`);
  }
}

/**
 * Gọi API Nhanh.vn với cơ chế retry
 */
export async function callNhanhAPI(endpoint: string, data: any, settings: NhanhApiSettings): Promise<any> {
  const startTime = Date.now();
  const apiUrl = `https://open.nhanh.vn/api/${endpoint}`;
  
  const retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    factor: 2,
    jitter: true,
    jitterFactor: 0.5,
    onRetry: (attempt, delay, error) => {
      logger.error(`Nhanh API lỗi [Lần ${attempt}]`, { 
        endpoint, 
        error: error.message,
        delay,
        duration: Date.now() - startTime
      });
    }
  };

  try {
    const result = await withRetry(async () => {
      try {
        logger.info(`Gọi Nhanh API: ${endpoint}`, { data });
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            'version': '2.0',
            'appId': settings.nhanh_app_id || '',
            'businessId': settings.nhanh_business_id || '',
            'accessToken': settings.nhanh_api_key || '',
            'data': JSON.stringify(data)
          })
        });

        if (!response.ok) {
          throw new Error(`Lỗi kết nối: ${response.status} ${response.statusText}`);
        }

        const jsonResult = await response.json();
        
        // Kiểm tra kết quả từ Nhanh API
        if (jsonResult.code !== 1) {
          const errorMessage = jsonResult.error || 'Lỗi không xác định từ Nhanh API';
          throw new Error(errorMessage);
        }
        
        return jsonResult.data;
      } catch (error: any) {
        // Kiểm tra xem có nên thử lại không
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw new Error(`Nhanh API rate limit: ${error.message}`);
        }
        
        if (error.message.includes('500')) {
          throw new Error(`Nhanh API lỗi server: ${error.message}`);
        }
        
        throw error;
      }
    }, retryOptions);
    
    // Ghi log thành công
    logger.info(`Nhanh API thành công: ${endpoint}`, { 
      duration: Date.now() - startTime 
    });
    
    return result;
  } catch (error: any) {
    logger.error(`Nhanh API lỗi sau ${retryOptions.maxRetries} lần thử: ${endpoint}`, {
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

// Tạo các phiên bản retryable của các hàm API
export const getNhanhProductWithRetry = createRetryableApiCall(
  getNhanhProductById,
  {
    maxRetries: 5,
    logPrefix: '[Nhanh Product]',
    retryableErrors: [429, 500, 502, 503, 504, 'timeout', 'network']
  }
); 