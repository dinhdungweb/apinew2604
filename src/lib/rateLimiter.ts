/**
 * Interface xác định cấu trúc dữ liệu cho rate limit info
 */
export interface RateLimitInfo {
  remaining: number;      // Số request còn lại trong khoảng thời gian hiện tại
  limit: number;          // Tổng số request tối đa trong khoảng thời gian
  resetAt: number;        // Thời điểm reset rate limit (timestamp)
  retryAfter?: number;    // Thời gian cần đợi trước khi gửi request tiếp theo (ms)
}

/**
 * Base class quản lý giới hạn tốc độ (rate limiting) cho các API call.
 * Sử dụng token bucket algorithm kết hợp với thông tin phản hồi từ API.
 */
export abstract class BaseRateLimiter {
  protected bucket: number;
  protected lastRefill: number;
  protected maxBucket: number;
  protected refillRate: number; // tokens per ms
  protected queue: (() => void)[] = [];
  protected processingQueue: boolean = false;
  protected name: string;
  protected limitInfo: RateLimitInfo;
  protected backpressureThreshold: number = 0.2; // Ngưỡng 20% token còn lại sẽ kích hoạt backpressure

  constructor(
    name: string,
    maxRequestsPerSecond: number = 2,
    initialTokens: number = maxRequestsPerSecond
  ) {
    this.name = name;
    this.maxBucket = maxRequestsPerSecond;
    this.bucket = initialTokens;
    this.lastRefill = Date.now();
    this.refillRate = maxRequestsPerSecond / 1000; // Tokens per millisecond
    this.limitInfo = {
      remaining: initialTokens,
      limit: maxRequestsPerSecond,
      resetAt: Date.now() + 1000, // Giả định reset sau 1 giây
    };
  }

  /**
   * Yêu cầu token để thực hiện API call
   * @returns Promise sẽ resolve khi có token khả dụng
   */
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.refillBucket();
      
