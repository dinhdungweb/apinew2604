import { PrismaClient } from '@prisma/client';
import { syncQueue } from './queue';
import { Worker } from 'worker_threads';
import { workerData, parentPort } from 'worker_threads';
import { RateLimiter } from './rateLimiter';
import prisma from './prisma';
import { markProductError, markProductSuccess, markProductSkipped } from './db-utils';
import { withRetry, RetryOptions } from './retry-utils';

// Khởi tạo Prisma client
const prismaClient = new PrismaClient();

// Định nghĩa hàm gọi API Shopify
async function callShopifyAPI(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  // Cấu hình retry
  const retryOptions: Partial<RetryOptions> = {
    maxRetries: maxRetries,
    baseDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
    logPrefix: '[Worker API]',
    onRetry: (attempt, delay, error) => {
      console.log(`[Worker API] Thử lại lần ${attempt} sau ${Math.round(delay)}ms: ${error.message}`);
    }
  };
  
  return await withRetry(async () => {
    const response = await fetch(url, options);
    
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
}

// Định nghĩa hàm lấy sản phẩm Shopify
async function getShopifyProduct(shopifyId: string, settings: any) {
  console.log(`[DIRECT] getShopifyProduct được gọi với ID ${shopifyId}`);
  
  const SHOPIFY_STORE = settings.shopify_store;
  const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
  
  if (!shopifyId) {
    throw new Error('Shopify ID không được để trống');
  }
  
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Thiếu cấu hình Shopify (store hoặc access token)');
  }
  
  try {
    // Sử dụng endpoint variant thay vì product
    const variantResponse = await callShopifyAPI(
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
    
    console.log(`[DIRECT] Đã lấy thành công thông tin biến thể ${shopifyId}`);
    
    return variantData.variant;
  } catch (error: any) {
    console.error(`[DIRECT] Lỗi khi lấy thông tin Shopify:`, error.message);
    throw error;
  }
}

// Định nghĩa hàm lấy dữ liệu từ Nhanh.vn
async function getNhanhData(nhanhId: string, settings: any) {
  console.log(`[DIRECT] getNhanhData được gọi với ID ${nhanhId}`);
  
  const NHANH_APP_ID = settings.nhanh_app_id;
  const NHANH_BUSINESS_ID = settings.nhanh_business_id;
  const NHANH_API_KEY = settings.nhanh_api_key;

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
    throw new Error(`Lỗi kết nối đến Nhanh.vn: ${response.status}`);
  }

  return await response.json();
}

// Định nghĩa hàm đồng bộ tồn kho
async function syncInventory(
  product: { id: number; shopifyId: string | undefined; [key: string]: any },
  nhanhData: { idNhanh: string; [key: string]: any },
  settings: { [key: string]: string },
  username: string
) {
  console.log(`[DIRECT] syncInventory được gọi cho sản phẩm ${product.id}`);
  
  try {
    // Lấy thông tin sản phẩm từ nhanhData
    const nhanhId = nhanhData.idNhanh || '';
    if (!nhanhId) {
      throw new Error('Không tìm thấy ID Nhanh.vn');
    }
    
    // Lấy thông tin biến thể từ Shopify
    if (!product.shopifyId) {
      throw new Error('Không tìm thấy shopifyId cho sản phẩm');
    }
    
    let variantData;
    try {
      variantData = await getShopifyProduct(product.shopifyId, settings);
    } catch (error: any) {
      console.error(`[ERROR] Không thể lấy thông tin từ Shopify cho biến thể ${product.shopifyId}:`, error.message);
      throw new Error(`Không thể lấy thông tin biến thể: ${error.message}`);
    }
    
    if (!variantData || !variantData.inventory_item_id) {
      console.error(`[ERROR] Biến thể ${product.shopifyId} không có inventory_item_id`);
      throw new Error('Biến thể không có inventory_item_id');
    }
    
    // Tạo log thành công
    await prismaClient.syncLog.create({
      data: {
        productMappingId: product.id,
        action: 'sync_inventory',
        status: 'success',
        message: 'Đồng bộ tồn kho thành công',
        details: JSON.stringify({
          shopifyId: product.shopifyId,
          nhanhId,
          inventory_item_id: variantData.inventory_item_id
        }),
        createdBy: username
      }
    });
    
    return { success: true };
  } catch (error: any) {
    console.error(`[DIRECT] Lỗi khi đồng bộ tồn kho:`, error.message);
    
    // Ghi log lỗi
    await prismaClient.syncLog.create({
      data: {
        productMappingId: product.id,
        action: 'sync_inventory',
        status: 'error',
        message: error.message || 'Lỗi không xác định',
        details: JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
        createdBy: username
      }
    });
    
    throw error;
  }
}

// Định nghĩa hàm đồng bộ giá
async function syncPrice(
  product: { id: number; shopifyId: string | undefined; [key: string]: any },
  nhanhData: { idNhanh: string; [key: string]: any },
  settings: { [key: string]: string },
  username: string
) {
  console.log(`[DIRECT] syncPrice được gọi cho sản phẩm ${product.id} với shopifyId ${product.shopifyId}`);
  
  try {
    // Lấy thông tin sản phẩm từ nhanhData
    const nhanhId = nhanhData.idNhanh || '';
    if (!nhanhId) {
      throw new Error('Không tìm thấy ID Nhanh.vn');
    }
    
    // Lấy thông tin biến thể từ Shopify
    if (!product.shopifyId) {
      throw new Error('Không tìm thấy shopifyId cho sản phẩm');
    }
    
    let variantData;
    try {
      variantData = await getShopifyProduct(product.shopifyId, settings);
    } catch (error: any) {
      console.error(`[ERROR] Không thể lấy thông tin từ Shopify cho biến thể ${product.shopifyId}:`, error.message);
      throw new Error(`Không thể lấy thông tin biến thể: ${error.message}`);
    }
    
    if (!variantData) {
      throw new Error('Không tìm thấy biến thể trên Shopify');
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
    const nhanhResponse = await getNhanhData(nhanhId, settings);

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
        await prismaClient.productMapping.update({
          where: { id: product.id },
          data: {
            nhanhData: JSON.stringify(productData)
          }
        });
      }
    }
    
    // Gọi API Shopify để cập nhật giá
    console.log(`[DIRECT] Đồng bộ giá cho Variant ID ${product.shopifyId}, Giá: ${price}, Giá gốc: ${compareAtPrice}`);
    
    const response = await callShopifyAPI(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/variants/${variantId}.json`, {
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
    await prismaClient.productMapping.update({
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
    
    await prismaClient.syncLog.create({
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
    console.error(`[DIRECT] Lỗi khi đồng bộ giá:`, error.message);
    
    // Ghi log lỗi
    await prismaClient.syncLog.create({
      data: {
        productMappingId: product.id,
        action: 'sync_price',
        status: 'error',
        message: error.message || 'Lỗi không xác định',
        details: JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
        createdBy: username
      }
    });
    
    // Cập nhật trạng thái sản phẩm
    await prismaClient.productMapping.update({
      where: { id: product.id },
      data: {
        status: 'error',
        errorMsg: error.message || 'Lỗi không xác định'
      }
    });
    
    throw error;
  }
}

// Biến kiểm tra đã khởi tạo
let isSyncQueueInitialized = false;

/**
 * Khởi tạo các processor cho queue
 */
export function initSyncProcessors() {
  // Log để kiểm tra
  console.log('[Queue] Khởi tạo processor với các hàm được định nghĩa trực tiếp');

  try {
    // Kiểm tra đơn giản nếu đã khởi tạo
    if (isSyncQueueInitialized) {
      console.log('[Queue] Đã tồn tại processor, bỏ qua việc khởi tạo lại');
      return;
    }
    
    // Đánh dấu là đã khởi tạo
    isSyncQueueInitialized = true;

    // Xử lý công việc đồng bộ sản phẩm
    syncQueue.process('sync-products', async (job) => {
      const { syncType, username, syncAllProducts, productIds, scheduledLogId } = job.data;
      
      console.log(`[Queue] Bắt đầu đồng bộ ${syncType}, người dùng: ${username}`);
      job.progress(0);
      
      try {
        // Lấy settings từ database
        const settingsData = await prismaClient.setting.findMany();
        const settings: Record<string, string> = {};
        settingsData.forEach(setting => {
          settings[setting.key] = setting.value;
        });
        
        // Tạo object settings với log để debug
        const configSettings = {
          shopify_access_token: settings.shopify_access_token || process.env.SHOPIFY_ACCESS_TOKEN || '',
          shopify_store: settings.shopify_store || process.env.SHOPIFY_STORE || '',
          shopify_location_id: settings.shopify_location_id || process.env.SHOPIFY_LOCATION_ID || '',
          nhanh_api_key: settings.nhanh_api_key || process.env.NHANH_API_KEY || '',
          nhanh_business_id: settings.nhanh_business_id || process.env.NHANH_BUSINESS_ID || '',
          nhanh_app_id: settings.nhanh_app_id || process.env.NHANH_APP_ID || '',
          sync_interval: settings.sync_interval || '30',
          sync_auto: settings.sync_auto || 'false'
        };
        
        // Log cấu hình để debug (ẩn các phần nhạy cảm)
        console.log(`[Queue] Cấu hình đồng bộ:`, {
          shopify_store: configSettings.shopify_store,
          shopify_location_id: configSettings.shopify_location_id,
          nhanh_business_id: configSettings.nhanh_business_id,
          nhanh_app_id: configSettings.nhanh_app_id,
          shopify_token_length: configSettings.shopify_access_token ? configSettings.shopify_access_token.length : 0,
          nhanh_token_length: configSettings.nhanh_api_key ? configSettings.nhanh_api_key.length : 0,
        });
        
        // Kiểm tra tính hợp lệ của cấu hình
        if (!configSettings.shopify_access_token || !configSettings.shopify_store) {
          throw new Error('Thiếu cấu hình Shopify - vui lòng kiểm tra cài đặt');
        }
        
        if (!configSettings.nhanh_api_key || !configSettings.nhanh_business_id) {
          throw new Error('Thiếu cấu hình Nhanh.vn - vui lòng kiểm tra cài đặt');
        }
        
        // Lấy danh sách sản phẩm cần đồng bộ
        let products;
        
        if (productIds && productIds.length > 0) {
          // Đồng bộ các sản phẩm cụ thể
          products = await prismaClient.productMapping.findMany({
            where: {
              id: { in: productIds }
            }
          });
        } else if (syncAllProducts) {
          // Đồng bộ tất cả sản phẩm
          products = await prismaClient.productMapping.findMany();
        } else {
          // Đồng bộ sản phẩm với status success, done, pending hoặc null
          products = await prismaClient.productMapping.findMany({
            where: {
              OR: [
                { status: 'success' },
                { status: 'done' },
                { status: 'pending' },
                { status: null }
              ]
            }
          });
        }
        
        // Log thông tin sản phẩm để debug
        console.log(`[Queue] Tìm thấy ${products.length} sản phẩm để đồng bộ. ID các sản phẩm:`, 
          products.slice(0, 5).map(p => `${p.id}:${p.shopifyId}`).join(', ') + 
          (products.length > 5 ? ` và ${products.length - 5} sản phẩm khác` : '')
        );
        
        // Tạo bản ghi đồng bộ nếu không có scheduledLogId
        let syncLog;
        if (scheduledLogId) {
          syncLog = await prismaClient.syncLog.findUnique({
            where: { id: scheduledLogId }
          });
          
          if (syncLog) {
            // Cập nhật log đã lên lịch
            await prismaClient.syncLog.update({
              where: { id: scheduledLogId },
              data: {
                status: 'running',
                message: `Đang đồng bộ ${syncType} cho ${products.length} sản phẩm`,
                details: JSON.stringify({
                  total: products.length,
                  syncType,
                  startTime: new Date()
                })
              }
            });
          }
        }
        
        if (!syncLog) {
          // Tạo log mới nếu không có hoặc không tìm thấy log đã lên lịch
          syncLog = await prismaClient.syncLog.create({
            data: {
              action: `sync_${syncType}`,
              status: 'running',
              message: `Đang đồng bộ ${syncType} cho ${products.length} sản phẩm`,
              details: JSON.stringify({
                total: products.length,
                syncType,
                startTime: new Date()
              }),
              createdBy: username
            }
          });
        }
        
        // Nếu không có sản phẩm nào
        if (products.length === 0) {
          await prismaClient.syncLog.update({
            where: { id: syncLog.id },
            data: {
              status: 'completed',
              message: 'Không có sản phẩm nào để đồng bộ'
            }
          });
          return { success: true, message: 'Không có sản phẩm nào để đồng bộ' };
        }
        
        // Số lượng sản phẩm mỗi lô - tăng kích thước batch để tối ưu hiệu suất
        const BATCH_SIZE = 8; // Tăng từ 2 lên 8
        const batchCount = Math.ceil(products.length / BATCH_SIZE);
        
        // Thống kê kết quả
        const stats = {
          total: products.length,
          success: 0,
          error: 0,
          skipped: 0
        };
        
        // Xử lý từng lô
        for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
          const startIdx = batchIndex * BATCH_SIZE;
          const endIdx = Math.min((batchIndex + 1) * BATCH_SIZE, products.length);
          const batch = products.slice(startIdx, endIdx);
          
          // Cập nhật tiến độ
          const progress = Math.round((batchIndex / batchCount) * 100);
          job.progress(progress);
          
          console.log(`[Queue] Đang xử lý lô ${batchIndex + 1}/${batchCount}, tiến độ: ${progress}%`);
          
          // Xử lý song song sản phẩm trong batch với Promise.all
          await Promise.all(batch.map(async (product) => {
            try {
              // Phân tích dữ liệu Nhanh.vn
              let nhanhData;
              try {
                nhanhData = JSON.parse(product.nhanhData);
                console.log(`[Queue] Sản phẩm ${product.id}, Shopify ID: ${product.shopifyId}, Nhanh ID: ${nhanhData.idNhanh || 'không xác định'}`);
              } catch (error) {
                console.error(`[ERROR] Không thể phân tích dữ liệu nhanhData cho sản phẩm ID=${product.id}`);
                stats.error++;
                return; // Skip this product and continue with others
              }
              
              // Chuẩn hóa shopifyId - loại bỏ prefix "gid://" nếu có
              let normalizedShopifyId = product.shopifyId;
              if (normalizedShopifyId && typeof normalizedShopifyId === 'string' && normalizedShopifyId.includes('gid://')) {
                const parts = normalizedShopifyId.split('/');
                normalizedShopifyId = parts.pop() || normalizedShopifyId;
              }
              
              const productWithNormalizedId = {
                ...product,
                shopifyId: normalizedShopifyId
              };
              
              // Xử lý song song các loại đồng bộ nếu cần (inventory và price)
              const syncTasks = [];
              
              if (syncType === 'all' || syncType === 'inventory') {
                console.log(`[Queue] Bắt đầu đồng bộ tồn kho cho sản phẩm ${product.id}`);
                syncTasks.push(syncInventory(productWithNormalizedId, nhanhData, configSettings, username));
              }
              
              if (syncType === 'all' || syncType === 'price') {
                console.log(`[Queue] Bắt đầu đồng bộ giá cho sản phẩm ${product.id}`);
                syncTasks.push(syncPrice(productWithNormalizedId, nhanhData, configSettings, username));
              }
              
              // Chờ tất cả các tác vụ đồng bộ hoàn thành
              const results = await Promise.all(syncTasks);
              
              // Xử lý kết quả đồng bộ và cập nhật cơ sở dữ liệu
              for (const result of results) {
                await processResult(product, result, username);
              }
              
              stats.success++;
            } catch (error: any) {
              console.error(`[Queue] Lỗi đồng bộ sản phẩm ${product.id} (Shopify: ${product.shopifyId}):`, error.message);
              stats.error++;
              
              // Cập nhật trạng thái sản phẩm nếu lỗi
              await prismaClient.productMapping.update({
                where: { id: product.id },
                data: {
                  status: 'error',
                  errorMsg: error.message || 'Lỗi không xác định'
                }
              });
            }
          }));
          
          // Chờ một chút trước khi xử lý lô tiếp theo - giảm thời gian chờ
          if (batchIndex < batchCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Giảm từ 2500ms xuống 1000ms
          }
          
          // Cập nhật log định kỳ với tiến độ hiện tại
          if (batchIndex % 2 === 0 || batchIndex === batchCount - 1) {
            await prismaClient.syncLog.update({
              where: { id: syncLog.id },
              data: {
                details: JSON.stringify({
                  ...JSON.parse(syncLog.details || '{}'),
                  stats: {
                    total: stats.total,
                    success: stats.success,
                    error: stats.error,
                    skipped: stats.skipped
                  },
                  progress,
                  currentBatch: batchIndex + 1,
                  totalBatches: batchCount
                })
              }
            });
          }
        }
        
        // Cập nhật trạng thái cuối cùng khi hoàn thành
        const endTime = new Date();
        const duration = endTime.getTime() - new Date(JSON.parse(syncLog.details || '{}').startTime || endTime).getTime();
        const durationInSeconds = Math.round(duration / 1000);
        
        await prismaClient.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'completed',
            message: `Hoàn thành đồng bộ, kết quả: ${stats.success}/${stats.total} thành công`,
            details: JSON.stringify({
              ...JSON.parse(syncLog.details || '{}'),
              stats,
              progress: 100,
              endTime: endTime.toISOString(),
              duration: durationInSeconds,
              syncType
            })
          }
        });
        
        console.log(`[Queue] Hoàn thành đồng bộ ${syncType}, kết quả: ${stats.success}/${stats.total} thành công, ${stats.error} lỗi, ${stats.skipped} bỏ qua`);
        
        return {
          success: true,
          stats,
          message: `Hoàn thành đồng bộ ${syncType}`
        };
      } catch (error: any) {
        console.error(`[ERROR] Lỗi khi xử lý đồng bộ:`, error.message);
        
        // Cập nhật log nếu có
        if (scheduledLogId) {
          await prismaClient.syncLog.update({
            where: { id: scheduledLogId },
            data: {
              status: 'failed',
              message: `Lỗi đồng bộ: ${error.message}`,
              details: JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
              })
            }
          });
        }
        
        throw error;
      }
    });
    
    console.log('[Queue] Đã khởi tạo sync processor với hàm syncPrice trực tiếp');
  } catch (error: any) {
    console.error(`[ERROR] Lỗi khi khởi tạo processor:`, error.message);
    throw error;
  }
}

// Xử lý kết quả đồng bộ và cập nhật cơ sở dữ liệu
export async function processResult(product: any, result: any, username: string = 'system') {
  try {
    if (!product || !product.id) {
      console.error('[Worker] Không thể xử lý kết quả: thiếu thông tin sản phẩm');
      return { success: false, error: 'Thiếu thông tin sản phẩm' };
    }

    if (result && result.success) {
      // Trường hợp đồng bộ thành công
      const details = {
        shopify: {
          id: product.shopifyId,
          inventory: result.inventoryQuantity
        },
        nhanh: {
          id: product.externalId,
          inventory: result.inventoryQuantity
        },
        timestamp: new Date().toISOString()
      };

      // Sử dụng transaction để cập nhật trạng thái và log
      await markProductSuccess(
        product.id,
        details,
        `Đồng bộ tồn kho thành công: ${result.inventoryQuantity || 0}`,
        username,
        'sync_inventory'
      );

      return { success: true, updated: true };
    } else if (result && result.skipped) {
      // Trường hợp bỏ qua đồng bộ
      const details = {
        reason: result.reason || 'Không có thay đổi',
        shopify: {
          id: product.shopifyId
        },
        nhanh: {
          id: product.externalId
        },
        timestamp: new Date().toISOString()
      };

      // Sử dụng transaction để cập nhật trạng thái và log
      await markProductSkipped(
        product.id,
        details,
        result.reason || 'Không có thay đổi',
        username,
        'sync_inventory'
      );

      return { success: true, skipped: true };
    } else {
      // Trường hợp lỗi
      const errorMessage = result && result.error ? result.error : 'Lỗi không xác định';
      
      // Sử dụng transaction để cập nhật trạng thái lỗi và log
      await markProductError(
        product.id,
        errorMessage,
        username,
        'sync_inventory'
      );

      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('[Worker] Lỗi khi xử lý kết quả:', error.message);
    
    // Trong trường hợp lỗi khi xử lý kết quả, vẫn cố gắng cập nhật trạng thái sản phẩm
    try {
      await markProductError(
        product.id,
        `Lỗi xử lý kết quả: ${error.message}`,
        username,
        'sync_error'
      );
    } catch (dbError: any) {
      console.error('[Worker] Không thể cập nhật lỗi vào database:', dbError.message);
    }
    
    return { success: false, error: `Lỗi xử lý kết quả: ${error.message}` };
  }
}

// Khởi tạo ngay khi module được load
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_NEXTJS_WORKER !== 'true') {
  console.log('[SyncWorker] Initializing sync processors in Next.js context');
  initSyncProcessors();
} else {
  console.log('[SyncWorker] Next.js worker disabled, using standalone worker instead');
} 