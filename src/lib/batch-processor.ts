import { PrismaClient } from '@prisma/client';
import getWorkerPool from './worker-threads';
import { chunk } from 'lodash';
import logger from './logger';
import metrics from './metrics';

// Khởi tạo logger cho module này
const log = logger.createLogger('batch-processor');

// Khởi tạo Prisma client
const prisma = new PrismaClient();

// Cấu hình batch mặc định
const DEFAULT_BATCH_SIZE = 20; // Kích thước batch mặc định
const MIN_BATCH_SIZE = 5; // Kích thước batch tối thiểu
const MAX_BATCH_SIZE = 50; // Kích thước batch tối đa
const BATCH_SIZE_STEP = 5; // Bước tăng/giảm kích thước batch

// Ngưỡng hiệu suất để điều chỉnh kích thước batch
const PERFORMANCE_THRESHOLD_GOOD = 80; // Tỉ lệ thành công cao (%)
const PERFORMANCE_THRESHOLD_BAD = 50; // Tỉ lệ thành công thấp (%)

// Thời gian giới hạn xử lý mỗi sản phẩm
const PRODUCT_TIMEOUT_MS = 30000; // 30 giây

// Thời gian backoff khi gặp lỗi
const BACKOFF_INITIAL_MS = 1000; // 1 giây ban đầu
const BACKOFF_MAX_MS = 30000; // Tối đa 30 giây
const BACKOFF_FACTOR = 1.5; // Hệ số tăng

interface SyncStats {
  total: number;
  success: number;
  error: number;
  skipped: number;
  adaptiveBatchSize?: number;
  averageExecutionTime?: number;
}

interface PriorityProduct {
  product: any;
  priority: number;
  nhanhData: any;
}

/**
 * Phân tích độ ưu tiên của sản phẩm dựa trên các tiêu chí
 */
