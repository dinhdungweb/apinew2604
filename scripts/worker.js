const { PrismaClient } = require('@prisma/client');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const cron = require('node-cron');
const { syncMetrics } = require('../src/lib/syncService');

// Khởi tạo Prisma client
const prisma = new PrismaClient();

// Lấy cấu hình concurrency từ biến môi trường
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

// Tạo kết nối Redis
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null
});

// Tách riêng các queue theo chức năng
const scheduledQueue = new Queue('scheduled-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

const inventorySyncQueue = new Queue('inventory-sync-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

const priceSyncQueue = new Queue('price-sync-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

// Biến theo dõi trạng thái worker
const workerStatus = {
  isRunning: false,
  startTime: null,
  lastCheckTime: null,
  pendingJobs: 0, 
  activeJobs: 0,
  completedJobs: 0,
  failedJobs: 0
};

// Biến theo dõi lỗi
let consecutiveErrors = 0;
const ERROR_THRESHOLD = 5; // Ngưỡng lỗi để gửi cảnh báo

// Hàm lấy cài đặt hệ thống
async function getSettings() {
  try {
    const settingsData = await prisma.setting.findMany();
    
    const settings = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    return settings;
  } catch (error) {
    console.error('[Worker] Lỗi khi lấy cài đặt:', error);
    // Trả về cài đặt mặc định nếu có lỗi
    return {
      sync_interval: '30',
      sync_auto: 'false'
    };
  }
}

// Hàm khởi tạo chương trình kiểm tra tác vụ đã lên lịch
function initScheduleChecker() {
  console.log('[Worker] Khởi tạo chương trình kiểm tra tác vụ đã lên lịch');
  
  // Chạy mỗi phút
  cron.schedule('* * * * *', async () => {
    // Giảm log thường xuyên bằng cách log một lần mỗi giờ
    const now = new Date();
    if (now.getMinutes() === 0) {
      console.log(`[Worker] Kiểm tra tác vụ đã lên lịch vào ${now.toLocaleString()}`);
    }
    
    try {
      await scheduledQueue.add('check-scheduled', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Worker] Lỗi khi thêm tác vụ kiểm tra:', error);
    }
  });
}

// Hàm cập nhật trạng thái worker
async function updateWorkerStatus() {
  workerStatus.lastCheckTime = new Date().toISOString();
  
  try {
    await prisma.setting.upsert({
      where: { key: 'worker_status' },
      update: { 
        value: JSON.stringify(workerStatus),
        updatedAt: new Date()
      },
      create: {
        key: 'worker_status',
        value: JSON.stringify(workerStatus),
        group: 'system'
      }
    });
  } catch (error) {
    console.error('[Worker] Lỗi khi cập nhật trạng thái worker:', error);
  }
}

// Tạo worker cho các tác vụ cần kiểm tra lịch
const scheduledTasksWorker = new Worker('scheduled-queue', async (job) => {
  if (job.name !== 'check-scheduled') return;
  
  // Giảm log thông thường, chỉ log lỗi
  // console.log('[Worker] Đang kiểm tra các tác vụ đã lên lịch');
  
  try {
    // Lấy thông tin cài đặt
    const settings = await getSettings();
    const autoSyncEnabled = settings.sync_auto === 'true';
    
    // Nếu tự động đồng bộ không được bật, dừng tại đây
    if (!autoSyncEnabled) {
      // Giảm log thường xuyên, chỉ để khi khởi động
      // console.log('[Worker] Tự động đồng bộ chưa được bật trong cài đặt');
      return { 
        success: true, 
        message: 'Tính năng tự động đồng bộ chưa được bật' 
      };
    }
    
    // Trước tiên, dọn dẹp các tác vụ bị treo
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const stuckProcessingTasks = await prisma.syncLog.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: fiveMinutesAgo
        }
      }
    });
    
    if (stuckProcessingTasks.length > 0) {
      console.log(`[Worker] Phát hiện ${stuckProcessingTasks.length} tác vụ bị treo, đang dọn dẹp...`);
      
      for (const task of stuckProcessingTasks) {
        await prisma.syncLog.update({
          where: { id: task.id },
          data: {
            status: 'error',
            message: `Tác vụ bị hủy do xử lý quá lâu (trên 5 phút)`
          }
        });
        // Giảm log chi tiết, chỉ log tổng số lượng
        // console.log(`[Worker] Đã dọn dẹp tác vụ #${task.id} bị treo`);
      }
    }
    
    // Lấy các log đã lên lịch và đến thời gian thực hiện
    let scheduledTasks = await prisma.syncLog.findMany({
      where: {
        action: { startsWith: 'schedule_' },
        status: 'scheduled'
      },
      orderBy: {
        createdAt: 'asc' // Xử lý các tác vụ cũ trước
      }
    });
    
    // Nếu không tìm thấy tác vụ đã lên lịch, kiểm tra các tác vụ sync_
    if (scheduledTasks.length === 0) {
      // Giảm log không cần thiết
      // console.log('[Worker] Không tìm thấy tác vụ đã lên lịch với tiền tố "schedule_"');
      // console.log('[Worker] Thử tìm các tác vụ đồng bộ có tiền tố "sync_"');
      
      // Sử dụng $queryRaw để xử lý đúng điều kiện NULL
      scheduledTasks = await prisma.$queryRaw`
        SELECT * FROM SyncLog 
        WHERE action LIKE 'sync\\_%' 
        AND (status = 'pending' OR status IS NULL)
        ORDER BY createdAt ASC
        LIMIT 5
      `;
    }
    
    // Chỉ log khi có tác vụ cần xử lý
    if (scheduledTasks.length > 0) {
      console.log(`[Worker] Tìm thấy ${scheduledTasks.length} tác vụ để xử lý`);
    }
    
    let executedCount = 0;
    
    // Cải tiến: Xử lý song song các tác vụ lên lịch
    const taskPromises = scheduledTasks.map(async (task) => {
      try {
        // Phân tích chi tiết tác vụ
        let syncType = 'all';
        if (task.action.startsWith('schedule_')) {
          syncType = task.action.replace('schedule_', '');
        } else if (task.action.startsWith('sync_')) {
          syncType = task.action.replace('sync_', '');
        }
        
        let details = {};
        try {
          details = task.details ? JSON.parse(task.details || '{}') : {};
        } catch (parseError) {
          console.error(`[Worker] Lỗi khi phân tích details của tác vụ #${task.id}:`, parseError);
          details = {};
        }
        
        // Kiểm tra xem đã đến thời gian thực hiện chưa
        const scheduledTime = details.scheduledTime ? new Date(details.scheduledTime) : null;
        
        // Với các tác vụ 'sync_', coi như đã đến thời gian thực hiện hoặc nếu thời gian lên lịch đã qua
        if (!scheduledTime || scheduledTime <= new Date() || task.action.startsWith('sync_')) {
          console.log(`[Worker] Thực hiện tác vụ #${task.id}, loại: ${syncType}`);
          
          // Cập nhật trạng thái
          await prisma.syncLog.update({
            where: { id: task.id },
            data: {
              status: 'processing',
              message: `Đang xử lý đồng bộ ${syncType}`
            }
          });
          
          // Chọn queue phù hợp dựa trên loại đồng bộ
          let targetQueue;
          if (syncType === 'inventory') {
            targetQueue = inventorySyncQueue;
          } else if (syncType === 'price') {
            targetQueue = priceSyncQueue;
          } else {
            // Mặc định là scheduled queue nếu là loại khác
            targetQueue = scheduledQueue;
          }
          
          // Thêm job vào queue để xử lý ngay lập tức
          await targetQueue.add('sync-products', {
            syncType,
            username: task.createdBy || 'system',
            syncAllProducts: true,
            scheduledLogId: task.id
          });
          
          executedCount++;
          return true;
        } else {
          // Giảm log định kỳ
          // console.log(`[Worker] Tác vụ #${task.id} chưa đến thời gian thực hiện: ${scheduledTime.toLocaleString()}`);
          return false;
        }
      } catch (error) {
        console.error(`[Worker] Lỗi khi xử lý tác vụ #${task.id}:`, error.message);
        
        // Cập nhật trạng thái lỗi
        try {
          await prisma.syncLog.update({
            where: { id: task.id },
            data: {
              status: 'error',
              message: `Lỗi: ${error.message}`
            }
          });
        } catch (updateError) {
          console.error(`[Worker] Lỗi khi cập nhật trạng thái tác vụ #${task.id}:`, updateError);
        }
        return false;
      }
    });
    
    // Chờ tất cả các tác vụ hoàn thành
    const results = await Promise.all(taskPromises);
    executedCount = results.filter(Boolean).length;
    
    // Nếu không có tác vụ nào, tạo một tác vụ mới nếu tự động đồng bộ được bật
    if (scheduledTasks.length === 0 && autoSyncEnabled) {
      console.log('[Worker] Không có tác vụ đồng bộ nào để xử lý. Đang lên lịch tác vụ mới...');
      try {
        await scheduleNextSync();
      } catch (scheduleError) {
        console.error('[Worker] Lỗi khi lên lịch tác vụ mới:', scheduleError);
      }
    }
    
    return { 
      success: true, 
      executedCount,
      totalScheduled: scheduledTasks.length
    };
  } catch (error) {
    console.error('[Worker] Lỗi khi kiểm tra tác vụ đã lên lịch:', error.message);
    
    // Đảm bảo hệ thống tiếp tục hoạt động bằng cách tạo tác vụ mới nếu có lỗi
    try {
      await scheduleNextSync();
    } catch (recoveryError) {
      console.error('[Worker] Lỗi khi cố gắng khôi phục sau lỗi ban đầu:', recoveryError);
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}, { 
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY // Thêm concurrency
});

// Hàm định kỳ kiểm tra số lượng công việc
async function checkQueueStats() {
  try {
    const waiting = await scheduledQueue.getWaiting();
    const active = await scheduledQueue.getActive();
    const completed = await scheduledQueue.getCompleted();
    const failed = await scheduledQueue.getFailed();
    
    workerStatus.pendingJobs = waiting.length;
    workerStatus.activeJobs = active.length;
    workerStatus.completedJobs = completed.length;
    workerStatus.failedJobs = failed.length;
    
    // Cập nhật trạng thái vào database
    await updateWorkerStatus();
    
    console.log(`[Worker] Trạng thái: ${workerStatus.pendingJobs} đang chờ, ${workerStatus.activeJobs} đang xử lý, ${workerStatus.completedJobs} hoàn thành, ${workerStatus.failedJobs} lỗi`);
  } catch (error) {
    console.error('[Worker] Lỗi khi kiểm tra stats:', error);
  }
}

// Tạo worker cho tác vụ đồng bộ sản phẩm
const syncProductsWorker = new Worker('scheduled-queue', async (job) => {
  if (job.name !== 'sync-products') return;
  
  const { syncType, username, syncAllProducts, productIds, scheduledLogId } = job.data;
  
  console.log(`[Queue] Bắt đầu đồng bộ ${syncType}, người dùng: ${username}`);
  await job.updateProgress(0);
  
  // Bắt đầu đo metrics
  syncMetrics.start();
  
  try {
    // Lấy settings từ database
    const settingsData = await prisma.setting.findMany();
    
    const settings = {};
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
      products = await prisma.productMapping.findMany({
        where: {
          id: { in: productIds }
        }
      });
    } else if (syncAllProducts) {
      // Đồng bộ tất cả sản phẩm
      products = await prisma.productMapping.findMany();
    } else {
      // Đồng bộ sản phẩm với status success, done, pending hoặc null
      // Sử dụng $queryRaw để xử lý đúng điều kiện NULL
      products = await prisma.$queryRaw`
        SELECT * FROM ProductMapping 
        WHERE status = 'success' OR status = 'done' OR status = 'pending' OR status IS NULL
      `;
    }
    
    // Log thông tin sản phẩm để debug
    console.log(`[Queue] Tìm thấy ${products.length} sản phẩm để đồng bộ.`);
    
    // Tạo bản ghi đồng bộ nếu không có scheduledLogId
    let syncLog;
    if (scheduledLogId) {
      syncLog = await prisma.syncLog.findUnique({
        where: { id: scheduledLogId }
      });
      
      if (syncLog) {
        // Cập nhật log đã lên lịch
        await prisma.syncLog.update({
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
      syncLog = await prisma.syncLog.create({
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
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          message: 'Không có sản phẩm nào để đồng bộ'
        }
      });
      return { success: true, message: 'Không có sản phẩm nào để đồng bộ' };
    }
    
    console.log(`[Worker] Bắt đầu đồng bộ ${products.length} sản phẩm`);
    
    // Thống kê kết quả
    const stats = {
      total: products.length,
      success: 0,
      error: 0,
      skipped: 0
    };
    
    // Nhập module đồng bộ
    const { syncInventory, batchSyncInventory } = require('../src/lib/syncService');
    
    // Thực hiện đồng bộ từng sản phẩm
    if (syncType === 'inventory' || syncType === 'all') {
      await job.updateProgress(10);
      console.log(`[Worker] Đang đồng bộ tồn kho cho ${products.length} sản phẩm`);
      
      // Nếu số lượng sản phẩm ít, xử lý trực tiếp với batchSyncInventory
      if (products.length <= 20) {
        try {
          console.log(`[Worker] Số lượng sản phẩm ít (${products.length}), xử lý trực tiếp với batchSyncInventory`);
          
          // Verify configSettings is defined before using it
          if (!configSettings || !configSettings.shopify_store || !configSettings.shopify_access_token) {
            console.error(`[Worker] Error: configSettings is not properly defined for batch processing`);
            throw new Error('Thiếu cấu hình Shopify (store hoặc access token)');
          }
          
          // Sử dụng warehouseId từ job data hoặc mặc định từ configSettings
          const syncWarehouseId = job.data.warehouseId || configSettings.nhanh_warehouse_id || '175080';
          console.log(`[Worker] Sử dụng kho ${syncWarehouseId} cho đồng bộ tồn kho`);
          
          const result = await batchSyncInventory(products, configSettings, username, syncWarehouseId);
          
          stats.success = result.success;
          stats.error = result.error;
          stats.skipped = result.skipped;
          
          // Cập nhật chi tiết tiến độ vào bản ghi đồng bộ
          await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
              details: JSON.stringify({
                total: products.length,
                processed: products.length,
                progress: 90,
                stats,
                lastUpdate: new Date().toISOString()
              })
            }
          });
          
          // Ghi nhận batch đã xử lý
          syncMetrics.recordBatch(products.length);
          
          await job.updateProgress(100);
          console.log(`[Worker] Hoàn thành xử lý ${products.length} sản phẩm`);
        } catch (error) {
          console.error(`[Worker] Lỗi khi xử lý batchSyncInventory: ${error.message}`);
          throw error;
        }
      } else {
        try {
          // Tạo hàm getPrioritizedProducts ngay trong worker.js
          function calculatePriorityScore(product) {
            let score = 0;
            
            // Trạng thái lỗi có điểm ưu tiên cao nhất
            if (product.status === 'error') {
              score += 100;
            }
            
            // Thời gian cập nhật gần đây
            // Đảm bảo an toàn cho trường hợp không có updatedAt
            let lastUpdated;
            try {
              // Kiểm tra trường updatedAt tồn tại và hợp lệ, nếu không sử dụng createdAt
              lastUpdated = new Date(product.updatedAt ? product.updatedAt : (product.createdAt || new Date()));
              if (isNaN(lastUpdated.getTime())) {
                lastUpdated = new Date(product.createdAt || new Date());
              }
            } catch (error) {
              lastUpdated = new Date(product.createdAt || new Date());
            }
            
            const now = new Date();
            const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceUpdate < 1) {
              // Cập nhật trong vòng 1 giờ qua
              score += 50;
            } else if (hoursSinceUpdate < 3) {
              // Cập nhật trong vòng 3 giờ qua
              score += 40;
            } else if (hoursSinceUpdate < 24) {
              // Cập nhật trong vòng 24 giờ qua
              score += 30;
            }
            
            // Sản phẩm mới tạo
            let creationDate;
            try {
              creationDate = new Date(product.createdAt || new Date());
              if (isNaN(creationDate.getTime())) {
                creationDate = new Date();
              }
            } catch (error) {
              creationDate = new Date();
            }
            
            const daysSinceCreation = (now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceCreation < 1) {
              score += 30;
            }
            
            // Phân tích dữ liệu Nhanh.vn nếu có
            try {
              let nhanhData = null;
              if (product.nhanhData) {
                nhanhData = typeof product.nhanhData === 'string' 
                  ? JSON.parse(product.nhanhData) 
                  : product.nhanhData;
                
                // Sản phẩm có tồn kho thấp (dưới 5)
                if (nhanhData.inventory !== undefined && nhanhData.inventory < 5) {
                  score += 20;
                }
                
                // Sản phẩm đắt tiền
                if (nhanhData.price !== undefined && nhanhData.price > 1000000) {
                  score += 10;
                }
              }
            } catch (error) {
              // Lỗi khi phân tích dữ liệu sẽ không ảnh hưởng đến điểm
            }
            
            return score;
          }
          
          async function getPrioritizedProducts(products, limit = 0) {
            if (!products || products.length === 0) return [];
            
            // Tính điểm ưu tiên cho mỗi sản phẩm
            const prioritizedProducts = products.map(product => ({
              product,
              priorityScore: calculatePriorityScore(product)
            }));
            
            // Sắp xếp theo điểm ưu tiên giảm dần
            prioritizedProducts.sort((a, b) => b.priorityScore - a.priorityScore);
            
            // Ghi log tóm tắt thay vì log chi tiết
            console.log('[Priority] Đã sắp xếp ' + products.length + ' sản phẩm theo ưu tiên');
            
            // Chỉ trả về số lượng giới hạn nếu có yêu cầu
            const result = prioritizedProducts.map(item => item.product);
            if (limit > 0 && limit < result.length) {
              return result.slice(0, limit);
            }
            
            return result;
          }
          
          // Áp dụng chiến lược ưu tiên cho danh sách sản phẩm
          console.log(`[Worker] Áp dụng chiến lược ưu tiên cho ${products.length} sản phẩm`);
          const prioritizedProducts = await getPrioritizedProducts(products);
          
          // TỐI ƯU: Sử dụng kích thước batch động
          const BATCH_SIZE = products.length > 1000 ? 25 : (products.length > 500 ? 20 : (products.length > 100 ? 15 : 10));
          const PARALLEL_BATCHES = products.length > 500 ? 3 : 2;
          const batchCount = Math.ceil(prioritizedProducts.length / BATCH_SIZE);
          
          console.log(`[Worker] Cấu hình batch: Kích thước=${BATCH_SIZE}, Xử lý đồng thời=${PARALLEL_BATCHES}, Tổng số batch=${batchCount}`);
          
          // Chuẩn bị tất cả các batch với danh sách sản phẩm đã được ưu tiên
          const batches = [];
          for (let i = 0; i < batchCount; i++) {
            const startIdx = i * BATCH_SIZE;
            const endIdx = Math.min((i + 1) * BATCH_SIZE, prioritizedProducts.length);
            batches.push(prioritizedProducts.slice(startIdx, endIdx));
          }
          
          // TỐI ƯU: Xử lý đồng thời nhiều batch với giới hạn
          for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
            const currentBatches = batches.slice(i, i + PARALLEL_BATCHES);
            const batchPromises = currentBatches.map(async (batch, batchIdx) => {
              const currentBatchIndex = i + batchIdx;
              
              // Cập nhật tiến độ
              const progressPercent = Math.floor(10 + (currentBatchIndex / batchCount) * 80);
              
              // Giảm log chi tiết nhưng vẫn giữ thông tin tiến độ chung
              if (currentBatchIndex % Math.max(1, Math.floor(batchCount / 5)) === 0) {
                console.log(`[Worker] Đang xử lý lô ${currentBatchIndex + 1}/${batchCount}, tiến độ: ${progressPercent}%`);
              }
              
              // Xử lý trực tiếp từng sản phẩm thay vì dùng batchSyncInventory
              const batchResults = {
                total: batch.length,
                success: 0,
                error: 0,
                skipped: 0,
                details: []
              };
              
              // Xử lý từng sản phẩm trong danh sách
              for (let j = 0; j < batch.length; j++) {
                try {
                  const product = batch[j];
                  
                  // Lấy dữ liệu Nhanh.vn
                  let nhanhData = null;
                  if (product.nhanhData) {
                    try {
                      nhanhData = typeof product.nhanhData === 'string' 
                        ? JSON.parse(product.nhanhData) 
                        : product.nhanhData;
                    } catch (parseError) {
                      console.error(`[Worker] Lỗi parse nhanhData: ${parseError.message}`);
                    }
                  }
                  
                  // Kiểm tra ID Nhanh.vn
                  if (!product.externalId && (!nhanhData || !nhanhData.idNhanh)) {
                    // Giảm log chi tiết, chỉ giữ lại log tổng quan
                    batchResults.skipped++;
                    continue;
                  }
                  
                  // Sử dụng externalId từ product hoặc idNhanh từ nhanhData
                  const productForSync = {
                    ...product,
                    externalId: product.externalId || (nhanhData && nhanhData.idNhanh ? nhanhData.idNhanh : null)
                  };
                  
                  // Gọi hàm đồng bộ - sử dụng hasProductChanged tích hợp trong syncInventory
                  const result = await syncInventory(productForSync, nhanhData, configSettings, username);
                  
                  // Xử lý kết quả
                  if (result && result.updated) {
                    batchResults.success++;
                    // Giảm log chi tiết từng sản phẩm, chỉ log tổng quan
                    trackSyncSuccess(); // Ghi nhận thành công
                  } else if (result && result.skipped) {
                    batchResults.skipped++;
                    // Giảm log chi tiết
                    // Thêm logging khi bỏ qua để phục vụ debug - vẫn giữ lại nhưng giảm chi tiết
                    await prisma.syncLog.create({
                      data: {
                        productMappingId: product.id,
                        action: 'sync_inventory',
                        status: 'skipped',
                        message: `Bỏ qua đồng bộ tồn kho (${result.reason || 'không thay đổi'})`,
                        details: JSON.stringify({
                          inventoryQuantity: result.newQuantity !== undefined ? result.newQuantity : null,
                          shopifyInventory: result.oldQuantity !== undefined ? result.oldQuantity : null
                        }),
                        createdBy: username
                      }
                    });
                  } else {
                    batchResults.error++;
                    const errorMessage = result && result.error ? result.error : 'Không xác định';
                    console.error(`[Worker] Lỗi khi đồng bộ sản phẩm ${product.id}: ${errorMessage}`);
                    trackSyncError(new Error(errorMessage)); // Ghi nhận lỗi
                  }
                  
                  batchResults.details.push({
                    id: product.id,
                    success: result && result.updated,
                    skipped: result && result.skipped,
                    error: result && result.error ? result.error : null
                  });
                } catch (error) {
                  batchResults.error++;
                  console.error(`[Worker] Lỗi xử lý sản phẩm:`, error);
                  trackSyncError(error); // Ghi nhận lỗi để theo dõi mẫu hình
                  
                  // Tạo bản ghi lỗi chi tiết
                  try {
                    await prisma.syncLog.create({
                      data: {
                        productMappingId: product.id,
                        action: 'sync_inventory',
                        status: 'error',
                        message: error.message || 'Lỗi không xác định',
                        details: JSON.stringify({
                          error: error.message,
                          stack: error.stack,
                          timestamp: new Date().toISOString()
                        }),
                        createdBy: username
                      }
                    });
                  } catch (logError) {
                    console.error(`[Worker] Lỗi khi ghi log:`, logError);
                  }
                }
              }
              
              return batchResults;
            });
            
            // Chờ tất cả các batch trong nhóm hiện tại hoàn thành
            const batchResults = await Promise.all(batchPromises);
            
            // Cập nhật tiến độ và thống kê
            let processedCount = 0;
            batchResults.forEach(result => {
              stats.success += result.success || 0;
              stats.error += result.error || 0;
              stats.skipped += result.skipped || 0;
              processedCount += result.total || 0;
            });
            
            // Cập nhật tiến độ
            const progressPercent = Math.round((processedCount / products.length) * 100);
            await job.updateProgress(progressPercent);
            
            // Giảm thời gian chờ giữa các batch từ 500ms xuống 300ms để cải thiện hiệu suất
            // Vẫn đủ để tránh rate limit của API
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Ghi log tiến trình chỉ sau mỗi 20% hoàn thành thay vì mỗi batch
            if (processedCount === products.length || processedCount % Math.max(1, Math.floor(products.length / 5)) === 0) {
              console.log(`[Worker] Đã xử lý ${processedCount}/${products.length} sản phẩm (${progressPercent}%)`);
              console.log(`[Worker] Thành công: ${stats.success}, Lỗi: ${stats.error}, Bỏ qua: ${stats.skipped}`);
            }
            
            // Cập nhật thông tin task trong database
            await prisma.syncLog.update({
              where: { id: syncLog.id },
              data: {
                details: JSON.stringify({
                  total: products.length,
                  processed: processedCount,
                  progress: progressPercent,
                  stats,
                  lastUpdate: new Date().toISOString()
                })
              }
            });
            
            // Ghi nhận batch đã xử lý
            syncMetrics.recordBatch(processedCount);
          }
        } catch (error) {
          console.error(`[Worker] Lỗi khi xử lý batches:`, error);
          throw error;
        }
      }
    }
    
    await job.updateProgress(100);
    const performanceMetrics = syncMetrics.end();
    
    // Hiển thị metrics chi tiết
    console.log(`[Metrics] Kết thúc đo hiệu suất:`);
    console.log(`- Thời gian: ${performanceMetrics.totalTime}ms`);
    console.log(`- Tổng mục: ${stats.total}, Thành công: ${stats.success}, Lỗi: ${stats.error}, Bỏ qua: ${stats.skipped}`);
    
    console.log(`[Worker] Hoàn thành đồng bộ. Thành công=${stats.success}, Lỗi=${stats.error}, Bỏ qua=${stats.skipped}`);
    
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        message: `Đã đồng bộ ${stats.success}/${products.length} sản phẩm thành công, ${stats.error} lỗi, ${stats.skipped} bỏ qua`,
        details: JSON.stringify({
          total: products.length,
          stats: stats,
          syncType,
          startTime: new Date(syncMetrics.startTime),
          endTime: new Date(),
          performance: performanceMetrics
        })
      }
    });
    
    // Tự động lên lịch cho lần đồng bộ tiếp theo sau khi hoàn thành
    try {
      // Lấy cài đặt từ database
      const settings = await getSettings();
      const syncInterval = parseInt(settings.sync_interval || '30', 10);
      const autoSyncEnabled = settings.sync_auto === 'true';
      
      if (autoSyncEnabled) {
        // Kiểm tra các tác vụ đang chờ xử lý
        const pendingJobs = await prisma.syncLog.findMany({
          where: {
            OR: [
              // Tác vụ đang chờ xử lý
              {
                action: {
                  in: ['sync_inventory', 'schedule_inventory']
                },
                status: {
                  in: ['pending', 'scheduled', 'processing']
                }
              },
              // Tác vụ hoàn thành gần đây
              {
                action: {
                  in: ['sync_inventory', 'schedule_inventory'] 
                },
                status: 'completed',
                createdAt: {
                  gt: new Date(Date.now() - 10 * 60 * 1000) // 10 phút trước
                }
              }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });
        
        // Nếu có tác vụ đang chờ hoặc mới hoàn thành, không tạo thêm
        if (pendingJobs.length > 0) {
          console.log(`[Worker] Đã có ${pendingJobs.length} tác vụ đang chờ xử lý hoặc mới hoàn thành. Bỏ qua việc tạo tác vụ mới.`);
          return;
        }
        
        // Tính thời gian cho lần đồng bộ tiếp theo
        const now = new Date();
        const nextSyncTime = new Date(now.getTime() + syncInterval * 60 * 1000);
        
        console.log(`[Worker] Lên lịch đồng bộ tiếp theo vào ${nextSyncTime.toLocaleString()}`);
        
        // Tạo tác vụ mới có lịch cụ thể
        const nextSyncLog = await prisma.syncLog.create({
          data: {
            action: 'schedule_inventory',
            status: 'scheduled',
            message: `Đã lên lịch đồng bộ tồn kho sau khi hoàn thành tác vụ #${syncLog.id}`,
            details: JSON.stringify({
              scheduledTime: nextSyncTime.toISOString(),
              previousSyncId: syncLog.id,
              autoScheduled: true
            }),
            createdBy: 'system'
          }
        });
        
        console.log(`[Worker] Đã tạo tác vụ đồng bộ tự động tiếp theo, ID: ${nextSyncLog.id}, thời gian: ${nextSyncTime.toLocaleString()}`);
      }
    } catch (scheduleError) {
      console.error(`[Worker] Lỗi khi lên lịch tự động:`, scheduleError);
    }
    
    return { 
      success: true, 
      products: products.length,
      stats: stats,
      performance: performanceMetrics
    };
    
  } catch (error) {
    // Kết thúc metrics khi có lỗi
    const performanceMetrics = syncMetrics.end();
    
    console.error(`[Queue] Lỗi đồng bộ sản phẩm:`, error);
    
    // Cập nhật log với thông tin lỗi chi tiết
    if (scheduledLogId) {
      await prisma.syncLog.update({
        where: { id: scheduledLogId },
        data: {
          status: 'error',
          message: `Lỗi: ${error.message}`,
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
            performance: performanceMetrics,
            time: new Date()
          })
        }
      });
    }
    
    return { 
      success: false, 
      error: error.message,
      performance: performanceMetrics
    };
  }
}, { 
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY 
});

