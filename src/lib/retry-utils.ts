/**
 * Cung cấp các tiện ích để retry các hoạt động có khả năng thất bại,
 * áp dụng exponential backoff và jitter để giảm tải lên server.
 */

/**
 * Cấu hình cho retry
 */
export interface RetryOptions {
  maxRetries: number;       // Số lần retry tối đa
  baseDelay: number;        // Thời gian delay cơ bản (ms)
  maxDelay: number;         // Thời gian delay tối đa (ms)
  factor: number;           // Hệ số tăng (mặc định là 2 cho exponential backoff)
  jitter: boolean;          // Có thêm jitter hay không
  jitterFactor: number;     // Hệ số jitter (0-1)
  onRetry?: (attempt: number, delay: number, error: Error) => void;  // Callback khi retry
  retryableErrors?: (string | number)[];  // Danh sách mã lỗi hoặc message cần retry
  retryCondition?: (error: any) => boolean;  // Hàm kiểm tra lỗi có nên retry không
  logPrefix?: string;       // Tiền tố cho log để dễ phân biệt
}

/**
 * Cấu hình mặc định
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  jitter: true,
  jitterFactor: 0.3,
  logPrefix: '[Retry]'
};

/**
 * Thêm jitter (dao động ngẫu nhiên) vào thời gian delay
 * để tránh các yêu cầu đồng thời đến server sau lỗi
 */
export function addJitter(delay: number, jitterFactor: number = 0.3): number {
  const jitterRange = delay * jitterFactor;
  return delay + (Math.random() * jitterRange) - (jitterRange / 2);
}

/**
 * Tính toán thời gian delay cho lần retry tiếp theo
 * sử dụng exponential backoff và jitter nếu được cấu hình
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
  // Tính exponential backoff: baseDelay * (factor ^ attempt)
  let delay = options.baseDelay * Math.pow(options.factor, attempt);
  
  // Giới hạn thời gian tối đa
  delay = Math.min(delay, options.maxDelay);
  
  // Thêm jitter nếu được cấu hình
  if (options.jitter) {
    delay = addJitter(delay, options.jitterFactor);
  }
  
  return delay;
}

/**
 * Thực hiện một hàm với cơ chế retry
 * @param fn Hàm cần thực hiện, trả về Promise
 * @param options Tùy chọn cho cơ chế retry
 * @returns Promise với kết quả của hàm
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  // Kết hợp options với defaults
  const retryOptions: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options
  };
  
  let attempt = 0;
  let lastError: Error = new Error("Unknown error"); // Khởi tạo giá trị mặc định
  const startTime = Date.now();
  const logPrefix = retryOptions.logPrefix || '[Retry]';
  
  while (attempt <= retryOptions.maxRetries) {
    try {
      // Nếu là lần gọi lại, log thông tin
      if (attempt > 0) {
        console.log(`${logPrefix} Đang thử lại lần ${attempt}/${retryOptions.maxRetries}`);
      }
      
      const result = await fn();
      
      // Nếu đã retry ít nhất một lần, log thành công
      if (attempt > 0) {
        const totalTime = Date.now() - startTime;
        console.log(`${logPrefix} Thành công sau ${attempt} lần thử lại (${totalTime}ms)`);
      }
      
      return result;
    } catch (error) {
      // Ép kiểu error thành Error
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Ghi log chi tiết lỗi
      const errorDetails = getErrorDetails(lastError);
      console.error(`${logPrefix} Lỗi: ${lastError.message}`, errorDetails);
      
      // Tăng số lần thử
      attempt++;
      
      // Kiểm tra xem có nên retry không
      const shouldRetry = attempt <= retryOptions.maxRetries && 
                         (retryOptions.retryCondition ? 
                          retryOptions.retryCondition(lastError) : 
                          isRetryableError(lastError, retryOptions.retryableErrors));
      
      // Nếu không nên retry hoặc đã hết số lần thử, ném lỗi
      if (!shouldRetry) {
        if (attempt > retryOptions.maxRetries) {
          console.error(`${logPrefix} Đã hết số lần thử lại (${retryOptions.maxRetries})`);
        } else {
          console.error(`${logPrefix} Lỗi không thể retry`);
        }
        throw lastError;
      }
      
      // Tính thời gian delay
      const delay = calculateDelay(attempt, retryOptions);
      
      // Gọi callback onRetry nếu có
      if (retryOptions.onRetry) {
        retryOptions.onRetry(attempt, delay, lastError);
      } else {
        console.log(`${logPrefix} Thử lại lần ${attempt}/${retryOptions.maxRetries} sau ${Math.round(delay)}ms: ${lastError.message}`);
      }
      
      // Chờ trước khi thử lại
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Sẽ không bao giờ đến đây vì vòng lặp sẽ throw lỗi trước
  throw lastError;
}

/**
 * Decorator để thêm retry vào các phương thức
 */
