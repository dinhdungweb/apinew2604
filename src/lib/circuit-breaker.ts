/**
 * Enum định nghĩa các trạng thái của Circuit Breaker
 */
export enum CircuitState {
  CLOSED = 'CLOSED',      // Trạng thái đóng - hoạt động bình thường
  OPEN = 'OPEN',          // Trạng thái mở - ngắt tất cả các yêu cầu
  HALF_OPEN = 'HALF_OPEN' // Trạng thái nửa mở - thử nghiệm một số yêu cầu
}

/**
 * Interface để định nghĩa cấu hình cho Circuit Breaker
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;      // Số lỗi liên tiếp trước khi mở circuit
  resetTimeout: number;          // Thời gian (ms) trước khi chuyển từ OPEN sang HALF_OPEN
  halfOpenSuccessThreshold: number; // Số lần thành công cần thiết trong trạng thái HALF_OPEN để đóng lại circuit
  monitorInterval?: number;      // Khoảng thời gian (ms) để ghi lại metrics
  healthCheckInterval?: number;  // Khoảng thời gian (ms) để kiểm tra sức khỏe của service
  timeoutDuration?: number;      // Thời gian chờ (ms) cho mỗi request trước khi tính là thất bại
  onStateChange?: (from: CircuitState, to: CircuitState, metrics: CircuitBreakerMetrics) => void; // Callback khi trạng thái thay đổi
  onCircuitOpen?: (metrics: CircuitBreakerMetrics) => void; // Callback khi circuit mở
  onCircuitClose?: (metrics: CircuitBreakerMetrics) => void; // Callback khi circuit đóng
  onCircuitHalfOpen?: (metrics: CircuitBreakerMetrics) => void; // Callback khi circuit nửa mở
}

/**
 * Interface để định nghĩa metrics cho Circuit Breaker
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastStateChangeTime: number | null;
  rejectedCount: number;
  timeouts: number;
  errorTypes: Record<string, number>;
  averageResponseTime: number;
  totalResponseTime: number;
  currentHealthStatus: boolean;
}

/**
 * Lớp CircuitBreaker để ngăn chặn hệ thống tiếp tục thực hiện các cuộc gọi có khả năng thất bại cao
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private metrics: CircuitBreakerMetrics;
  private resetTimer: NodeJS.Timeout | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private options: CircuitBreakerOptions;
  private readonly name: string;
  private halfOpenExecutionCount: number = 0;
  private static instances: Record<string, CircuitBreaker> = {};

  /**
   * Khởi tạo Circuit Breaker mới
   * @param name Tên của circuit breaker
   * @param options Cấu hình cho circuit breaker
   */
  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    
    // Cấu hình mặc định
    this.options = {
      failureThreshold: 5,               // 5 lỗi liên tiếp
      resetTimeout: 30000,               // 30 giây
      halfOpenSuccessThreshold: 3,       // 3 lần thành công liên tiếp
      monitorInterval: 60000,            // 1 phút
      healthCheckInterval: 120000,       // 2 phút
      timeoutDuration: 10000,            // 10 giây
      ...options
    };
    
    // Khởi tạo metrics
    this.metrics = {
      state: CircuitState.CLOSED,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChangeTime: Date.now(),
      rejectedCount: 0,
      timeouts: 0,
      errorTypes: {},
      averageResponseTime: 0,
      totalResponseTime: 0,
      currentHealthStatus: true
    };
    
    // Bắt đầu monitor metrics
    if (this.options.monitorInterval) {
      this.startMonitoring();
    }
    
    // Bắt đầu health check
    if (this.options.healthCheckInterval) {
      this.startHealthCheck();
    }
    
    // Lưu instance
    CircuitBreaker.instances[name] = this;
  }
  
  /**
   * Lấy instance của CircuitBreaker dựa trên tên
   * @param name Tên của circuit breaker
   * @param options Cấu hình cho circuit breaker (nếu cần tạo mới)
   */
  public static getInstance(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!CircuitBreaker.instances[name]) {
      return new CircuitBreaker(name, options);
    }
    return CircuitBreaker.instances[name];
  }
  
  /**
   * Lấy tất cả các instances của CircuitBreaker
   */
  public static getAllInstances(): Record<string, CircuitBreaker> {
    return CircuitBreaker.instances;
  }
  
  /**
   * Thực hiện function được bảo vệ bởi circuit breaker
   * @param fn Function cần thực hiện
   * @param fallback Function fallback khi circuit mở (tùy chọn)
   */
  public async execute<T>(
    fn: () => Promise<T>,
    fallback?: (error: Error) => Promise<T> | T
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      this.metrics.rejectedCount++;
      
      const error = new Error(`Circuit đang mở cho ${this.name}`);
      (error as any).circuit = {
        state: this.state,
        name: this.name,
        metrics: this.getMetrics()
      };
      
      if (fallback) {
        return await fallback(error);
      }
      
      throw error;
    }
    
    // Nếu ở trạng thái HALF_OPEN, kiểm tra xem có nên cho phép thực hiện không
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenExecutionCount >= this.options.halfOpenSuccessThreshold) {
        this.metrics.rejectedCount++;
        
        const error = new Error(`Đã đạt giới hạn số lượng yêu cầu thử nghiệm cho ${this.name}`);
        (error as any).circuit = {
          state: this.state,
          name: this.name,
          metrics: this.getMetrics()
        };
        
        if (fallback) {
          return await fallback(error);
        }
        
        throw error;
      }
      
      this.halfOpenExecutionCount++;
    }
    
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      // Tạo promise với timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          this.metrics.timeouts++;
          reject(new Error(`Timeout sau ${this.options.timeoutDuration}ms`));
        }, this.options.timeoutDuration);
      });
      
      // Race giữa function và timeout
      const result = await Promise.race([
        fn(),
        timeoutPromise
      ]);
      
      // Xử lý thành công
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error: any) {
      // Xử lý thất bại
      this.onFailure(error, Date.now() - startTime);
      
      if (fallback) {
        return await fallback(error);
      }
      
      throw error;
    }
  }

  /**
   * Xử lý khi một yêu cầu thành công
   * @param responseTime Thời gian phản hồi (ms)
   */
  private onSuccess(responseTime: number): void {
    // Cập nhật metrics
    this.metrics.successCount++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();
    
    // Cập nhật thời gian phản hồi trung bình
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / 
      (this.metrics.successCount + this.metrics.failureCount);
    
    // Nếu đang ở trạng thái HALF_OPEN và đạt đủ số lần thành công liên tiếp, đóng circuit
    if (this.state === CircuitState.HALF_OPEN && 
        this.metrics.consecutiveSuccesses >= this.options.halfOpenSuccessThreshold) {
      this.transitionToClosed();
    }
  }

  /**
   * Xử lý khi một yêu cầu thất bại
   * @param error Lỗi
   * @param responseTime Thời gian phản hồi (ms)
   */
  private onFailure(error: Error, responseTime: number): void {
    // Cập nhật metrics
    this.metrics.failureCount++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();
    
    // Cập nhật thời gian phản hồi trung bình
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / 
      (this.metrics.successCount + this.metrics.failureCount);
    
    // Theo dõi các loại lỗi
    const errorType = error.name || 'UnknownError';
    this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;
    
    // Nếu đang ở trạng thái HALF_OPEN, lập tức mở lại circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
      return;
    }
    
    // Nếu đang ở trạng thái CLOSED và đạt ngưỡng lỗi liên tiếp, mở circuit
    if (this.state === CircuitState.CLOSED && 
        this.metrics.consecutiveFailures >= this.options.failureThreshold) {
      this.transitionToOpen();
    }
  }

  /**
   * Chuyển đổi sang trạng thái OPEN
   */
  private transitionToOpen(): void {
    if (this.state === CircuitState.OPEN) return;
    
    const prevState = this.state;
    this.state = CircuitState.OPEN;
    this.metrics.state = CircuitState.OPEN;
    this.metrics.lastStateChangeTime = Date.now();
    
    // Dừng reset timer nếu có
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    // Đặt timer để chuyển sang trạng thái HALF_OPEN sau một khoảng thời gian
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.options.resetTimeout);
    
    // Gọi callback
    if (this.options.onStateChange) {
      this.options.onStateChange(prevState, CircuitState.OPEN, { ...this.metrics });
    }
    
    if (this.options.onCircuitOpen) {
      this.options.onCircuitOpen({ ...this.metrics });
    }
    
    console.warn(`[CircuitBreaker:${this.name}] Circuit đã mở sau ${this.metrics.consecutiveFailures} lỗi liên tiếp`);
  }

  /**
   * Chuyển đổi sang trạng thái HALF_OPEN
   */
  private transitionToHalfOpen(): void {
    if (this.state === CircuitState.HALF_OPEN) return;
    
    const prevState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.metrics.state = CircuitState.HALF_OPEN;
    this.metrics.lastStateChangeTime = Date.now();
    
    // Reset số lần thử nghiệm
    this.halfOpenExecutionCount = 0;
    
    // Gọi callback
    if (this.options.onStateChange) {
      this.options.onStateChange(prevState, CircuitState.HALF_OPEN, { ...this.metrics });
    }
    
    if (this.options.onCircuitHalfOpen) {
      this.options.onCircuitHalfOpen({ ...this.metrics });
    }
    
    console.info(`[CircuitBreaker:${this.name}] Circuit đang ở trạng thái nửa mở, thử nghiệm kết nối`);
  }

  /**
   * Chuyển đổi sang trạng thái CLOSED
   */
  private transitionToClosed(): void {
    if (this.state === CircuitState.CLOSED) return;
    
    const prevState = this.state;
    this.state = CircuitState.CLOSED;
    this.metrics.state = CircuitState.CLOSED;
    this.metrics.lastStateChangeTime = Date.now();
    this.metrics.consecutiveFailures = 0;
    
    // Reset số lần thử nghiệm
    this.halfOpenExecutionCount = 0;
    
    // Gọi callback
    if (this.options.onStateChange) {
      this.options.onStateChange(prevState, CircuitState.CLOSED, { ...this.metrics });
    }
    
    if (this.options.onCircuitClose) {
      this.options.onCircuitClose({ ...this.metrics });
    }
    
    console.info(`[CircuitBreaker:${this.name}] Circuit đã đóng, hoạt động bình thường`);
  }

  /**
   * Bắt đầu monitor metrics
   */
  private startMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    
    this.monitorTimer = setInterval(() => {
      console.debug(`[CircuitBreaker:${this.name}] Metrics:`, this.getMetrics());
    }, this.options.monitorInterval);
  }

  /**
   * Bắt đầu health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      // Health check có thể được triển khai bởi người dùng
      // qua callback hoặc có thể được mở rộng sau này
    }, this.options.healthCheckInterval);
  }

  /**
   * Dừng tất cả các timers
   */
  public stop(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Reset circuit breaker về trạng thái ban đầu
   */
  public reset(): void {
    this.stop();
    
    const prevState = this.state;
    this.state = CircuitState.CLOSED;
    
    this.metrics = {
      state: CircuitState.CLOSED,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChangeTime: Date.now(),
      rejectedCount: 0,
      timeouts: 0,
      errorTypes: {},
      averageResponseTime: 0,
      totalResponseTime: 0,
      currentHealthStatus: true
    };
    
    // Gọi callback nếu trạng thái thay đổi
    if (prevState !== CircuitState.CLOSED && this.options.onStateChange) {
      this.options.onStateChange(prevState, CircuitState.CLOSED, { ...this.metrics });
    }
    
    if (this.options.monitorInterval) {
      this.startMonitoring();
    }
    
    if (this.options.healthCheckInterval) {
      this.startHealthCheck();
    }
    
    console.info(`[CircuitBreaker:${this.name}] Circuit đã được reset`);
  }

  /**
   * Lấy trạng thái hiện tại của circuit breaker
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Lấy metrics hiện tại của circuit breaker
   */
  public getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Lấy tên của circuit breaker
   */
  public getName(): string {
    return this.name;
  }
}

/**
 * Function decorator để áp dụng circuit breaker cho một hàm
 * @param circuitName Tên của circuit breaker
 * @param options Cấu hình cho circuit breaker
 */
export function withCircuitBreaker(
  circuitName: string,
  options?: Partial<CircuitBreakerOptions>
) {
  return function(
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const circuit = CircuitBreaker.getInstance(circuitName, options);
      
      return await circuit.execute(async () => {
        return await originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
}

/**
 * Function helper để thực hiện một hàm với circuit breaker
 * @param name Tên của circuit breaker
 * @param fn Function cần thực hiện
 * @param options Cấu hình cho circuit breaker
 * @param fallback Function fallback khi circuit mở (tùy chọn)
 */
export async function executeWithCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: Partial<CircuitBreakerOptions>,
  fallback?: (error: Error) => Promise<T> | T
): Promise<T> {
  const circuit = CircuitBreaker.getInstance(name, options);
  return await circuit.execute(fn, fallback);
} 