// Tạo worker cho đồng bộ tồn kho
const inventorySyncWorker = new Worker('inventory-sync-queue', async (job) => {
  if (job.name !== 'sync-products') return;
  
  const { syncType, username, syncAllProducts, productIds, scheduledLogId } = job.data;
  
  console.log(`[Queue] Bắt đầu đồng bộ tồn kho, người dùng: ${username}`);
  await job.updateProgress(0);
  
  // Gọi hàm đồng bộ tồn kho
  return processSyncJob(job, 'inventory');
}, { 
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY
});

// Tạo worker cho đồng bộ giá
const priceSyncWorker = new Worker('price-sync-queue', async (job) => {
  if (job.name !== 'sync-products') return;
  
  const { syncType, username, syncAllProducts, productIds, scheduledLogId } = job.data;
  
  console.log(`[Queue] Bắt đầu đồng bộ giá, người dùng: ${username}`);
  await job.updateProgress(0);
  
  // Gọi hàm đồng bộ giá
  return processSyncJob(job, 'price');
}, { 
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY
});

// Tạo hàm chung xử lý đồng bộ để tái sử dụng code
async function processSyncJob(job, forceSyncType = null) {
  const { syncType: originalSyncType, username, syncAllProducts, productIds, scheduledLogId, warehouseId } = job.data;
  
  // Log chi tiết dữ liệu công việc
  console.log(`[Worker] Bắt đầu xử lý công việc đồng bộ: type=${originalSyncType}, user=${username}, all=${syncAllProducts}, warehouseId=${warehouseId || 'default'}`);
  
  const syncType = forceSyncType || originalSyncType;
  
  // Bắt đầu đo metrics
  syncMetrics.start();
  
  try {
    // Lấy settings từ database
    const settingsData = await prisma.setting.findMany();
    
    const settings = {};
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
      products = await prisma.productMapping.findMany({
        where: {
          id: { in: productIds }
        }
      });
    } else if (syncAllProducts) {
      // Đồng bộ tất cả sản phẩm
      products = await prisma.productMapping.findMany();
    } else {
      // Đồng bộ sản phẩm với status success, done, pending hoặc null
      // Sử dụng $queryRaw để xử lý đúng điều kiện NULL
      products = await prisma.$queryRaw`
        SELECT * FROM ProductMapping 
        WHERE status = 'success' OR status = 'done' OR status = 'pending' OR status IS NULL
      `;
    }
    
    // Log thông tin sản phẩm để debug
    console.log(`[Queue] Tìm thấy ${products.length} sản phẩm để đồng bộ.`);
    
    // Tạo bản ghi đồng bộ nếu không có scheduledLogId
    let syncLog;
    if (scheduledLogId) {
      syncLog = await prisma.syncLog.findUnique({
        where: { id: scheduledLogId }
      });
      
      if (syncLog) {
        // Cập nhật log đã lên lịch
        await prisma.syncLog.update({
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
      syncLog = await prisma.syncLog.create({
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
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          message: 'Không có sản phẩm nào để đồng bộ'
        }
      });
      return { success: true, message: 'Không có sản phẩm nào để đồng bộ' };
    }
    
    console.log(`[Worker] Bắt đầu đồng bộ ${products.length} sản phẩm`);
    
    // Thống kê kết quả
    const stats = {
      total: products.length,
      success: 0,
      error: 0,
      skipped: 0
    };
    
    // Nhập module đồng bộ
    const { syncInventory, batchSyncInventory } = require('../src/lib/syncService');
    
    // Thực hiện đồng bộ từng sản phẩm
    if (syncType === 'inventory' || syncType === 'all') {
      await job.updateProgress(10);
      console.log(`[Worker] Đang đồng bộ tồn kho cho ${products.length} sản phẩm`);
      
      // Nếu số lượng sản phẩm ít, xử lý trực tiếp với batchSyncInventory
      if (products.length <= 20) {
        try {
          console.log(`[Worker] Số lượng sản phẩm ít (${products.length}), xử lý trực tiếp với batchSyncInventory`);
          
          // Verify configSettings is defined before using it
          if (!configSettings || !configSettings.shopify_store || !configSettings.shopify_access_token) {
            console.error(`[Worker] Error: configSettings is not properly defined for batch processing`);
            throw new Error('Thiếu cấu hình Shopify (store hoặc access token)');
          }
          
          // Sử dụng warehouseId từ job data hoặc mặc định từ configSettings
          const syncWarehouseId = warehouseId || configSettings.nhanh_warehouse_id || '175080';
          console.log(`[Worker] Sử dụng kho ${syncWarehouseId} cho đồng bộ tồn kho`);
          
          const result = await batchSyncInventory(products, configSettings, username, syncWarehouseId);
          
          stats.success = result.success;
          stats.error = result.error;
          stats.skipped = result.skipped;
          
          // Cập nhật chi tiết tiến độ vào bản ghi đồng bộ
          await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
              details: JSON.stringify({
                total: products.length,
                processed: products.length,
                progress: 90,
                stats,
                lastUpdate: new Date().toISOString()
              })
            }
          });
          
          // Ghi nhận batch đã xử lý
          syncMetrics.recordBatch(products.length);
          
          await job.updateProgress(100);
          console.log(`[Worker] Hoàn thành xử lý ${products.length} sản phẩm`);
        } catch (error) {
          console.error(`[Worker] Lỗi khi xử lý batchSyncInventory: ${error.message}`);
          throw error;
        }
      } else {
        try {
          // Tạo hàm getPrioritizedProducts ngay trong worker.js
          function calculatePriorityScore(product) {
            let score = 0;
            
            // Trạng thái lỗi có điểm ưu tiên cao nhất
            if (product.status === 'error') {
              score += 100;
            }
            
            // Thời gian cập nhật gần đây
            // Đảm bảo an toàn cho trường hợp không có updatedAt
            let lastUpdated;
            try {
              // Kiểm tra trường updatedAt tồn tại và hợp lệ, nếu không sử dụng createdAt
              lastUpdated = new Date(product.updatedAt ? product.updatedAt : (product.createdAt || new Date()));
              if (isNaN(lastUpdated.getTime())) {
                lastUpdated = new Date(product.createdAt || new Date());
              }
            } catch (error) {
              lastUpdated = new Date(product.createdAt || new Date());
            }
            
            const now = new Date();
            const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceUpdate < 1) {
              // Cập nhật trong vòng 1 giờ qua
              score += 50;
            } else if (hoursSinceUpdate < 3) {
              // Cập nhật trong vòng 3 giờ qua
              score += 40;
            } else if (hoursSinceUpdate < 24) {
              // Cập nhật trong vòng 24 giờ qua
              score += 30;
            }
            
            // Sản phẩm mới tạo
            let creationDate;
            try {
              creationDate = new Date(product.createdAt || new Date());
              if (isNaN(creationDate.getTime())) {
                creationDate = new Date();
              }
            } catch (error) {
              creationDate = new Date();
            }
            
            const daysSinceCreation = (now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceCreation < 1) {
              score += 30;
            }
            
            // Phân tích dữ liệu Nhanh.vn nếu có
            try {
              let nhanhData = null;
              if (product.nhanhData) {
                nhanhData = typeof product.nhanhData === 'string' 
                  ? JSON.parse(product.nhanhData) 
                  : product.nhanhData;
                
                // Sản phẩm có tồn kho thấp (dưới 5)
                if (nhanhData.inventory !== undefined && nhanhData.inventory < 5) {
                  score += 20;
                }
                
                // Sản phẩm đắt tiền
                if (nhanhData.price !== undefined && nhanhData.price > 1000000) {
                  score += 10;
                }
              }
            } catch (error) {
              // Lỗi khi phân tích dữ liệu sẽ không ảnh hưởng đến điểm
            }
            
            return score;
          }
          
          async function getPrioritizedProducts(products, limit = 0) {
            if (!products || products.length === 0) return [];
            
            // Tính điểm ưu tiên cho mỗi sản phẩm
            const prioritizedProducts = products.map(product => ({
              product,
              priorityScore: calculatePriorityScore(product)
            }));
            
            // Sắp xếp theo điểm ưu tiên giảm dần
            prioritizedProducts.sort((a, b) => b.priorityScore - a.priorityScore);
            
            // Ghi log tóm tắt thay vì log chi tiết
            console.log('[Priority] Đã sắp xếp ' + products.length + ' sản phẩm theo ưu tiên');
            
            // Chỉ trả về số lượng giới hạn nếu có yêu cầu
            const result = prioritizedProducts.map(item => item.product);
            if (limit > 0 && limit < result.length) {
              return result.slice(0, limit);
            }
            
            return result;
          }
          
          // Áp dụng chiến lược ưu tiên cho danh sách sản phẩm
          console.log(`[Worker] Áp dụng chiến lược ưu tiên cho ${products.length} sản phẩm`);
          const prioritizedProducts = await getPrioritizedProducts(products);
          
          // TỐI ƯU: Sử dụng kích thước batch động
          const BATCH_SIZE = products.length > 1000 ? 25 : (products.length > 500 ? 20 : (products.length > 100 ? 15 : 10));
          const PARALLEL_BATCHES = products.length > 500 ? 3 : 2;
          const batchCount = Math.ceil(prioritizedProducts.length / BATCH_SIZE);
          
          console.log(`[Worker] Cấu hình batch: Kích thước=${BATCH_SIZE}, Xử lý đồng thời=${PARALLEL_BATCHES}, Tổng số batch=${batchCount}`);
          
          // Chuẩn bị tất cả các batch với danh sách sản phẩm đã được ưu tiên
          const batches = [];
          for (let i = 0; i < batchCount; i++) {
            const startIdx = i * BATCH_SIZE;
            const endIdx = Math.min((i + 1) * BATCH_SIZE, prioritizedProducts.length);
            batches.push(prioritizedProducts.slice(startIdx, endIdx));
          }
          
          // TỐI ƯU: Xử lý đồng thời nhiều batch với giới hạn
          for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
            const currentBatches = batches.slice(i, i + PARALLEL_BATCHES);
            const batchPromises = currentBatches.map(async (batch, batchIdx) => {
              const currentBatchIndex = i + batchIdx;
              
              // Cập nhật tiến độ
              const progressPercent = Math.floor(10 + (currentBatchIndex / batchCount) * 80);
              
              // Giảm log chi tiết nhưng vẫn giữ thông tin tiến độ chung
              if (currentBatchIndex % Math.max(1, Math.floor(batchCount / 5)) === 0) {
                console.log(`[Worker] Đang xử lý lô ${currentBatchIndex + 1}/${batchCount}, tiến độ: ${progressPercent}%`);
              }
              
              // Xử lý trực tiếp từng sản phẩm thay vì dùng batchSyncInventory
              const batchResults = {
                total: batch.length,
                success: 0,
                error: 0,
                skipped: 0,
                details: []
              };
              
              // Xử lý từng sản phẩm trong danh sách
              for (let j = 0; j < batch.length; j++) {
                try {
                  const product = batch[j];
                  
                  // Lấy dữ liệu Nhanh.vn
                  let nhanhData = null;
                  if (product.nhanhData) {
                    try {
                      nhanhData = typeof product.nhanhData === 'string' 
                        ? JSON.parse(product.nhanhData) 
                        : product.nhanhData;
                    } catch (parseError) {
                      console.error(`[Worker] Lỗi parse nhanhData: ${parseError.message}`);
                    }
                  }
                  
                  // Kiểm tra ID Nhanh.vn
                  if (!product.externalId && (!nhanhData || !nhanhData.idNhanh)) {
                    // Giảm log chi tiết, chỉ giữ lại log tổng quan
                    batchResults.skipped++;
                    continue;
                  }
                  
                  // Sử dụng externalId từ product hoặc idNhanh từ nhanhData
                  const productForSync = {
                    ...product,
                    externalId: product.externalId || (nhanhData && nhanhData.idNhanh ? nhanhData.idNhanh : null)
                  };
                  
                  // Gọi hàm đồng bộ - sử dụng hasProductChanged tích hợp trong syncInventory
                  const result = await syncInventory(productForSync, nhanhData, configSettings, username);
                  
                  // Xử lý kết quả
                  if (result && result.updated) {
                    batchResults.success++;
                    // Giảm log chi tiết từng sản phẩm, chỉ log tổng quan
                    trackSyncSuccess(); // Ghi nhận thành công
                  } else if (result && result.skipped) {
                    batchResults.skipped++;
                    // Giảm log chi tiết
                    // Thêm logging khi bỏ qua để phục vụ debug - vẫn giữ lại nhưng giảm chi tiết
                    await prisma.syncLog.create({
                      data: {
                        productMappingId: product.id,
                        action: 'sync_inventory',
                        status: 'skipped',
                        message: `Bỏ qua đồng bộ tồn kho (${result.reason || 'không thay đổi'})`,
                        details: JSON.stringify({
                          inventoryQuantity: result.newQuantity !== undefined ? result.newQuantity : null,
                          shopifyInventory: result.oldQuantity !== undefined ? result.oldQuantity : null
                        }),
                        createdBy: username
                      }
                    });
                  } else {
                    batchResults.error++;
                    const errorMessage = result && result.error ? result.error : 'Không xác định';
                    console.error(`[Worker] Lỗi khi đồng bộ sản phẩm ${product.id}: ${errorMessage}`);
                    trackSyncError(new Error(errorMessage)); // Ghi nhận lỗi
                  }
                  
                  batchResults.details.push({
                    id: product.id,
                    success: result && result.updated,
                    skipped: result && result.skipped,
                    error: result && result.error ? result.error : null
                  });
                } catch (error) {
                  batchResults.error++;
                  console.error(`[Worker] Lỗi xử lý sản phẩm:`, error);
                  trackSyncError(error); // Ghi nhận lỗi để theo dõi mẫu hình
                  
                  // Tạo bản ghi lỗi chi tiết
                  try {
                    await prisma.syncLog.create({
                      data: {
                        productMappingId: product.id,
                        action: 'sync_inventory',
                        status: 'error',
                        message: error.message || 'Lỗi không xác định',
                        details: JSON.stringify({
                          error: error.message,
                          stack: error.stack,
                          timestamp: new Date().toISOString()
                        }),
                        createdBy: username
                      }
                    });
                  } catch (logError) {
                    console.error(`[Worker] Lỗi khi ghi log:`, logError);
                  }
                }
              }
              
              return batchResults;
            });
            
            // Chờ tất cả các batch trong nhóm hiện tại hoàn thành
            const batchResults = await Promise.all(batchPromises);
            
            // Cập nhật tiến độ và thống kê
            let processedCount = 0;
            batchResults.forEach(result => {
              stats.success += result.success || 0;
              stats.error += result.error || 0;
              stats.skipped += result.skipped || 0;
              processedCount += result.total || 0;
            });
            
            // Cập nhật tiến độ
            const progressPercent = Math.round((processedCount / products.length) * 100);
            await job.updateProgress(progressPercent);
            
            // Giảm thời gian chờ giữa các batch từ 500ms xuống 300ms để cải thiện hiệu suất
            // Vẫn đủ để tránh rate limit của API
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Ghi log tiến trình chỉ sau mỗi 20% hoàn thành thay vì mỗi batch
            if (processedCount === products.length || processedCount % Math.max(1, Math.floor(products.length / 5)) === 0) {
              console.log(`[Worker] Đã xử lý ${processedCount}/${products.length} sản phẩm (${progressPercent}%)`);
              console.log(`[Worker] Thành công: ${stats.success}, Lỗi: ${stats.error}, Bỏ qua: ${stats.skipped}`);
            }
            
            // Cập nhật thông tin task trong database
            await prisma.syncLog.update({
              where: { id: syncLog.id },
              data: {
                details: JSON.stringify({
                  total: products.length,
                  processed: processedCount,
                  progress: progressPercent,
                  stats,
                  lastUpdate: new Date().toISOString()
                })
              }
            });
            
            // Ghi nhận batch đã xử lý
            syncMetrics.recordBatch(processedCount);
          }
        } catch (error) {
          console.error(`[Worker] Lỗi khi xử lý batches:`, error);
          throw error;
        }
      }
    }
    
    await job.updateProgress(100);
    const performanceMetrics = syncMetrics.end();
    
    // Hiển thị metrics chi tiết
    console.log(`[Metrics] Kết thúc đo hiệu suất:`);
    console.log(`- Thời gian: ${performanceMetrics.totalTime}ms`);
    console.log(`- Tổng mục: ${stats.total}, Thành công: ${stats.success}, Lỗi: ${stats.error}, Bỏ qua: ${stats.skipped}`);
    
    console.log(`[Worker] Hoàn thành đồng bộ. Thành công=${stats.success}, Lỗi=${stats.error}, Bỏ qua=${stats.skipped}`);
    
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        message: `Đã đồng bộ ${stats.success}/${products.length} sản phẩm thành công, ${stats.error} lỗi, ${stats.skipped} bỏ qua`,
        details: JSON.stringify({
          total: products.length,
          stats: stats,
          syncType,
          startTime: new Date(syncMetrics.startTime),
          endTime: new Date(),
          performance: performanceMetrics
        })
      }
    });
    
    // Tự động lên lịch cho lần đồng bộ tiếp theo sau khi hoàn thành
    try {
      // Lấy cài đặt từ database
      const settings = await getSettings();
      const syncInterval = parseInt(settings.sync_interval || '30', 10);
      const autoSyncEnabled = settings.sync_auto === 'true';
      
      if (autoSyncEnabled) {
        // Kiểm tra các tác vụ đang chờ xử lý
        const pendingJobs = await prisma.syncLog.findMany({
          where: {
            OR: [
              // Tác vụ đang chờ xử lý
              {
                action: {
                  in: ['sync_inventory', 'schedule_inventory']
                },
                status: {
                  in: ['pending', 'scheduled', 'processing']
                }
              },
              // Tác vụ hoàn thành gần đây
              {
                action: {
                  in: ['sync_inventory', 'schedule_inventory'] 
                },
                status: 'completed',
                createdAt: {
                  gt: new Date(Date.now() - 10 * 60 * 1000) // 10 phút trước
                }
              }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });
        
        // Nếu có tác vụ đang chờ hoặc mới hoàn thành, không tạo thêm
        if (pendingJobs.length > 0) {
          console.log(`[Worker] Đã có ${pendingJobs.length} tác vụ đang chờ xử lý hoặc mới hoàn thành. Bỏ qua việc tạo tác vụ mới.`);
          return;
        }
        
        // Tính thời gian cho lần đồng bộ tiếp theo
        const now = new Date();
        const nextSyncTime = new Date(now.getTime() + syncInterval * 60 * 1000);
        
        console.log(`[Worker] Lên lịch đồng bộ tiếp theo vào ${nextSyncTime.toLocaleString()}`);
        
        // Tạo tác vụ mới có lịch cụ thể
        const nextSyncLog = await prisma.syncLog.create({
          data: {
            action: 'schedule_inventory',
            status: 'scheduled',
            message: `Đã lên lịch đồng bộ tồn kho sau khi hoàn thành tác vụ #${syncLog.id}`,
            details: JSON.stringify({
              scheduledTime: nextSyncTime.toISOString(),
              previousSyncId: syncLog.id,
              autoScheduled: true
            }),
            createdBy: 'system'
          }
        });
        
        console.log(`[Worker] Đã tạo tác vụ đồng bộ tự động tiếp theo, ID: ${nextSyncLog.id}, thời gian: ${nextSyncTime.toLocaleString()}`);
      }
    } catch (scheduleError) {
      console.error(`[Worker] Lỗi khi lên lịch tự động:`, scheduleError);
    }
    
    return { 
      success: true, 
      products: products.length,
      stats: stats,
      performance: performanceMetrics
    };
    
  } catch (error) {
    // Kết thúc metrics khi có lỗi
    const performanceMetrics = syncMetrics.end();
    
    console.error(`[Queue] Lỗi đồng bộ sản phẩm:`, error);
    
    // Cập nhật log với thông tin lỗi chi tiết
    if (scheduledLogId) {
      await prisma.syncLog.update({
        where: { id: scheduledLogId },
        data: {
          status: 'error',
          message: `Lỗi: ${error.message}`,
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
            performance: performanceMetrics,
            time: new Date()
          })
        }
      });
    }
    
    return { 
      success: false, 
      error: error.message,
      performance: performanceMetrics
    };
  }
}  // End of processSyncJob function