async function calculateProductPriority(products: any[]): Promise<PriorityProduct[]> {
  const timer = log.startTimer('calculateProductPriority');
  
  // Lấy lịch sử đồng bộ của tất cả sản phẩm
  const productIds = products.map(p => p.id);
  const syncLogs = await prisma.syncLog.findMany({
    where: {
      productMappingId: { in: productIds },
      action: { startsWith: 'sync_' }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Nhóm logs theo productMappingId
  const productSyncLogs: Record<number, any[]> = {};
  for (const log of syncLogs) {
    if (!productSyncLogs[log.productMappingId!]) {
      productSyncLogs[log.productMappingId!] = [];
    }
    productSyncLogs[log.productMappingId!].push(log);
  }

  const prioritizedProducts: PriorityProduct[] = [];
  const currentTime = new Date().getTime();

  for (const product of products) {
    let priority = 0;
    let nhanhData;

    try {
      nhanhData = JSON.parse(product.nhanhData);
    } catch (error) {
      log.error(`Không thể phân tích dữ liệu nhanhData cho sản phẩm ID=${product.id}`, { productId: product.id });
      nhanhData = {};
    }

    // 1. Sản phẩm chưa từng đồng bộ có độ ưu tiên cao
    const logs = productSyncLogs[product.id] || [];
    if (logs.length === 0) {
      priority += 50; // Sản phẩm mới chưa đồng bộ
    } else {
      // 2. Thời gian từ lần đồng bộ cuối cùng
      const lastSync = new Date(logs[0].createdAt).getTime();
      const hoursSinceLastSync = (currentTime - lastSync) / (1000 * 60 * 60);
      
      // Ưu tiên sản phẩm lâu chưa đồng bộ (mỗi giờ +1 điểm, tối đa 48 điểm)
      priority += Math.min(hoursSinceLastSync, 48);

      // 3. Lỗi gần đây có độ ưu tiên thấp (để tránh quá nhiều retry)
      if (logs[0].status === 'error') {
        const errorTimeDiff = (currentTime - new Date(logs[0].createdAt).getTime()) / 1000;
        if (errorTimeDiff < 300) { // 5 phút gần đây
          priority -= 20; // Giảm ưu tiên
        } else if (errorTimeDiff < 3600) { // 1 giờ gần đây
          priority -= 10;
        }
      }

      // 4. Sản phẩm bị lỗi liên tục nhưng đã một thời gian dài cần được thử lại
      let consecutiveErrors = 0;
      for (const log of logs) {
        if (log.status === 'error') {
          consecutiveErrors++;
        } else {
          break;
        }
      }

      if (consecutiveErrors > 3 && hoursSinceLastSync > 24) {
        priority += 15; // Đã lâu không thành công, cần thử lại
      }
    }

    // 5. Tồn kho thấp hoặc mới cập nhật có độ ưu tiên cao
    if (nhanhData.inventory && nhanhData.inventory.remain <= 5) {
      priority += 20; // Sản phẩm gần hết hàng
    }

    // 6. Ưu tiên hóa theo thời gian trong ngày
    const currentHour = new Date().getHours();
    if (currentHour >= 7 && currentHour <= 10) {
      // Buổi sáng: ưu tiên sản phẩm mới
      if (logs.length === 0) {
        priority += 10;
      }
    } else if (currentHour >= 11 && currentHour <= 14) {
      // Buổi trưa: ưu tiên sản phẩm bán chạy
      if (nhanhData.inventory && nhanhData.inventory.nonStop) {
        priority += 15; // Sản phẩm giao liên tục
      }
    }

    prioritizedProducts.push({
      product,
      priority,
      nhanhData
    });
  }

  // Sắp xếp theo độ ưu tiên giảm dần
  const result = prioritizedProducts.sort((a, b) => b.priority - a.priority);
  
  const duration = timer();
  log.debug(`Đã tính toán ưu tiên cho ${products.length} sản phẩm trong ${duration.toFixed(2)}ms`);
  
  return result;
}

/**
 * Điều chỉnh kích thước batch dựa trên hiệu suất
 */
function calculateNextBatchSize(currentBatchSize: number, successRate: number, averageExecutionTime: number): number {
  if (successRate >= PERFORMANCE_THRESHOLD_GOOD && averageExecutionTime < 10000) {
    // Hiệu suất tốt, tăng kích thước batch
    return Math.min(currentBatchSize + BATCH_SIZE_STEP, MAX_BATCH_SIZE);
  } else if (successRate < PERFORMANCE_THRESHOLD_BAD || averageExecutionTime > 20000) {
    // Hiệu suất kém, giảm kích thước batch
    return Math.max(currentBatchSize - BATCH_SIZE_STEP, MIN_BATCH_SIZE);
  }
  
  // Giữ nguyên kích thước batch nếu hiệu suất trung bình
  return currentBatchSize;
}

/**
 * Tính toán thời gian backoff khi gặp lỗi
 */
function calculateBackoffTime(errorCount: number): number {
  return Math.min(BACKOFF_INITIAL_MS * Math.pow(BACKOFF_FACTOR, errorCount), BACKOFF_MAX_MS);
}

/**
 * Xử lý đồng bộ theo batch với worker threads
 */
export async function processBatchSync(
  productIds: number[],
  syncType: 'inventory' | 'price' | 'all',
  username: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
  syncLogId?: number
): Promise<SyncStats> {
  // Khởi tạo correlation ID để theo dõi toàn bộ quá trình này
  const correlationId = logger.initCorrelationId();
  
  log.info(`Bắt đầu đồng bộ hàng loạt cho ${productIds.length} sản phẩm, loại: ${syncType}`, { 
    productCount: productIds.length, 
    syncType, 
    initialBatchSize: batchSize,
    syncLogId
  });
  
  const syncTimer = metrics.trackDuration(
    metrics.metrics.syncDuration,
    { type: syncType },
    async () => {
      // Nếu không có sản phẩm nào
      if (productIds.length === 0) {
        return { total: 0, success: 0, error: 0, skipped: 0 };
      }
      
      // Tạo hoặc lấy syncLog
      let syncLog;
      if (syncLogId) {
        syncLog = await prisma.syncLog.findUnique({
          where: { id: syncLogId }
        });
        
        if (syncLog) {
          await prisma.syncLog.update({
            where: { id: syncLogId },
            data: {
              status: 'running',
              message: `Đang đồng bộ ${syncType} cho ${productIds.length} sản phẩm`,
              details: JSON.stringify({
                total: productIds.length,
                syncType,
                startTime: new Date().toISOString(),
                correlationId
              })
            }
          });
        }
      }
      
      if (!syncLog) {
        syncLog = await prisma.syncLog.create({
          data: {
            action: `sync_${syncType}`,
            status: 'running',
            message: `Đang đồng bộ ${syncType} cho ${productIds.length} sản phẩm`,
            details: JSON.stringify({
              total: productIds.length,
              syncType,
              startTime: new Date().toISOString(),
              correlationId
            }),
            createdBy: username
          }
        });
      }
      
      // Lấy settings từ database
      const settingsData = await prisma.setting.findMany();
      const settings: Record<string, string> = {};
      settingsData.forEach(setting => {
        settings[setting.key] = setting.value;
      });
      
      // Lấy thông tin sản phẩm
      const products = await prisma.productMapping.findMany({
        where: {
          id: { in: productIds }
        }
      });
      
      // Tính toán độ ưu tiên cho sản phẩm
      const prioritizedProducts = await calculateProductPriority(products);
      
      // Thống kê kết quả
      const stats: SyncStats = {
        total: products.length,
        success: 0,
        error: 0,
        skipped: 0,
        adaptiveBatchSize: batchSize,
        averageExecutionTime: 0
      };
      
      // Lấy worker pool
      const workerPool = getWorkerPool();
      
      // Danh sách thời gian thực thi
      const executionTimes: number[] = [];
      // Lưu trữ số lỗi liên tiếp
      let consecutiveErrors = 0;
      // Kích thước batch hiện tại (có thể thay đổi)
      let currentBatchSize = batchSize;
      
      // Cập nhật metrics ban đầu
      metrics.updateBatchSize(currentBatchSize);
      
      // Lấy các sản phẩm đã được ưu tiên hóa
      const sortedProducts = prioritizedProducts.map(p => p.product);
      
      // Chia thành các batch nhỏ hơn để xử lý 
      // Lưu ý: kích thước batch có thể thay đổi trong quá trình chạy, nhưng bắt đầu với currentBatchSize
      let batches = chunk(sortedProducts, currentBatchSize);
      
      // Xử lý từng batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const progress = Math.round(((batchIndex) / batches.length) * 100);
        
        log.info(`Đang xử lý batch ${batchIndex + 1}/${batches.length}, tiến độ: ${progress}%, kích thước batch: ${currentBatchSize}`, {
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          progress,
          batchSize: currentBatchSize,
          correlationId
        });
        
        // Cập nhật trạng thái
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            details: JSON.stringify({
              ...JSON.parse(syncLog.details || '{}'),
              progress,
              currentBatch: batchIndex + 1,
              totalBatches: batches.length,
              stats,
              adaptiveBatchSize: currentBatchSize
            })
          }
        });
        
        // Nếu có quá nhiều lỗi liên tiếp, áp dụng backoff
        if (consecutiveErrors > 2) {
          const backoffTime = calculateBackoffTime(consecutiveErrors);
          log.warn(`Đang áp dụng backoff sau ${consecutiveErrors} lỗi liên tiếp. Chờ ${backoffTime}ms...`, {
            consecutiveErrors,
            backoffTime,
            batchIndex: batchIndex + 1
          });
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
        
        // Tạo danh sách các tác vụ để xử lý bằng worker
        const tasks = [];
        const batchStartTime = Date.now();
        
        for (const product of batch) {
          // Phân tích dữ liệu Nhanh.vn
          let nhanhData;
          try {
            nhanhData = JSON.parse(product.nhanhData);
          } catch (error) {
            log.error(`Không thể phân tích dữ liệu nhanhData cho sản phẩm ID=${product.id}`, {
              productId: product.id,
              error
            });
            stats.error++;
            metrics.increment(metrics.metrics.errorCount, { module: 'batch-processor', type: 'parse-error' });
            continue;
          }
          
          // Chuẩn hóa Shopify ID
          let normalizedShopifyId = product.shopifyId;
          if (normalizedShopifyId && typeof normalizedShopifyId === 'string' && normalizedShopifyId.includes('gid://')) {
            const parts = normalizedShopifyId.split('/');
            normalizedShopifyId = parts.pop() || normalizedShopifyId;
          }
          
          const normalizedProduct = {
            ...product,
            shopifyId: normalizedShopifyId
          };
          
          // Thêm tác vụ đồng bộ dựa trên loại đồng bộ
          if (syncType === 'all' || syncType === 'inventory') {
            tasks.push({
              task: 'syncInventory', 
              params: [normalizedProduct, nhanhData, settings, username],
              options: {
                priority: 1,
                timeout: PRODUCT_TIMEOUT_MS,
                useDistributedLock: true,
                lockResourceId: `product:${product.id}`
              }
            });
          }
          
          if (syncType === 'all' || syncType === 'price') {
            tasks.push({
              task: 'syncPrice',
              params: [normalizedProduct, nhanhData, settings, username],
              options: {
                priority: syncType === 'all' ? 0 : 1, // Ưu tiên thấp hơn nếu đồng bộ all
                timeout: PRODUCT_TIMEOUT_MS,
                useDistributedLock: true,
                lockResourceId: `product:${product.id}:price` 
              }
            });
          }
        }
        
        // Đếm số lỗi trong batch này
        let batchErrors = 0;
        
        try {
          // Xử lý song song các tác vụ trong batch với distributed locking
          const results = await Promise.allSettled(
            tasks.map(task => workerPool.runTask(
              task.task, 
              task.params,
              task.options
            ))
          );
          
          // Tính thời gian thực thi trung bình cho batch này
          const batchEndTime = Date.now();
          const batchExecutionTime = batchEndTime - batchStartTime;
          const avgExecutionTimePerTask = tasks.length > 0 ? batchExecutionTime / tasks.length : 0;
          executionTimes.push(avgExecutionTimePerTask);
          
          // Tính toán thời gian thực thi trung bình tổng thể
          stats.averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
          
          // Phân tích kết quả
          for (const result of results) {
            if (result.status === 'fulfilled') {
              const taskResult = result.value;
              
              if (taskResult && taskResult.skipped) {
                stats.skipped++;
              } else if (taskResult && taskResult.success) {
                stats.success++;
              } else {
                stats.error++;
                batchErrors++;
                metrics.increment(metrics.metrics.errorCount, { module: 'batch-processor', type: 'task-error' });
              }
            } else {
              stats.error++;
              batchErrors++;
              metrics.increment(metrics.metrics.errorCount, { module: 'batch-processor', type: 'promise-rejection' });
            }
          }
          
          // Cập nhật biến theo dõi lỗi liên tiếp
          if (batchErrors > 0) {
            consecutiveErrors++;
          } else {
            consecutiveErrors = 0;
          }
          
          // Tính toán tỷ lệ thành công cho batch này
          const batchSuccessRate = tasks.length > 0 ? 
            ((results.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length / tasks.length) * 100) : 0;
          
          // Điều chỉnh kích thước batch dựa trên hiệu suất
          const newBatchSize = calculateNextBatchSize(
            currentBatchSize, 
            batchSuccessRate,
            avgExecutionTimePerTask
          );
          
          // Ghi log về kết quả batch
          log.info(`Batch ${batchIndex + 1} hoàn thành. Tỷ lệ thành công: ${batchSuccessRate.toFixed(1)}%, thời gian TB: ${avgExecutionTimePerTask.toFixed(0)}ms, kích thước batch mới: ${newBatchSize}`, {
            batchIndex: batchIndex + 1,
            batchSize: currentBatchSize,
            newBatchSize,
            batchSuccessRate: parseFloat(batchSuccessRate.toFixed(1)),
            avgExecutionTime: parseFloat(avgExecutionTimePerTask.toFixed(0)),
            tasksTotal: tasks.length,
            successCount: stats.success,
            errorCount: stats.error,
            skippedCount: stats.skipped
          });
          
          // Cập nhật kích thước batch
          currentBatchSize = newBatchSize;
          metrics.updateBatchSize(currentBatchSize);
          
          // Chia lại batch cho phần còn lại nếu kích thước batch thay đổi và còn nhiều batch
          if (batchIndex < batches.length - 2 && currentBatchSize !== batch.length) {
            const remainingProducts = sortedProducts.slice((batchIndex + 1) * batch.length);
            batches = [
              ...batches.slice(0, batchIndex + 1),
              ...chunk(remainingProducts, currentBatchSize)
            ];
          }
          
        } catch (error: any) {
          log.error(`Lỗi khi xử lý batch:`, {
            error: error.message,
            stack: error.stack,
            batchIndex: batchIndex + 1,
            batchSize: currentBatchSize
          });
          
          consecutiveErrors++;
          stats.error += batch.length; // Coi như cả batch bị lỗi
          metrics.increment(metrics.metrics.errorCount, { module: 'batch-processor', type: 'batch-error' }, batch.length);
        }
        
        // Cập nhật log sau mỗi batch
        if (batchIndex % 2 === 0 || batchIndex === batches.length - 1) {
          await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
              details: JSON.stringify({
                ...JSON.parse(syncLog.details || '{}'),
                stats,
                progress,
                currentBatch: batchIndex + 1,
                totalBatches: batches.length,
                adaptiveBatchSize: currentBatchSize,
                averageExecutionTime: stats.averageExecutionTime
              })
            }
          });
        }
      }
      
      // Cập nhật trạng thái hoàn thành
      const endTime = new Date();
      const startTime = new Date(JSON.parse(syncLog.details || '{}').startTime || new Date());
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          message: `Hoàn thành đồng bộ, kết quả: ${stats.success}/${stats.total} thành công`,
          details: JSON.stringify({
            ...JSON.parse(syncLog.details || '{}'),
            stats,
            progress: 100,
            endTime: endTime.toISOString(),
            duration,
            syncType,
            adaptiveBatchSizes: executionTimes.length > 0 ? stats.adaptiveBatchSize : batchSize
          })
        }
      });
      
      log.info(`Hoàn thành đồng bộ ${syncType}, kết quả: ${stats.success}/${stats.total} thành công, ${stats.error} lỗi, ${stats.skipped} bỏ qua`, {
        syncType,
        success: stats.success,
        error: stats.error,
        skipped: stats.skipped,
        total: stats.total,
        duration,
        finalBatchSize: stats.adaptiveBatchSize
      });
      
      // Cập nhật metrics
      metrics.increment(metrics.metrics.syncTotal, { type: syncType, status: 'success' }, stats.success);
      metrics.increment(metrics.metrics.syncTotal, { type: syncType, status: 'error' }, stats.error);
      metrics.increment(metrics.metrics.syncTotal, { type: syncType, status: 'skipped' }, stats.skipped);
      
      return stats;
    }
  );
  
  return syncTimer;
}

/**
 * Tạo transaction để đảm bảo tính nhất quán khi lưu trữ
 */
export async function saveResultsWithTransaction(
  productId: number, 
  syncLogData: any,
  productData: any
) {
  // Sử dụng transaction để đảm bảo tính nhất quán dữ liệu
  return await prisma.$transaction(async (tx) => {
    // Tạo log
    const syncLog = await tx.syncLog.create({
      data: syncLogData
    });
    
    // Cập nhật sản phẩm
    const product = await tx.productMapping.update({
      where: { id: productId },
      data: productData
    });
    
    return { syncLog, product };
  });
} 