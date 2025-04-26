import Queue from 'bull';
import { PrismaClient } from '@prisma/client';

// Kết nối đến Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD
};

// Tạo Prisma client
const prisma = new PrismaClient();

// Tạo queue cho đồng bộ sản phẩm
export const syncQueue = new Queue('product-sync', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,  // Giữ lại 100 job đã hoàn thành gần nhất
    removeOnFail: 200       // Giữ lại 200 job thất bại gần nhất
  }
});

// Biến lưu trạng thái khởi tạo
let isInitialized = false;

// Hàm lấy cài đặt từ database
export async function getSettings() {
  try {
    const settingsData = await prisma.setting.findMany();
    
    const settings: Record<string, string> = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    return {
      shopify_access_token: settings.shopify_access_token || process.env.SHOPIFY_ACCESS_TOKEN || '',
      shopify_store: settings.shopify_store || process.env.SHOPIFY_STORE || '',
      shopify_location_id: settings.shopify_location_id || process.env.SHOPIFY_LOCATION_ID || '',
      nhanh_api_key: settings.nhanh_api_key || process.env.NHANH_API_KEY || '',
      nhanh_business_id: settings.nhanh_business_id || process.env.NHANH_BUSINESS_ID || '',
      nhanh_app_id: settings.nhanh_app_id || process.env.NHANH_APP_ID || '',
      sync_interval: settings.sync_interval || '30',
      sync_auto: settings.sync_auto || 'false'
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      shopify_access_token: process.env.SHOPIFY_ACCESS_TOKEN || '',
      shopify_store: process.env.SHOPIFY_STORE || '',
      shopify_location_id: process.env.SHOPIFY_LOCATION_ID || '',
      nhanh_api_key: process.env.NHANH_API_KEY || '',
      nhanh_business_id: process.env.NHANH_BUSINESS_ID || '',
      nhanh_app_id: process.env.NHANH_APP_ID || '',
      sync_interval: '30',
      sync_auto: 'false'
    };
  }
}

// Hàm lên lịch đồng bộ
export async function scheduleSyncJob(syncType: 'all' | 'inventory' | 'price', username: string, delayMinutes: number = 30, productIds: number[] = []) {
  const delay = delayMinutes * 60 * 1000; // Chuyển đổi phút thành mili giây
  
  // Tạo thời gian dự kiến thực hiện
  const scheduledTime = new Date(Date.now() + delay);
  
  // Tạo bản ghi lịch sử đồng bộ
  const syncLog = await prisma.syncLog.create({
    data: {
      action: `schedule_${syncType}`,
      status: 'scheduled',
      message: `Đã lên lịch đồng bộ ${syncType} sau ${delayMinutes} phút`,
      details: JSON.stringify({
        syncType,
        scheduledTime: scheduledTime.toISOString(),
        productIds: productIds.length > 0 ? productIds : undefined
      }),
      createdBy: username
    }
  });
  
  // Thêm vào queue với delay
  const job = await syncQueue.add(
    'sync-products', 
    {
      syncType,
      username,
      syncAllProducts: productIds.length === 0,
      productIds: productIds.length > 0 ? productIds : undefined,
      scheduledLogId: syncLog.id
    },
    { delay }
  );
  
  console.log(`[Queue] Đã lên lịch đồng bộ ${syncType}, job ID: ${job.id}, thực hiện lúc: ${scheduledTime.toLocaleString()}`);
  
  return {
    id: syncLog.id,
    jobId: job.id,
    scheduledTime
  };
}

// Khởi tạo và cài đặt cron job kiểm tra tác vụ đã lên lịch
export function initScheduleChecker() {
  if (isInitialized) return;
  
  // Cron job kiểm tra các tác vụ đã lên lịch mỗi phút
  syncQueue.add('check-scheduled', {}, {
    repeat: { cron: '* * * * *' }, // Mỗi phút
    removeOnComplete: true
  });
  
  isInitialized = true;
  console.log('[Queue] Đã khởi tạo schedule checker');
}

// Lấy danh sách công việc đang chờ xử lý
export async function getPendingJobs() {
  const waiting = await syncQueue.getWaiting();
  const active = await syncQueue.getActive();
  
  return {
    waiting: waiting.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade
    })),
    active: active.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      attemptsMade: job.attemptsMade,
      progress: job.progress()
    }))
  };
}

// Khởi tạo processor
export function initSyncProcessors() {
  if (isInitialized) return;
  
  console.log('[Queue] Khởi tạo các processor cho hệ thống đồng bộ...');
  
  // Khởi tạo schedule checker
  initScheduleChecker();
  
  isInitialized = true;
} 