// Hàm khởi động worker
async function startWorker() {
  try {
    console.log('[Worker] Đang khởi động worker đồng bộ độc lập...');
    
    // Cập nhật trạng thái
    workerStatus.isRunning = true;
    workerStatus.startTime = new Date().toISOString();
    await updateWorkerStatus();
    
    // Khởi tạo schedule checker
    initScheduleChecker();
    
    // Thêm kiểm tra tác vụ ngay khi khởi động
    console.log('[Worker] Kiểm tra tác vụ ngay khi khởi động...');
    await scheduledQueue.add('check-scheduled', {}, { delay: 1000 }); // Kiểm tra sau 1 giây
    
    // Thiết lập tự động lên lịch đồng bộ theo khoảng thời gian đã cài đặt
    initAutoSync();
    
    // Kiểm tra queue mỗi 30 giây
    setInterval(checkQueueStats, 30000);
    
    console.log('[Worker] Khởi động hoàn tất, worker đang chạy...');
  } catch (error) {
    console.error('[Worker] Lỗi khi khởi động:', error);
    process.exit(1);
  }
}

// Hàm khởi tạo chức năng tự động đồng bộ
async function initAutoSync() {
  try {
    console.log('[Worker] Thiết lập tự động đồng bộ theo lịch...');
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    const syncInterval = parseInt(settings.sync_interval || '30', 10);
    const autoSyncEnabled = settings.sync_auto === 'true';
    
    console.log(`[Worker] Cài đặt đồng bộ: tự động = ${autoSyncEnabled}, khoảng thời gian = ${syncInterval} phút`);
    
    if (autoSyncEnabled) {
      // Chạy lần đầu ngay khi khởi động
      await scheduleNextSync();
      
      // Thiết lập lịch trình kiểm tra mỗi 15 phút thay vì tạo các tác vụ liên tục
      // Giảm tần suất này giúp tránh tạo quá nhiều tác vụ
      const checkInterval = Math.max(15, Math.min(syncInterval / 2, 30)) * 60 * 1000; // tối thiểu 15 phút, tối đa 30 phút
      
      setInterval(async () => {
        // Kiểm tra xem cần tạo tác vụ mới không
        const pendingTasks = await prisma.syncLog.findMany({
          where: {
            action: {
              in: ['sync_inventory', 'schedule_inventory']
            },
            status: {
              in: ['pending', 'scheduled', 'processing']
            }
          },
          take: 1
        });
        
        if (pendingTasks.length === 0) {
          // Đã giảm log dư thừa
          await scheduleNextSync();
        }
      }, checkInterval);
      
      console.log(`[Worker] Đã thiết lập kiểm tra tác vụ định kỳ mỗi ${checkInterval / 60 / 1000} phút`);
    } else {
      console.log('[Worker] Tự động đồng bộ chưa được bật trong cài đặt');
    }
  } catch (error) {
    console.error('[Worker] Lỗi khi thiết lập tự động đồng bộ:', error);
  }
}

