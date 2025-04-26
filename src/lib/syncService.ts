import { PrismaClient } from '@prisma/client';
import { getSettings } from './queue';
import { ShopifyRateLimiter, NhanhRateLimiter, PerformanceMetrics } from './rateLimiter';
import { hasProductChanged, updateProductSyncCache, createDataHash } from './syncCache';
import { getPrioritizedProducts } from './priorityStrategy';
import { getNhanhProductById, getNhanhApiSettings, extractInventoryData, extractPriceData } from './nhanh';
import { getShopifyApiSettings, getShopifyProduct as getShopifyProductFromAPI, updateInventoryLevel, updateVariant, getShopifyVariants } from './shopify';
import { withLock } from './locker';
import { markProductError, markProductSuccess, markProductSkipped } from './db-utils';
import { withRetry, RetryOptions } from './retry-utils';
import { executeWithCircuitBreaker, CircuitBreaker } from './circuit-breaker';

// Khởi tạo Circuit Breakers cho từng API
const shopifyCircuit = CircuitBreaker.getInstance('shopify-api', {
  failureThreshold: 5,          // 5 lỗi liên tiếp
  resetTimeout: 30000,          // 30 giây
  halfOpenSuccessThreshold: 2,  // 2 lần thành công để đóng lại
  timeoutDuration: 15000,       // 15 giây timeout
  onCircuitOpen: (metrics) => {
    console.error(`[CIRCUIT BREAKER] Shopify API circuit đã mở. Metrics:`, metrics);
  },
  onCircuitClose: () => {
    console.info(`[CIRCUIT BREAKER] Shopify API circuit đã đóng lại, kết nối đã ổn định.`);
  }
});

const nhanhCircuit = CircuitBreaker.getInstance('nhanh-api', {
  failureThreshold: 5,          // 5 lỗi liên tiếp
  resetTimeout: 60000,          // 60 giây
  halfOpenSuccessThreshold: 3,  // 3 lần thành công để đóng lại
  timeoutDuration: 20000,       // 20 giây timeout
  onCircuitOpen: (metrics) => {
    console.error(`[CIRCUIT BREAKER] Nhanh.vn API circuit đã mở. Metrics:`, metrics);
  },
  onCircuitClose: () => {
    console.info(`[CIRCUIT BREAKER] Nhanh.vn API circuit đã đóng lại, kết nối đã ổn định.`);
  }
});

// Khởi tạo Prisma Client
const prisma = new PrismaClient();

// Khởi tạo metrics chung
export const syncMetrics = new PerformanceMetrics();

