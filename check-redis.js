const Redis = require('ioredis');

async function checkRedisConnection() {
  console.log('===== KIỂM TRA KẾT NỐI REDIS =====');
  
  // Cấu hình Redis từ biến môi trường
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Không thể kết nối đến Redis sau nhiều lần thử');
        return null;
      }
      return Math.min(times * 200, 3000);
    }
  };
  
  console.log('Cấu hình Redis:');
  console.log(`Host: ${redisConfig.host}`);
  console.log(`Port: ${redisConfig.port}`);
  console.log(`Password: ${redisConfig.password ? '(đã cấu hình)' : '(không có)'}`);
  
  let redis;
  try {
    console.log('Đang tạo Redis client...');
    // Tạo Redis client
    redis = new Redis(redisConfig);
    
    // Bắt các events
    redis.on('connect', () => {
      console.log('Event: connect - Đã kết nối đến Redis');
    });
    
    redis.on('error', (err) => {
      console.error('Event: error - Lỗi Redis:', err);
    });
    
    redis.on('close', () => {
      console.log('Event: close - Kết nối Redis đã đóng');
    });
    
    // Kiểm tra kết nối
    console.log('\nĐang thử kết nối đến Redis...');
    console.log('Đang chờ phản hồi...');
    const ping = await redis.ping();
    console.log(`Kết nối thành công! Redis phản hồi: ${ping}`);
    
    // Thử thao tác với Redis
    const testKey = 'test_connection';
    await redis.set(testKey, 'Hello from APIModern Worker');
    const testValue = await redis.get(testKey);
    console.log(`Thử ghi/đọc dữ liệu thành công: ${testValue}`);
    
    // Xóa key test
    await redis.del(testKey);
    
    console.log('\nRESULT: Redis đang hoạt động tốt!');
  } catch (error) {
    console.error('\nLỗi kết nối Redis:', error);
    console.log('\nThông tin chi tiết lỗi:');
    console.log(`- Message: ${error.message}`);
    console.log(`- Code: ${error.code || 'N/A'}`);
    console.log(`- Stack: ${error.stack || 'N/A'}`);
    
    console.log('\nRESULT: Không thể kết nối đến Redis!');
    console.log('Vui lòng kiểm tra:');
    console.log('1. Redis đã được cài đặt và khởi động chưa? (redis-server đang chạy?)');
    console.log('2. Cấu hình host/port có chính xác không?');
    console.log('3. Tường lửa có chặn kết nối không?');
    console.log('4. Redis được cài bằng npm: npm install ioredis');
  } finally {
    // Đóng kết nối Redis
    if (redis) {
      console.log('Đóng kết nối Redis...');
      try {
        await redis.quit();
      } catch (e) {
        console.error('Lỗi khi đóng kết nối Redis:', e.message);
      }
    }
    console.log('===== KẾT THÚC KIỂM TRA =====');
  }
}

// Chạy hàm kiểm tra
checkRedisConnection();