// Hàm lên lịch đồng bộ tiếp theo
async function scheduleNextSync() {
  try {
    // Đã giảm log này
    // console.log('[Worker] Đang kiểm tra và lên lịch đồng bộ...');
    
    // Dọn dẹp các tác vụ bị treo quá lâu
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    // Tìm các tác vụ đang ở trạng thái "processing" quá lâu (trên 5 phút)
    const stuckTasks = await prisma.syncLog.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: fiveMinutesAgo
        }
      }
    });
    
    if (stuckTasks.length > 0) {
      console.log(`[Worker] Phát hiện ${stuckTasks.length} tác vụ bị treo quá lâu, đang dọn dẹp...`);
      
      for (const task of stuckTasks) {
        await prisma.syncLog.update({
          where: { id: task.id },
          data: {
            status: 'error',
            message: `Tác vụ bị hủy do xử lý quá lâu (trên 5 phút)`
          }
        });
        // Giảm log chi tiết từng tác vụ
        // console.log(`[Worker] Đã dọn dẹp tác vụ #${task.id} bị treo`);
      }
    }
    
    // Kiểm tra xem đã có tác vụ đồng bộ tồn kho nào đang chờ xử lý không
    const pendingInventoryTasks = await prisma.syncLog.findMany({
      where: {
        action: {
          in: ['sync_inventory', 'schedule_inventory']
        },
        status: {
          in: ['pending', 'scheduled', 'processing']
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    });
    
    // Nếu không có tác vụ đồng bộ tồn kho nào đang chờ, tạo mới một tác vụ
    if (pendingInventoryTasks.length === 0) {
      // Đã giảm log này
      // console.log('[Worker] Không có tác vụ đồng bộ tồn kho đang chờ. Tạo tác vụ mới...');
      
      // Lấy cài đặt để biết khoảng thời gian đồng bộ
      const settings = await getSettings();
      const syncInterval = parseInt(settings.sync_interval || '30', 10);
      
      // Tính thời gian cho lần đồng bộ tiếp theo
      const now = new Date();
      const nextSyncTime = new Date(now.getTime() + syncInterval * 60 * 1000);
      
      // Tìm tất cả sản phẩm đã mapping
      const products = await prisma.productMapping.count();
      
      // Tạo tác vụ đồng bộ mới với lịch cụ thể
      const syncLog = await prisma.syncLog.create({
        data: {
          action: 'schedule_inventory',
          status: 'scheduled',
          message: `Lên lịch đồng bộ tồn kho ${products} sản phẩm`,
          details: JSON.stringify({
            scheduledTime: nextSyncTime.toISOString(),
            autoScheduled: true,
            productCount: products
          }),
          createdBy: 'system'
        }
      });
      
      // Giảm chi tiết log, chỉ để lại các log quan trọng
      console.log(`[Worker] Đã lên lịch đồng bộ tồn kho: ${nextSyncTime.toLocaleString()}`);
      
      // Thêm công việc kiểm tra vào hàng đợi để xử lý tác vụ mới
      await scheduledQueue.add('check-scheduled', {
        forceCheck: true,
        timestamp: new Date().toISOString()
      });
    } else {
      // Không cần log chi tiết task đang chờ
      // console.log(`[Worker] Đã có tác vụ đồng bộ tồn kho đang chờ xử lý (ID: ${pendingInventoryTasks[0].id}, Status: ${pendingInventoryTasks[0].status}). Bỏ qua việc tạo tác vụ mới.`);
    }
  } catch (error) {
    console.error('[Worker] Lỗi khi lên lịch đồng bộ tiếp theo:', error);
  }
}

