const Queue = require('bull');
const Redis = require('ioredis');

// Cấu hình Redis lấy từ biến môi trường
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) {
      console.error('Không thể kết nối đến Redis sau nhiều lần thử');
      return null;
    }
    return Math.min(times * 200, 5000);
  }
};

// Tạo Redis client kiểm tra
const redis = new Redis(redisConfig);

// Tạo queue kiểm tra với tên giống như trong worker.js
const syncQueue = new Queue('product-sync', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

async function testQueue() {
  try {
    console.log('===== KIỂM TRA HÀNG ĐỢI WORKER =====');
    
    // Kiểm tra kết nối Redis
    console.log('Kiểm tra kết nối Redis...');
    const pingResult = await redis.ping();
    console.log(`- Redis phản hồi: ${pingResult}`);
    
    // Kiểm tra hàng đợi
    console.log('\nKiểm tra hàng đợi Bull Queue...');
    const queueStatus = await syncQueue.getJobCounts();
    console.log('- Trạng thái hàng đợi:', queueStatus);
    
    // Lấy danh sách các công việc đang chờ
    const pendingJobs = await syncQueue.getWaiting();
    console.log(`- Số công việc đang chờ: ${pendingJobs.length}`);
    if (pendingJobs.length > 0) {
      console.log('  Chi tiết công việc đang chờ:');
      pendingJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ID: ${job.id}, Loại: ${job.name}, Dữ liệu:`, job.data);
      });
    }
    
    // Lấy danh sách các công việc đang xử lý
    const activeJobs = await syncQueue.getActive();
    console.log(`- Số công việc đang xử lý: ${activeJobs.length}`);
    if (activeJobs.length > 0) {
      console.log('  Chi tiết công việc đang xử lý:');
      activeJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ID: ${job.id}, Loại: ${job.name}, Dữ liệu:`, job.data);
      });
    }
    
    // Lấy danh sách các công việc thất bại
    const failedJobs = await syncQueue.getFailed();
    console.log(`- Số công việc thất bại: ${failedJobs.length}`);
    if (failedJobs.length > 0) {
      console.log('  Chi tiết công việc thất bại:');
      failedJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ID: ${job.id}, Loại: ${job.name}, Lỗi:`, job.failedReason);
      });
    }
    
    // Thêm công việc kiểm tra
    console.log('\nThêm công việc kiểm tra vào hàng đợi...');
    await syncQueue.add('check-test', {
      testId: new Date().getTime(),
      message: 'Kiểm tra hàng đợi từ test-worker-queue.js'
    });
    console.log('- Đã thêm công việc kiểm tra thành công!');
    
    // Đọc lại trạng thái hàng đợi sau khi thêm
    const newQueueStatus = await syncQueue.getJobCounts();
    console.log('- Trạng thái hàng đợi sau khi thêm:', newQueueStatus);
    
    // Kiểm tra xem worker có đăng ký processor cho 'check-test'
    console.log('\nKiểm tra các processor đã đăng ký với hàng đợi này:');
    const handlers = await syncQueue.getWorkers();
    console.log(`- Số worker đang hoạt động: ${handlers.length}`);
    
    console.log('\nLƯU Ý: Nếu không có worker đang chạy hoặc không có processor đăng ký cho "check-test",');
    console.log('      công việc kiểm tra sẽ ở trạng thái "waiting" cho đến khi worker xử lý nó.');
    console.log('      Cần khởi động worker.js trong một cửa sổ khác để xử lý công việc này.');
    
    console.log('\nRESULT: Bull Queue đang làm việc tốt với Redis!');
  } catch (error) {
    console.error('\nLỗi khi kiểm tra hàng đợi:', error);
  } finally {
    console.log('\nĐóng kết nối...');
    await syncQueue.close();
    await redis.quit();
    console.log('===== KẾT THÚC KIỂM TRA =====');
  }
}

// Chạy kiểm tra
testQueue(); 