      if (this.bucket >= 1) {
        this.bucket -= 1;
        this.limitInfo.remaining = Math.floor(this.bucket);
        resolve();
      } else {
        // Thêm yêu cầu vào hàng đợi
        this.queue.push(resolve as () => void);
        
        // Bắt đầu xử lý hàng đợi nếu chưa có quá trình nào đang xử lý
        if (!this.processingQueue) {
          this.processQueue();
        }
      }
    });
  }

  /**
   * Thực hiện throttle yêu cầu API
   */
  async throttle(): Promise<void> {
    // Kiểm tra backpressure
    if (this.shouldApplyBackpressure()) {
      // Tăng thời gian chờ khi gần đến giới hạn
      const backpressureDelay = this.calculateBackpressureDelay();
      if (backpressureDelay > 0) {
        console.log(`[${this.name}] Áp dụng backpressure: đợi ${backpressureDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backpressureDelay));
      }
    }
    
    await this.acquire();
  }

  /**
   * Cập nhật thông tin rate limit từ response API
   * @param headers Response headers từ API
   */
  updateLimitFromResponse(headers: Headers | Record<string, string>): void {
    // Phương thức này sẽ được triển khai cụ thể trong các lớp con
    const limitInfo = this.extractLimitInfo(headers);
    
    if (limitInfo) {
      this.applyLimitInfo(limitInfo);
    }
  }

  /**
   * Trích xuất thông tin rate limit từ headers
   * @param headers Response headers từ API
   */
  protected abstract extractLimitInfo(headers: Headers | Record<string, string>): RateLimitInfo | null;

  /**
   * Áp dụng thông tin rate limit vào bộ quản lý
   */
  protected applyLimitInfo(info: RateLimitInfo): void {
    const now = Date.now();
    
    // Cập nhật thông tin limit
    this.limitInfo = {
      ...this.limitInfo,
      ...info
    };
    
    // Điều chỉnh bucket dựa trên thông tin từ API
    if (info.remaining !== undefined) {
      // Lấy giá trị nhỏ hơn giữa số token trong bucket hiện tại và số remaining từ API
      this.bucket = Math.min(this.bucket, info.remaining);
    }
    
    // Điều chỉnh tốc độ refill nếu có thông tin về limit và resetAt
    if (info.limit && info.resetAt && info.resetAt > now) {
      const timeToReset = info.resetAt - now;
      if (timeToReset > 0) {
        // Tính toán lại tốc độ refill: tokens/ms = limit / timeToReset
        this.refillRate = info.limit / timeToReset;
      }
    }
    
    // Nếu cần retry sau một khoảng thời gian
    if (info.retryAfter && info.retryAfter > 0) {
      // Đặt bucket về 0 để buộc các request phải đợi
      this.bucket = 0;
      // Đặt thời gian refill vào tương lai
      this.lastRefill = now + info.retryAfter;
      
      console.log(`[${this.name}] Rate limit hit, retry after: ${info.retryAfter}ms`);
    }
  }

  /**
   * Kiểm tra xem có nên áp dụng backpressure không
   */
  protected shouldApplyBackpressure(): boolean {
    // Áp dụng backpressure khi số token còn lại thấp hơn ngưỡng
    const remainingRatio = this.bucket / this.maxBucket;
    return remainingRatio < this.backpressureThreshold;
  }

  /**
   * Tính toán thời gian delay cho backpressure
   */
  protected calculateBackpressureDelay(): number {
    // Nếu không cần backpressure
    if (!this.shouldApplyBackpressure()) {
      return 0;
    }
    
    // Số token còn lại dưới dạng tỷ lệ (0-1)
    const remainingRatio = this.bucket / this.maxBucket;
    
    // Công thức tính delay:
    // - Khi gần hết token (remainingRatio gần 0), delay sẽ lớn
    // - Khi còn nhiều token (remainingRatio gần ngưỡng), delay sẽ nhỏ
    const baseDelay = 1000; // 1 giây
    
    // Tính toán hệ số: 1 khi remainingRatio=0, 0 khi remainingRatio=threshold
    const factor = Math.max(0, (this.backpressureThreshold - remainingRatio) / this.backpressureThreshold);
    
    // Áp dụng công thức
    return Math.round(baseDelay * factor * factor); // Sử dụng hàm bậc 2 để tăng nhanh khi gần 0
  }

  /**
   * Cập nhật số token trong bucket dựa trên thời gian trôi qua
   */
  protected refillBucket(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed > 0) {
      // Tính số token cần thêm vào dựa trên thời gian trôi qua
      const tokensToAdd = timePassed * this.refillRate;
      
      // Cập nhật số token trong bucket
      this.bucket = Math.min(this.maxBucket, this.bucket + tokensToAdd);
      this.lastRefill = now;
      
      // Cập nhật số remaining
      this.limitInfo.remaining = Math.floor(this.bucket);
    }
  }

  /**
   * Xử lý hàng đợi các yêu cầu
   */
  protected async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processingQueue = false;
      return;
    }

    this.processingQueue = true;
    
    // Đợi token sẵn có với exponential backoff
    let waitTime = 100; // Bắt đầu với 100ms
    
    while (this.bucket < 1 && this.queue.length > 0) {
      // Chờ thêm token
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Tăng thời gian chờ theo exponential backoff
      waitTime = Math.min(waitTime * 1.5, 1000); // Tối đa 1s
      
      // Làm mới bucket
      this.refillBucket();
    }
    
    // Giải phóng yêu cầu tiếp theo trong hàng đợi nếu có token sẵn có
    if (this.bucket >= 1 && this.queue.length > 0) {
      this.bucket -= 1;
      this.limitInfo.remaining = Math.floor(this.bucket);
      
      const nextResolve = this.queue.shift();
      if (nextResolve) nextResolve();
      
      // Xử lý yêu cầu tiếp theo sau một khoảng thời gian nhỏ
      setTimeout(() => this.processQueue(), 50);
    } else {
      this.processingQueue = false;
    }
  }

  /**
   * Lấy thông tin hiện tại về rate limit
   */
  getLimitInfo(): RateLimitInfo {
    return { ...this.limitInfo };
  }
}

/**
 * Class quản lý rate limit cho Shopify API
 */
export class ShopifyRateLimiter extends BaseRateLimiter {
  private static instance: ShopifyRateLimiter;

  constructor() {
    // Shopify API thường giới hạn ở 2 req/second cho REST API
    super('ShopifyAPI', 2, 2);
  }

  /**
   * Lấy instance của ShopifyRateLimiter (singleton pattern)
   */
  public static getInstance(): ShopifyRateLimiter {
    if (!ShopifyRateLimiter.instance) {
      ShopifyRateLimiter.instance = new ShopifyRateLimiter();
    }
    return ShopifyRateLimiter.instance;
  }

  /**
   * Trích xuất thông tin rate limit từ headers của Shopify
   * @param headers Response headers từ Shopify API
   */
  protected extractLimitInfo(headers: Headers | Record<string, string>): RateLimitInfo | null {
    try {
      let remaining: number | undefined;
      let limit: number | undefined;
      let resetAt: number | undefined;
      let retryAfter: number | undefined;
      
      // Xử lý cả hai loại: Headers object hoặc plain object
      const getHeader = (name: string): string | null => {
        if (headers instanceof Headers) {
          return headers.get(name);
        } else {
          // Kiểm tra các biến thể có thể có của header name (case insensitive)
          const normalizedName = name.toLowerCase();
          const key = Object.keys(headers).find(k => k.toLowerCase() === normalizedName);
          return key ? headers[key] : null;
        }
      };
      
      // X-Shopify-Shop-Api-Call-Limit: 39/40
      const apiCallLimit = getHeader('X-Shopify-Shop-Api-Call-Limit');
      if (apiCallLimit) {
        const [used, total] = apiCallLimit.split('/').map(Number);
        if (!isNaN(used) && !isNaN(total)) {
          remaining = total - used;
          limit = total;
        }
      }
      
      // Retry-After: in seconds
      const retryAfterHeader = getHeader('Retry-After');
      if (retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        if (!isNaN(seconds)) {
          retryAfter = seconds * 1000; // Convert to ms
          resetAt = Date.now() + retryAfter;
        }
      }
      
      // Nếu không có Retry-After, tính thời gian reset dựa trên giả định
      if (!resetAt && limit) {
        // Giả định bucket sẽ đầy sau (limit) giây (trường hợp xấu nhất)
        resetAt = Date.now() + limit * 1000;
      }
      
      // Nếu có đủ thông tin tối thiểu
      if (remaining !== undefined || retryAfter !== undefined) {
        return {
          remaining: remaining !== undefined ? remaining : 0,
          limit: limit !== undefined ? limit : this.maxBucket,
          resetAt: resetAt !== undefined ? resetAt : Date.now() + 1000,
          retryAfter
        };
      }
      
      return null;
    } catch (error) {
      console.error('[ShopifyRateLimiter] Error extracting limit info:', error);
      return null;
    }
  }
}

/**
 * Class quản lý rate limit cho Nhanh.vn API
 */
export class NhanhRateLimiter extends BaseRateLimiter {
  private static instance: NhanhRateLimiter;

  constructor() {
    // Giả định Nhanh.vn giới hạn ở 5 req/second
    super('NhanhAPI', 5, 5);
  }

  /**
   * Lấy instance của NhanhRateLimiter (singleton pattern)
   */
  public static getInstance(): NhanhRateLimiter {
    if (!NhanhRateLimiter.instance) {
      NhanhRateLimiter.instance = new NhanhRateLimiter();
    }
    return NhanhRateLimiter.instance;
  }

  /**
   * Trích xuất thông tin rate limit từ headers hoặc body response của Nhanh.vn
   */
  protected extractLimitInfo(headers: Headers | Record<string, string>, responseBody?: any): RateLimitInfo | null {
    try {
      // Xử lý cả hai loại: Headers object hoặc plain object
      const getHeader = (name: string): string | null => {
        if (headers instanceof Headers) {
          return headers.get(name);
        } else {
          const normalizedName = name.toLowerCase();
          const key = Object.keys(headers).find(k => k.toLowerCase() === normalizedName);
          return key ? headers[key] : null;
        }
      };
      
      // Kiểm tra các headers liên quan đến rate limit (nếu Nhanh.vn có)
      const rateLimitRemaining = getHeader('X-RateLimit-Remaining');
      const rateLimitLimit = getHeader('X-RateLimit-Limit');
      const rateLimitReset = getHeader('X-RateLimit-Reset');
      const retryAfter = getHeader('Retry-After');
      
      let limitInfo: Partial<RateLimitInfo> = {};
      
      if (rateLimitRemaining) limitInfo.remaining = Number(rateLimitRemaining);
      if (rateLimitLimit) limitInfo.limit = Number(rateLimitLimit);
      if (rateLimitReset) limitInfo.resetAt = Number(rateLimitReset) * 1000; // convert sec to ms
      if (retryAfter) limitInfo.retryAfter = Number(retryAfter) * 1000; // convert sec to ms
      
      // Kiểm tra lỗi rate limit trong body response
      if (responseBody && responseBody.code === 0) {
        // Thông báo lỗi có thể chứa thông tin về rate limit
        const errorMsg = responseBody.error || responseBody.message || '';
        
        // Kiểm tra nếu có lỗi rate limit
        if (errorMsg.includes('rate limit') || errorMsg.includes('quá nhiều yêu cầu')) {
          // Đặt giá trị mặc định nếu không có thông tin cụ thể
          limitInfo.remaining = 0;
          
          // Tìm thời gian retry trong thông báo lỗi
          const retryMatch = errorMsg.match(/(\d+)\s*(giây|s|seconds)/i);
          if (retryMatch) {
            const seconds = Number(retryMatch[1]);
            if (!isNaN(seconds)) {
              limitInfo.retryAfter = seconds * 1000;
              limitInfo.resetAt = Date.now() + limitInfo.retryAfter;
            }
          } else {
            // Nếu không có thông tin cụ thể, giả định 30 giây
            limitInfo.retryAfter = 30 * 1000;
            limitInfo.resetAt = Date.now() + limitInfo.retryAfter;
          }
        }
      }
      
      // Nếu có đủ thông tin tối thiểu
      if (limitInfo.remaining !== undefined || limitInfo.retryAfter !== undefined) {
        return {
          remaining: limitInfo.remaining !== undefined ? limitInfo.remaining : 0,
          limit: limitInfo.limit !== undefined ? limitInfo.limit : this.maxBucket,
          resetAt: limitInfo.resetAt !== undefined ? limitInfo.resetAt : Date.now() + 1000,
          retryAfter: limitInfo.retryAfter
        };
      }
      
      return null;
    } catch (error) {
      console.error('[NhanhRateLimiter] Error extracting limit info:', error);
      return null;
    }
  }
}

/**
 * Lớp tương thích ngược với code cũ
 * Sử dụng ShopifyRateLimiter làm mặc định
 */
export class RateLimiter {
  private static instance: RateLimiter;
  private limiter: ShopifyRateLimiter;

  constructor() {
    this.limiter = ShopifyRateLimiter.getInstance();
  }

  /**
   * Lấy instance của RateLimiter (singleton pattern)
   */
  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Yêu cầu token để thực hiện API call
   */
  async acquire(): Promise<void> {
    return this.limiter.acquire();
  }

  /**
   * Thực hiện throttle yêu cầu API
   */
  static async throttle(): Promise<void> {
    await RateLimiter.getInstance().acquire();
  }
}

/**
 * Class để đo và ghi lại hiệu suất API
 */
export class PerformanceMetrics {
  private apiCalls: number = 0;
  private apiErrors: number = 0;
  private apiTotalTime: number = 0;
  private batchesProcessed: number = 0;
  private totalItemsProcessed: number = 0;
  startTime: number = 0;
  endTime: number = 0;

  /**
   * Bắt đầu đo hiệu suất
   */
  start(): void {
    this.apiCalls = 0;
    this.apiErrors = 0;
    this.apiTotalTime = 0;
    this.batchesProcessed = 0;
    this.totalItemsProcessed = 0;
    this.startTime = Date.now();
  }

  /**
   * Kết thúc đo hiệu suất và trả về metrics
   */
  end(): any {
    this.endTime = Date.now();
    return {
      totalTime: this.endTime - this.startTime,
      apiCalls: this.apiCalls,
      apiErrors: this.apiErrors,
      avgApiCallTime: this.apiCalls > 0 ? this.apiTotalTime / this.apiCalls : 0,
      batchesProcessed: this.batchesProcessed,
      totalItemsProcessed: this.totalItemsProcessed,
      itemsPerSecond: (this.endTime - this.startTime) > 0 
        ? (this.totalItemsProcessed / ((this.endTime - this.startTime) / 1000))
        : 0
    };
  }

  /**
   * Ghi nhận API call
   */
  recordApiCall(duration: number, isError: boolean = false): void {
    this.apiCalls++;
    this.apiTotalTime += duration;
    
    if (isError) {
      this.apiErrors++;
    }
  }

  /**
   * Ghi nhận batch đã xử lý
   */
  recordBatch(itemCount: number): void {
    this.batchesProcessed++;
    this.totalItemsProcessed += itemCount;
  }
}

// Biến theo dõi lỗi và thành công
let consecutiveErrors = 0;
let successCount = 0;

/**
 * Ghi nhận API call thành công
 */
export function trackSyncSuccess(): void {
  consecutiveErrors = 0;
  successCount++;
}

/**
 * Ghi nhận API call lỗi
 */
export function trackSyncError(error: Error): void {
  consecutiveErrors++;
  
  // Log cảnh báo khi có quá nhiều lỗi liên tiếp
  if (consecutiveErrors >= 5) {
    console.error(`[ALERT] Phát hiện ${consecutiveErrors} lỗi liên tiếp!`, error);
    // Có thể gửi thông báo hoặc thực hiện hành động khắc phục ở đây
  }
} 