// Xử lý sự kiện từ workers
scheduledTasksWorker.on('completed', (job) => {
  // Không cần log chi tiết từng tác vụ hoàn thành
  // console.log(`[Worker] Hoàn thành tác vụ kiểm tra lịch: ${job.id}`);
});

scheduledTasksWorker.on('failed', (job, error) => {
  console.error(`[Worker] Lỗi xử lý tác vụ kiểm tra lịch: ${job.id}`, error);
});

syncProductsWorker.on('completed', (job) => {
  // Không cần log chi tiết từng tác vụ hoàn thành
  // console.log(`[Worker] Hoàn thành tác vụ đồng bộ: ${job.id}`);
});

syncProductsWorker.on('failed', (job, error) => {
  console.error(`[Worker] Lỗi xử lý tác vụ đồng bộ: ${job.id}`, error);
});

// Bắt đầu worker
startWorker();

// Xử lý khi process bị tắt
process.on('SIGINT', async () => {
  console.log('[Worker] Đang dừng worker...');
  workerStatus.isRunning = false;
  await updateWorkerStatus();
  
  // Đóng các workers
  await scheduledTasksWorker.close();
  await syncProductsWorker.close();
  
  // Đóng kết nối Prisma
  await prisma.$disconnect();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] Đang dừng worker...');
  workerStatus.isRunning = false;
  await updateWorkerStatus();
  
  // Đóng các workers
  await scheduledTasksWorker.close();
  await syncProductsWorker.close();
  
  // Đóng kết nối Prisma
  await prisma.$disconnect();
  
  process.exit(0);
});

