import { createClient } from 'redis';

// Redis configuration từ biến môi trường
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Thời gian khóa mặc định (30 giây)
const DEFAULT_LOCK_TTL = 30;

// Tạo kết nối Redis
const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD
});

// Theo dõi trạng thái kết nối
let isRedisConnected = false;

// Kết nối Redis khi cần
async function ensureRedisConnection() {
  if (!isRedisConnected) {
    try {
      await redisClient.connect();
      isRedisConnected = true;
      console.log('[REDIS] Đã kết nối với Redis server');
    } catch (error) {
      console.error('[REDIS] Lỗi kết nối Redis:', error);
      throw error;
    }
  }
}

// Lua script cho việc unlock an toàn (chỉ xóa khóa nếu nó thuộc về chúng ta)
const unlockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Lớp DistributedLock quản lý phương thức khóa phân tán sử dụng Redis
 */
export class DistributedLock {
  private lockKey: string;
  private lockValue: string;
  private ttl: number;
  private lockAcquired: boolean = false;
  private renewalInterval: NodeJS.Timeout | null = null;

  /**
   * Khởi tạo đối tượng khóa
   * @param resourceId ID của tài nguyên cần khóa
   * @param ttl Thời gian hết hạn cho khóa (giây)
   */
  constructor(resourceId: string, ttl: number = DEFAULT_LOCK_TTL) {
    this.lockKey = `lock:${resourceId}`;
    this.lockValue = `${Date.now()}-${Math.random().toString(36).substr(2, 10)}`;
    this.ttl = ttl;
  }

  /**
   * Thử lấy khóa với thời gian thử lại
   * @param retries Số lần thử lại tối đa
   * @param retryDelay Thời gian chờ giữa các lần thử (ms)
   * @param skipIfLocked Bỏ qua nếu đã bị khóa (không thử lại)
   * @returns Kết quả lấy khóa: true nếu thành công, false nếu không
   */
  async acquire(retries: number = 5, retryDelay: number = 200, skipIfLocked: boolean = false): Promise<boolean> {
    await ensureRedisConnection();

    // Nếu đã có khóa, trả về true ngay
    if (this.lockAcquired) {
      return true;
    }

    let attempts = 0;
    
    while (attempts <= retries) {
      try {
        // Thử thiết lập khóa với NX (chỉ thiết lập nếu không tồn tại) và PX (thời gian hết hạn tính bằng mili giây)
        const result = await redisClient.set(this.lockKey, this.lockValue, {
          NX: true,
          EX: this.ttl
        });

        // Nếu SET trả về 'OK', chúng ta đã lấy được khóa
        if (result === 'OK') {
          this.lockAcquired = true;
          this._startRenewalTask();
          return true;
        }
        
        // Nếu cấu hình là bỏ qua khi đã khóa, không thử lại
        if (skipIfLocked) {
          console.log(`[LOCK] Tài nguyên ${this.lockKey} đã bị khóa, không thử lại`);
          return false;
        }

        // Tăng số lần thử và chờ trước khi thử lại
        attempts++;
        if (attempts <= retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`[LOCK] Lỗi khi thử lấy khóa:`, error);
        attempts++;
        if (attempts <= retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    return false;
  }

  /**
   * Giải phóng khóa
   * @returns true nếu khóa được giải phóng thành công
   */
  async release(): Promise<boolean> {
    if (!this.lockAcquired) {
      return true; // Không có khóa để giải phóng
    }

    try {
      await ensureRedisConnection();

      // Dừng tác vụ tự động gia hạn nếu có
      this._stopRenewalTask();

      // Sử dụng Lua script để đảm bảo chỉ xóa khóa nếu chúng ta sở hữu nó
      const result = await redisClient.eval(
        unlockScript,
        {
          keys: [this.lockKey],
          arguments: [this.lockValue]
        }
      );

      this.lockAcquired = false;
      return result === 1;
    } catch (error) {
      console.error(`[LOCK] Lỗi khi giải phóng khóa:`, error);
      return false;
    }
  }

  /**
   * Kiểm tra xem khóa có được lấy thành công không
   */
  isAcquired(): boolean {
    return this.lockAcquired;
  }

  /**
   * Bắt đầu tác vụ định kỳ gia hạn khóa
   */
  private _startRenewalTask(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
    }

    // Gia hạn khóa trước khi nó hết hạn (khoảng 2/3 thời gian TTL)
    const renewalTime = Math.floor((this.ttl * 1000) * 0.66);
    
    this.renewalInterval = setInterval(async () => {
      try {
        if (this.lockAcquired) {
          await redisClient.expire(this.lockKey, this.ttl);
        } else {
          this._stopRenewalTask();
        }
      } catch (error) {
        console.error(`[LOCK] Lỗi khi gia hạn khóa:`, error);
      }
    }, renewalTime);
  }

  /**
   * Dừng tác vụ gia hạn khóa
   */
  private _stopRenewalTask(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
  }
}

/**
 * Thực thi một hàm với khóa phân tán
 * @param resourceId ID của tài nguyên cần khóa
 * @param fn Hàm cần thực thi trong khi giữ khóa
 * @param ttl Thời gian hết hạn cho khóa (giây)
 * @param skipIfLocked Có bỏ qua nếu đã bị khóa không
 */
export async function withLock<T>(
  resourceId: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_LOCK_TTL,
  skipIfLocked: boolean = false
): Promise<{ result?: T; error?: Error; skipped: boolean }> {
  const lock = new DistributedLock(resourceId, ttl);
  
  try {
    // Thử lấy khóa
    const acquired = await lock.acquire(5, 200, skipIfLocked);
    
    // Nếu không lấy được khóa và cấu hình là bỏ qua
    if (!acquired) {
      return { skipped: true };
    }
    
    // Thực thi hàm được cung cấp
    const result = await fn();
    
    return { result, skipped: false };
  } catch (error: any) {
    // Bắt lỗi trong quá trình thực thi
    return { error, skipped: false };
  } finally {
    // Luôn giải phóng khóa sau khi hoàn thành
    await lock.release();
  }
}

export default {
  DistributedLock,
  withLock
}; 