export function retry(
  options: Partial<RetryOptions> = {}
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
}

/**
 * Trích xuất thông tin chi tiết về lỗi
 * @param error Lỗi cần trích xuất thông tin
 * @returns Object chứa thông tin chi tiết về lỗi
 */
function getErrorDetails(error: any): Record<string, any> {
  const details: Record<string, any> = {};
  
  // Trích xuất mã lỗi HTTP
  if (error.status) details.status = error.status;
  if (error.statusCode) details.statusCode = error.statusCode;
  if (error.code) details.code = error.code;
  
  // Trích xuất thông tin từ response nếu có
  if (error.response) {
    if (error.response.status) details.responseStatus = error.response.status;
    if (error.response.statusText) details.statusText = error.response.statusText;
    if (error.response.data) details.responseData = error.response.data;
  }
  
  // Trích xuất headers nếu có
  if (error.headers) {
    details.headers = {};
    if (error.headers.get && typeof error.headers.get === 'function') {
      details.headers['retry-after'] = error.headers.get('retry-after');
      details.headers['x-rate-limit-remaining'] = error.headers.get('x-rate-limit-remaining');
    }
  }
  
  return details;
}

/**
 * Tiện ích để tạo hàm retry API call
 * @param apiCallFn Hàm gọi API
 * @param options Tùy chọn retry
 * @returns Hàm đã được bọc bởi cơ chế retry
 */
export function createRetryableApiCall<T extends (...args: any[]) => Promise<any>>(
  apiCallFn: T,
  options: Partial<RetryOptions> = {}
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    return withRetry(() => apiCallFn(...args), options) as ReturnType<T>;
  }) as unknown as T;
}

/**
 * Kiểm tra lỗi có nên được retry hay không
 * @param error Lỗi cần kiểm tra
 * @param customRetryableErrors Danh sách mã lỗi hoặc message tùy chỉnh cần retry
 * @returns true nếu lỗi nên được retry, false nếu không
 */
export function isRetryableError(error: any, customRetryableErrors?: (string | number)[]): boolean {
  // Các mã lỗi HTTP cần retry
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  // Nếu có danh sách tùy chỉnh, thêm vào danh sách chuẩn
  if (customRetryableErrors?.length) {
    // Lọc ra các mã số để thêm vào retryableStatusCodes
    const customStatusCodes = customRetryableErrors.filter(e => typeof e === 'number') as number[];
    retryableStatusCodes.push(...customStatusCodes);
  }
  
  // Kiểm tra các loại lỗi mạng
  const isNetworkError = error.code === 'ECONNRESET' || 
    error.code === 'ETIMEDOUT' || 
    error.code === 'ECONNREFUSED' ||
    error.message?.includes('network') ||
    error.message?.includes('timeout');
  
  // Kiểm tra lỗi rate limit
  const isRateLimit = error.status === 429 || 
    error.statusCode === 429 ||
    (error.response && error.response.status === 429);
  
  // Kiểm tra lỗi server
  const isServerError = (error.status && retryableStatusCodes.includes(error.status)) ||
    (error.statusCode && retryableStatusCodes.includes(error.statusCode)) ||
    (error.response && error.response.status && retryableStatusCodes.includes(error.response.status));
  
  // Kiểm tra message tùy chỉnh
  const hasCustomMessage = customRetryableErrors?.some(e => 
    typeof e === 'string' && error.message?.includes(e)
  );
  
  return isNetworkError || isRateLimit || isServerError || !!hasCustomMessage;
} 