// Create a default export object with all the functions
const syncService = {
  getNhanhData: async function(nhanhId: string, settings: any) {
    const NHANH_APP_ID = settings.nhanh_app_id;
    const NHANH_BUSINESS_ID = settings.nhanh_business_id;
    const NHANH_API_KEY = settings.nhanh_api_key;

    // Áp dụng rate limiting cho Nhanh API
    await NhanhRateLimiter.getInstance().throttle();
    
    // Sử dụng circuit breaker để thực hiện API call
    return await executeWithCircuitBreaker(
      'nhanh-api',
      async () => {
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
            'data': JSON.stringify({ 'id': nhanhId })
          })
        });

        if (!response.ok) {
          const errorMessage = `Lỗi kết nối đến Nhanh.vn: ${response.status}`;
          console.error(`[Nhanh.vn API] ${errorMessage}`);
          throw new Error(errorMessage);
        }

        // Xử lý response
        const data = await response.json();
        
        // Cập nhật thông tin rate limit
        NhanhRateLimiter.getInstance().updateLimitFromResponse(response.headers);
        
        return data;
      },
      undefined, // dùng cấu hình mặc định của circuit
      async (error) => {
        // Fallback khi circuit mở - trả về lỗi cụ thể
        console.error(`[Circuit Breaker] Không thể kết nối Nhanh.vn API: ${error.message}`);
        throw new Error(`Dịch vụ Nhanh.vn tạm thời không khả dụng: ${error.message}`);
      }
    );
  },

  sleep: function(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  callShopifyAPI: async function(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    // Lấy instance Shopify rate limiter
    const shopifyLimiter = ShopifyRateLimiter.getInstance();
    
    // Áp dụng rate limiting trước khi gọi API
    await shopifyLimiter.throttle();
    
    const startTime = Date.now();
    
    // Cấu hình retry
    const retryOptions: Partial<RetryOptions> = {
      maxRetries: maxRetries,
      baseDelay: 1000,
      maxDelay: 30000,
      factor: 2,
      jitter: true,
      logPrefix: '[Shopify API]',
      onRetry: (attempt, delay, error) => {
        // Ghi nhận lỗi API
        syncMetrics.recordApiCall(Date.now() - startTime, true);
        console.log(`[Shopify API] Thử lại lần ${attempt} sau ${Math.round(delay)}ms: ${error.message}`);
      }
    };
    
    // Sử dụng circuit breaker kết hợp với retry
    const response = await executeWithCircuitBreaker(
      'shopify-api',
      async () => {
        // Sử dụng withRetry từ retry-utils, không dùng lại phần thực thi API
        return await withRetry(async () => {
          const response = await fetch(url, options);
          
          // Ghi nhận API call vào metrics
          const callDuration = Date.now() - startTime;
          syncMetrics.recordApiCall(callDuration);
          
          // Cập nhật thông tin rate limit từ headers
          shopifyLimiter.updateLimitFromResponse(response.headers);
          
          // Xử lý các trường hợp lỗi cụ thể
          if (response.status === 429) { // Rate limited
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            const error = new Error(`Rate limited, đợi ${retryAfter} giây và thử lại`);
            (error as any).status = 429;
            (error as any).headers = response.headers;
            throw error;
          } else if (response.status >= 500) { // Lỗi server
            const error = new Error(`Lỗi server ${response.status}`);
            (error as any).status = response.status;
            throw error;
          }
          
          return response;
        }, retryOptions);
      },
      undefined, // dùng cấu hình mặc định của circuit
      async (error) => {
        // Fallback khi circuit mở - trả về lỗi cụ thể
        console.error(`[Circuit Breaker] Không thể kết nối Shopify API: ${error.message}`);
        throw new Error(`Dịch vụ Shopify tạm thời không khả dụng: ${error.message}`);
      }
    );
    
    return response;
  },

  getShopifyProduct: async function(shopifyId: string, settings: any) {
    const SHOPIFY_STORE = settings.shopify_store;
    const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
    
    // Log để debug
    console.log(`[API] Đang lấy thông tin biến thể Shopify, Variant ID: ${shopifyId}`);
    
    // Kiểm tra tính hợp lệ của tham số
    if (!shopifyId) {
      throw new Error('Shopify ID không được để trống');
    }
    
    if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Thiếu cấu hình Shopify (store hoặc access token)');
    }
    
    try {
      // Sử dụng endpoint variant thay vì product
      const variantResponse = await syncService.callShopifyAPI(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/variants/${shopifyId}.json`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!variantResponse.ok) {
        if (variantResponse.status === 404) {
          throw new Error(`Biến thể ${shopifyId} không tồn tại trên Shopify`);
        }
        const errorText = await variantResponse.text();
        throw new Error(`Lỗi API Shopify: ${variantResponse.status} - ${errorText}`);
      }
      
      const variantData = await variantResponse.json();
      
      // Kiểm tra dữ liệu trả về
      if (!variantData || !variantData.variant) {
        throw new Error(`Không thể lấy dữ liệu biến thể Shopify (ID: ${shopifyId})`);
      }
      
      // Log thành công
      console.log(`[API] Đã lấy thông tin biến thể Shopify thành công, ID: ${shopifyId}, Product ID: ${variantData.variant.product_id}`);
      
      return variantData.variant;
    } catch (error: any) {
      console.error(`[API ERROR] Lỗi khi lấy thông tin Shopify (Variant ID: ${shopifyId}):`, error.message);
      throw error;
    }
  },

  syncInventory: async function(product: any, nhanhData: any, settings: any, username: string) {
    // Sử dụng withLock để bảo vệ quá trình đồng bộ tồn kho
    const lockResult = await withLock(
      product.id,
      async () => {
        try {
          // Kiểm tra xem sản phẩm có thay đổi không
          const productChanged = await hasProductChanged(product.id, nhanhData);
          
          if (!productChanged) {
            // Sử dụng transaction để cập nhật sản phẩm + log
            const details = {
              reason: 'Không có thay đổi thực sự',
              productId: product.id,
              timestamp: new Date().toISOString()
            };
            
            await markProductSkipped(
              product.id,
              details,
              'Không có thay đổi thực sự',
              username,
              'sync_inventory'
            );
            
            return { 
              skipped: true, 
              reason: 'Không có thay đổi thực sự', 
              updated: false 
            };
          }
          
          // Lấy thông tin sản phẩm từ nhanhData
          const nhanhId = nhanhData.idNhanh || '';
          if (!nhanhId) {
            throw new Error('Không tìm thấy ID Nhanh.vn');
          }
          
          // Lấy thông tin biến thể từ Shopify
          let variantData;
          try {
            variantData = await syncService.getShopifyProduct(product.shopifyId, settings);
          } catch (error: any) {
            console.error(`[ERROR] Không thể lấy thông tin từ Shopify cho biến thể ${product.shopifyId}:`, error.message);
            
            // Sử dụng transaction để cập nhật lỗi
            await markProductError(
              product.id,
              `Không thể lấy thông tin biến thể: ${error.message}`,
              username,
              'sync_inventory'
            );
            
            throw new Error(`Không thể lấy thông tin biến thể: ${error.message}`);
          }
          
          if (!variantData || !variantData.inventory_item_id) {
            const errorMsg = !variantData ? 'Biến thể không tồn tại' : 'Biến thể không có inventory_item_id';
            console.error(`[ERROR] ${errorMsg} cho ${product.shopifyId}`);
            
            // Sử dụng transaction để cập nhật lỗi
            await markProductError(
              product.id,
              errorMsg,
              username,
              'sync_inventory'
            );
            
            throw new Error(errorMsg);
          }
          
          const inventoryItemId = variantData.inventory_item_id;
          
          // Cấu hình Shopify từ settings
          const SHOPIFY_STORE = settings.shopify_store;
          const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
          const SHOPIFY_LOCATION_ID = settings.shopify_location_id;
          
          // Lấy tồn kho mới nhất từ Nhanh.vn
          const nhanhResponse = await syncService.getNhanhData(nhanhId, settings);

          if (nhanhResponse.code !== 1) {
            console.error(`[ERROR] Lỗi từ API Nhanh.vn:`, nhanhResponse);
            
            // Sử dụng transaction để cập nhật lỗi
            await markProductError(
              product.id,
              `Lỗi từ API Nhanh.vn: ${nhanhResponse.messages || 'Không xác định'}`,
              username,
              'sync_inventory'
            );
            
            throw new Error(`Lỗi từ API Nhanh.vn: ${nhanhResponse.messages || 'Không xác định'}`);
          }

          // Xử lý dữ liệu để lấy số lượng tồn kho
          let inventoryQuantity = 0;
          let productData = null;

          if (nhanhResponse.data && nhanhResponse.data.products) {
            const products = nhanhResponse.data.products;
            
            // Tìm sản phẩm theo ID
            if (products[nhanhId]) {
              productData = products[nhanhId];
            } else {
              // Nếu không tìm thấy theo ID chính xác, kiểm tra tất cả sản phẩm
              for (const prodId in products) {
                if (products[prodId] && String(products[prodId].idNhanh) === nhanhId) {
                  productData = products[prodId];
                  break;
                }
              }
            }

            if (!productData && Object.keys(products).length > 0) {
              productData = products[Object.keys(products)[0]]; // Lấy sản phẩm đầu tiên nếu không tìm thấy
            }

            if (productData) {
              const inventory = productData.inventory || {};
              inventoryQuantity = inventory.remain || 0;
              
              // Kiểm tra xem có dữ liệu kho cụ thể không
              if (inventory.depots && inventory.depots['175080']) {
                const depot = inventory.depots['175080'];
                if (depot.available !== undefined) {
                  inventoryQuantity = depot.available;
                }
              }
              
              // Cập nhật dữ liệu Nhanh.vn mới nhất vào cơ sở dữ liệu
              await prisma.productMapping.update({
                where: { id: product.id },
                data: {
                  nhanhData: JSON.stringify(productData)
                }
              });
            }
          } else if (nhanhResponse.data && nhanhResponse.data.inventory) {
            // Trường hợp API trả về dữ liệu inventory trực tiếp
            const inventory = nhanhResponse.data.inventory;
            inventoryQuantity = inventory.remain || 0;
          }
          
          // Kiểm tra tồn kho hiện tại trên Shopify
          const currentInventoryResponse = await syncService.callShopifyAPI(
            `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${SHOPIFY_LOCATION_ID}`,
            {
              method: 'GET',
              headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (currentInventoryResponse.ok) {
            const inventoryData = await currentInventoryResponse.json();
            if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
              const currentQuantity = inventoryData.inventory_levels[0].available;
              
              // Chỉ cập nhật nếu tồn kho đã thay đổi
              if (currentQuantity === inventoryQuantity) {
                console.log(`[API] Bỏ qua đồng bộ tồn kho cho Variant ID ${product.shopifyId} - tồn kho không thay đổi (${currentQuantity})`);
                
                // Sử dụng transaction để cập nhật product + log
                const details = {
                  shopify: {
                    variant_id: product.shopifyId,
                    product_id: variantData.product_id,
                    inventory_item_id: inventoryItemId,
                    inventory: currentQuantity
                  },
                  nhanh: {
                    id: nhanhId,
                    inventory: inventoryQuantity
                  }
                };
                
                await markProductSkipped(
                  product.id,
                  details,
                  `Bỏ qua đồng bộ tồn kho: ${inventoryQuantity} (không thay đổi)`,
                  username,
                  'sync_inventory'
                );
                
                // Sau khi đồng bộ thành công, cập nhật cache
                await updateProductSyncCache(product.id, createDataHash(nhanhData), product.shopifyId);
                
                return { success: true, skipped: true, inventoryQuantity };
              }
            }
          }
          
          console.log(`[API] Đồng bộ tồn kho cho Variant ID ${product.shopifyId}, Số lượng: ${inventoryQuantity}`);
          
          // Gọi API Shopify để cập nhật tồn kho với xử lý retry
          const response = await syncService.callShopifyAPI(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            },
            body: JSON.stringify({
              'location_id': SHOPIFY_LOCATION_ID,
              'inventory_item_id': inventoryItemId,
              'available': inventoryQuantity
            })
          });
          
          if (!response.ok) {
            const errorData = await response.text();
            const errorMsg = `Lỗi API Shopify: ${response.status} - ${errorData}`;
            
            // Sử dụng transaction để cập nhật lỗi
            await markProductError(
              product.id,
              errorMsg,
              username,
              'sync_inventory'
            );
            
            throw new Error(errorMsg);
          }
          
          // Sử dụng transaction để cập nhật thành công
          const syncDetails = {
            shopify: {
              variant_id: product.shopifyId,
              product_id: variantData.product_id,
              inventory_item_id: inventoryItemId,
              inventory: inventoryQuantity
            },
            nhanh: {
              id: nhanhId,
              inventory: inventoryQuantity
            },
            productName: nhanhData.name || `Biến thể #${product.shopifyId}`
          };
          
          await markProductSuccess(
            product.id,
            syncDetails,
            `Đã đồng bộ tồn kho: ${inventoryQuantity}`,
            username,
            'sync_inventory'
          );
          
          // Sau khi đồng bộ thành công, cập nhật cache
          await updateProductSyncCache(product.id, createDataHash(nhanhData), product.shopifyId);
          
          return { success: true, inventoryQuantity };
        } catch (error: any) {
          console.error(`[ERROR] Lỗi khi đồng bộ tồn kho cho sản phẩm ID: ${product.id}:`, error.message);
          throw error;
        }
      },
      30, // thời gian khóa 30 giây
      true // bỏ qua nếu đã bị khóa
    );

    // Xử lý kết quả từ withLock
    if (lockResult.skipped) {
      console.log(`[LOCK] Bỏ qua đồng bộ sản phẩm ID: ${product.id} - đang được xử lý ở process khác`);
      return { 
        skipped: true, 
        reason: 'Sản phẩm đang được đồng bộ ở process khác', 
        updated: false 
      };
    }

    if (lockResult.error) {
      console.error(`[LOCK_ERROR] Lỗi trong quá trình đồng bộ có khóa:`, lockResult.error);
      throw lockResult.error;
    }

    return lockResult.result;
  },

  syncPrice: async function(
    product: { id: number; shopifyId: string | undefined; [key: string]: any },
    nhanhData: { idNhanh?: string; [key: string]: any },
    settings: { [key: string]: string },
    username: string
  ): Promise<{ success: boolean; price?: number; compareAtPrice?: number; skipped?: boolean; error?: string }> {
    // Thêm log để debug
    console.log('[SYNC DEBUG] syncPrice called for product ID:', product.id, 'variantId:', product.shopifyId);
    
    try {
      // Lấy thông tin sản phẩm từ nhanhData
      const nhanhId = nhanhData.idNhanh || '';
      if (!nhanhId) {
        throw new Error('Không tìm thấy ID Nhanh.vn');
      }
      
      // Lấy thông tin biến thể từ Shopify - biến thể ID đã được lưu trong shopifyId
      let variantData;
      try {
        console.log('[API] Đang lấy thông tin biến thể Shopify cho sản phẩm', product.id, 'variant ID:', product.shopifyId);
        console.log('[API DEBUG] getShopifyProduct called with ID:', product.shopifyId, 'settings:', !!settings, 'store:', settings.shopify_store);
        
        // Kiểm tra shopifyId có tồn tại không
        if (!product.shopifyId) {
          throw new Error('Không tìm thấy shopifyId cho sản phẩm');
        }
        
        variantData = await syncService.getShopifyProduct(product.shopifyId, settings);
      } catch (error: any) {
        console.error(`[ERROR] Không thể lấy thông tin từ Shopify cho biến thể ${product.shopifyId}:`, error.message);
        throw new Error(`Không thể lấy thông tin biến thể: ${error.message}`);
      }
      
      if (!variantData) {
        console.error(`[ERROR] Biến thể ${product.shopifyId} không tồn tại`);
        throw new Error('Biến thể không tồn tại');
      }
      
      const variantId = variantData.id;
      const productId = variantData.product_id;
      
      // Lấy giá hiện tại từ Shopify
      const currentPrice = parseFloat(variantData.price) || 0;
      const currentCompareAtPrice = parseFloat(variantData.compare_at_price) || 0;
      
      // Cấu hình Shopify từ settings
      const SHOPIFY_STORE = settings.shopify_store;
      const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
      
      // Lấy giá mới nhất từ Nhanh.vn
      const nhanhResponse = await syncService.getNhanhData(nhanhId, settings);

      if (nhanhResponse.code !== 1) {
        console.error(`[ERROR] Lỗi từ API Nhanh.vn:`, nhanhResponse);
        throw new Error(`Lỗi từ API Nhanh.vn: ${nhanhResponse.messages || 'Không xác định'}`);
      }

      // Xử lý dữ liệu để lấy giá
      let price = 0;
      let compareAtPrice = 0;
      let productData = null;

      if (nhanhResponse.data && nhanhResponse.data.products) {
        const products = nhanhResponse.data.products;
        
        // Tìm sản phẩm theo ID
        if (products[nhanhId]) {
          productData = products[nhanhId];
        } else {
          // Nếu không tìm thấy theo ID chính xác, kiểm tra tất cả sản phẩm
          for (const prodId in products) {
            if (products[prodId] && String(products[prodId].idNhanh) === nhanhId) {
              productData = products[prodId];
              break;
            }
          }
        }

        if (!productData && Object.keys(products).length > 0) {
          productData = products[Object.keys(products)[0]]; // Lấy sản phẩm đầu tiên nếu không tìm thấy
        }

        if (productData) {
          // Lấy giá từ Nhanh.vn
          price = productData.price || 0;
          compareAtPrice = productData.priceOriginal || productData.importPrice || 0;
          
          // Nếu giá gốc thấp hơn giá bán, không sử dụng
          if (compareAtPrice <= price) {
            compareAtPrice = 0;
          }
          
          // Cập nhật dữ liệu Nhanh.vn mới nhất vào cơ sở dữ liệu
          await prisma.productMapping.update({
            where: { id: product.id },
            data: {
              nhanhData: JSON.stringify(productData)
            }
          });
        }
      }
      
      // Kiểm tra xem giá có thay đổi không
      if (Math.abs(currentPrice - price) < 0.01 && 
          ((compareAtPrice === 0 && currentCompareAtPrice === 0) || 
           Math.abs(currentCompareAtPrice - compareAtPrice) < 0.01)) {
        
        console.log(`[API] Bỏ qua đồng bộ giá cho Variant ID ${product.shopifyId} - giá không thay đổi (${price})`);
        
        // Cập nhật trạng thái thành công
        await prisma.productMapping.update({
          where: { id: product.id },
          data: {
            status: 'success',
            errorMsg: null
          }
        });
        
        // Tạo bản ghi SyncLog bỏ qua
        await prisma.syncLog.create({
          data: {
            productMappingId: product.id,
            action: 'sync_price',
            status: 'skipped',
            message: `Bỏ qua đồng bộ giá: ${price.toLocaleString()} (không thay đổi)`,
            details: JSON.stringify({
              shopify: {
                variant_id: variantId,
                product_id: productId,
                current_price: currentPrice,
                current_compare_at_price: currentCompareAtPrice,
                new_price: price,
                new_compare_at_price: compareAtPrice
              },
              nhanh: {
                id: nhanhId,
                price: price,
                priceOriginal: compareAtPrice
              }
            }),
            createdBy: username
          }
        });
        
        return { success: true, skipped: true, price, compareAtPrice };
      }
      
      console.log(`[API] Đồng bộ giá cho Variant ID ${product.shopifyId}, Giá: ${price}, Giá gốc: ${compareAtPrice}`);
      
      // Gọi API Shopify để cập nhật giá - lưu ý shopifyId đã là variant ID
      const response = await syncService.callShopifyAPI(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/variants/${variantId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          'variant': {
            'id': variantId,
            'price': price.toString(),
            'compare_at_price': compareAtPrice > 0 ? compareAtPrice.toString() : null
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Lỗi API Shopify: ${response.status} - ${errorData}`);
      }
      
      // Cập nhật trạng thái thành công
      await prisma.productMapping.update({
        where: { id: product.id },
        data: {
          status: 'success',
          errorMsg: null
        }
      });
      
      // Tạo bản ghi SyncLog
      const syncDetails = {
        shopify: {
          variant_id: variantId,
          product_id: productId,
          old_price: currentPrice,
          old_compare_at_price: currentCompareAtPrice,
          new_price: price,
          new_compare_at_price: compareAtPrice
        },
        nhanh: {
          id: nhanhId,
          price: price,
          priceOriginal: compareAtPrice
        },
        productName: nhanhData.name || `Biến thể #${product.shopifyId}`
      };
      
      await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: 'sync_price',
          status: 'success',
          message: `Đã đồng bộ giá: ${price.toLocaleString()}`,
          details: JSON.stringify(syncDetails),
          createdBy: username
        }
      });
      
      return { success: true, price, compareAtPrice };
    } catch (error: any) {
      // Xử lý lỗi và ghi log
      console.error(`[Error syncPrice] ${error.message}`);
      
      await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: 'sync_price',
          status: 'error',
          message: error.message || 'Lỗi không xác định',
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
          createdBy: username
        }
      });
      
      throw error;
    }
  },

  batchSyncInventory: async function(products: any[], settings: any, username: string) {
    // Khởi tạo đo hiệu suất
    const metrics = new PerformanceMetrics();
    metrics.start();
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    try {
      // Sắp xếp sản phẩm theo mức độ ưu tiên
      const prioritizedProducts = await getPrioritizedProducts(products);
      
      console.log(`[SyncService] Bắt đầu đồng bộ ${prioritizedProducts.length} sản phẩm theo thứ tự ưu tiên`);
      
      // Xác định kích thước batch dựa trên số lượng sản phẩm
      const BATCH_SIZE = syncService.determineBatchSize(prioritizedProducts.length);
      console.log(`[SyncService] Sử dụng kích thước batch: ${BATCH_SIZE}`);
      
      // Chia thành các batch để xử lý
      const batches = [];
      for (let i = 0; i < prioritizedProducts.length; i += BATCH_SIZE) {
        batches.push(prioritizedProducts.slice(i, i + BATCH_SIZE));
      }
      
      // Xử lý từng batch
      for (const batch of batches) {
        for (const product of batch) {
          try {
            // Lấy dữ liệu Nhanh.vn
            let nhanhData = null;
            if (product.nhanhData) {
              try {
                nhanhData = typeof product.nhanhData === 'string' 
                  ? JSON.parse(product.nhanhData) 
                  : product.nhanhData;
              } catch (parseError: any) {
                console.error(`[SyncService] Lỗi parse nhanhData: ${parseError.message}`);
              }
            }
            
            // Kiểm tra ID Nhanh.vn
            if (!product.externalId && (!nhanhData || !nhanhData.idNhanh)) {
              console.log(`[SyncService] Bỏ qua sản phẩm ${product.id} - không có ID Nhanh.vn`);
              skippedCount++;
              continue;
            }
            
            // Đồng bộ sản phẩm
            const result = await syncService.syncInventory(product, nhanhData, settings, username);
            
            if (result && 'updated' in result && result.updated) {
              successCount++;
            } else if (result && 'skipped' in result && result.skipped) {
              skippedCount++;
            } else if (result && 'success' in result && result.success === false) {
              errorCount++;
            } else if (result && 'success' in result && result.success === true) {
              successCount++;
            }
          } catch (error) {
            console.error(`[SyncService] Lỗi khi đồng bộ sản phẩm ${product.id}:`, error);
            errorCount++;
          }
        }
        
        // Đợi một chút giữa các batch để tránh quá tải API
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Kết thúc đo hiệu suất
      const performanceStats = metrics.end();
      
      return {
        success: successCount,
        error: errorCount,
        skipped: skippedCount,
        performance: performanceStats
      };
    } catch (error) {
      console.error(`[SyncService] Lỗi khi đồng bộ hàng loạt:`, error);
      return { 
        success: successCount, 
        error: errorCount, 
        skipped: skippedCount 
      };
    }
  },

  determineBatchSize: function(totalProducts: number): number {
    // Kích thước batch cơ bản dựa trên tổng số sản phẩm
    let batchSize = totalProducts > 1000 ? 25 : (totalProducts > 500 ? 20 : 15);
    
    // Điều chỉnh dựa trên tải hệ thống nếu có thông tin
    try {
      const systemLoad = 0; // Trong tương lai có thể bổ sung tính năng đo tải hệ thống
      
      if (systemLoad > 80) {
        // Giảm batch size khi hệ thống có tải cao
        batchSize = Math.max(5, Math.floor(batchSize * 0.7));
      } else if (systemLoad < 30) {
        // Tăng batch size khi hệ thống có tải thấp
        batchSize = Math.min(40, Math.floor(batchSize * 1.3));
      }
    } catch (error) {
      // Bỏ qua lỗi và sử dụng kích thước mặc định
    }
    
    return batchSize;
  },

  getApiSettings: async function() {
    const nhanhSettings = await getNhanhApiSettings();
    const shopifySettings = await getShopifyApiSettings();
    
    return {
      ...nhanhSettings,
      ...shopifySettings
    };
  }
};

export default syncService; 