// Xử lý lỗi không bắt được
process.on('uncaughtException', async (error) => {
  console.error('[Worker] Lỗi không bắt được:', error);
  
  // Cập nhật trạng thái
  try {
    await prisma.setting.upsert({
      where: { key: 'worker_error' },
      update: { 
        value: JSON.stringify({
          time: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        })
      },
      create: {
        key: 'worker_error',
        value: JSON.stringify({
          time: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        }),
        group: 'system'
      }
    });
  } catch (e) {
    console.error('[Worker] Không thể ghi lỗi vào database:', e);
  }
  
  // Worker tiếp tục chạy
});

// Hàm gửi cảnh báo cho admin
async function sendAdminAlert(message, errorCount) {
  try {
    console.error(`[ALERT] ${message}`);
    
    // Lưu cảnh báo vào database
    await prisma.setting.upsert({
      where: { key: 'last_sync_error_alert' },
      update: {
        value: JSON.stringify({
          message,
          errorCount,
          timestamp: new Date().toISOString()
        })
      },
      create: {
        key: 'last_sync_error_alert',
        value: JSON.stringify({
          message,
          errorCount,
          timestamp: new Date().toISOString()
        }),
        group: 'system'
      }
    });
    
    // Các cảnh báo khác có thể thêm vào đây (email, webhook, etc.)
  } catch (error) {
    console.error(`[ALERT] Lỗi khi gửi cảnh báo:`, error);
  }
}

// Thêm hàm theo dõi lỗi liên tiếp
function trackSyncError(error) {
  consecutiveErrors++;
  console.error(`[Worker] Lỗi đồng bộ (${consecutiveErrors}/${ERROR_THRESHOLD}):`, error.message);
  
  if (consecutiveErrors >= ERROR_THRESHOLD) {
    sendAdminAlert(`Phát hiện ${consecutiveErrors} lỗi đồng bộ liên tiếp. Cần kiểm tra hệ thống!`, consecutiveErrors);
    consecutiveErrors = 0; // Reset sau khi đã gửi cảnh báo
  }
}

function trackSyncSuccess() {
  if (consecutiveErrors > 0) {
    console.log(`[Worker] Đồng bộ thành công sau ${consecutiveErrors} lỗi liên tiếp`);
  }
  consecutiveErrors = 0; // Reset counter khi có thành công
}
  