import client from 'prom-client';
import logger from './logger';

// Tạo một registry mới để quản lý tất cả metrics
const register = new client.Registry();

// Đăng ký các collector mặc định (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Logger dành riêng cho module metrics
const log = logger.createLogger('metrics');

// Định nghĩa các metrics cho hệ thống đồng bộ
const metrics = {
  // Counter cho số lượng đồng bộ
  syncTotal: new client.Counter({
    name: 'sync_total',
    help: 'Tổng số lượng đồng bộ đã chạy',
    labelNames: ['type', 'status'] as const,
  }),

  // Gauge cho số sản phẩm hiện có
  productsTotal: new client.Gauge({
    name: 'products_total',
    help: 'Tổng số sản phẩm hiện có trong hệ thống',
  }),

  // Histogram cho thời gian xử lý đồng bộ
  syncDuration: new client.Histogram({
    name: 'sync_duration_seconds',
    help: 'Thời gian xử lý đồng bộ',
    labelNames: ['type'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  }),

  // Gauge cho kích thước batch đang sử dụng
  currentBatchSize: new client.Gauge({
    name: 'current_batch_size',
    help: 'Kích thước batch hiện tại',
  }),

  // Counter cho số lỗi gặp phải
  errorCount: new client.Counter({
    name: 'error_count',
    help: 'Số lượng lỗi gặp phải',
    labelNames: ['module', 'type'] as const,
  }),

  // Gauge cho số lượng worker hiện có
  activeWorkers: new client.Gauge({
    name: 'active_workers',
    help: 'Số lượng worker đang hoạt động',
  }),

  // Gauge cho số lượng job trong hàng đợi
  queuedJobs: new client.Gauge({
    name: 'queued_jobs',
    help: 'Số lượng job đang chờ trong hàng đợi',
  }),

  // Gauge cho tỷ lệ sử dụng rate limit
  rateLimitUsage: new client.Gauge({
    name: 'rate_limit_usage_percent',
    help: 'Tỷ lệ sử dụng rate limit',
    labelNames: ['api'] as const,
  }),

  // Gauge cho trạng thái circuit breaker
  circuitBreakerState: new client.Gauge({
    name: 'circuit_breaker_state',
    help: 'Trạng thái circuit breaker (0: closed, 1: half-open, 2: open)',
    labelNames: ['name'] as const,
  }),

  // Histogram cho thời gian phản hồi API
  apiResponseTime: new client.Histogram({
    name: 'api_response_time_seconds',
    help: 'Thời gian phản hồi API',
    labelNames: ['method', 'endpoint', 'status_code'] as const,
    buckets: [0.05, 0.1, 0.5, 1, 2, 5, 10],
  }),

  // Gauge cho hiệu suất cache
  cacheHitRatio: new client.Gauge({
    name: 'cache_hit_ratio',
    help: 'Tỷ lệ cache hit',
    labelNames: ['cache'] as const,
  }),
};

// Đăng ký tất cả metrics với registry
Object.values(metrics).forEach(metric => {
  register.registerMetric(metric);
});

/** 
 * Theo dõi thời gian thực hiện một hàm và ghi lại histogram metric
 * @param metric Histogram metric để ghi lại thời gian
 * @param labels Labels cho metric
 * @param fn Hàm cần đo thời gian
 * @returns Kết quả từ hàm được gọi
 */
export async function trackDuration<T>(
  metric: client.Histogram<string>,
  labels: Record<string, string | number>,
  fn: () => Promise<T>
): Promise<T> {
  const end = metric.startTimer(labels);
  try {
    return await fn();
  } finally {
    end();
  }
}

/**
 * Tăng counter với label tùy chỉnh
 * @param counter Counter cần tăng
 * @param labels Labels tùy chỉnh
 * @param value Giá trị tăng (mặc định là 1)
 */
export function increment(
  counter: client.Counter<string>,
  labels: Record<string, string | number>,
  value: number = 1
): void {
  counter.inc(labels, value);
}

/**
 * Cập nhật giá trị gauge
 * @param gauge Gauge cần cập nhật
 * @param labels Labels tùy chỉnh
 * @param value Giá trị mới
 */
export function setGauge(
  gauge: client.Gauge<string>,
  labels: Record<string, string | number> | undefined,
  value: number
): void {
  if (labels) {
    gauge.set(labels, value);
  } else {
    gauge.set(value);
  }
}

/**
 * Cập nhật trạng thái circuit breaker
 * @param name Tên của circuit breaker
 * @param state Trạng thái (0: closed, 1: half-open, 2: open)
 */
export function updateCircuitBreakerState(name: string, state: number): void {
  metrics.circuitBreakerState.set({ name }, state);
  log.info(`Circuit Breaker ${name} chuyển sang trạng thái ${state}`);
}

/**
 * Cập nhật thông tin metrics từ worker pool
 * @param workerMetrics Thông tin metrics từ worker pool
 */
export function updateWorkerMetrics(workerMetrics: any): void {
  metrics.activeWorkers.set(workerMetrics.activeWorkers || 0);
  metrics.queuedJobs.set(workerMetrics.currentQueueSize || 0);
  
  log.debug('Cập nhật worker metrics', workerMetrics);
}

/**
 * Ghi lại thời gian phản hồi API
 * @param method Phương thức HTTP
 * @param endpoint Endpoint API
 * @param statusCode Mã trạng thái HTTP
 * @param durationMs Thời gian phản hồi (ms)
 */
export function recordApiResponseTime(
  method: string,
  endpoint: string,
  statusCode: number,
  durationMs: number
): void {
  const durationSeconds = durationMs / 1000;
  metrics.apiResponseTime.observe(
    { method, endpoint, status_code: statusCode.toString() },
    durationSeconds
  );
}

/**
 * Cập nhật tỷ lệ sử dụng rate limit
 * @param api Tên API (shopify, nhanh, etc.)
 * @param used Số lượng đã sử dụng
 * @param limit Tổng giới hạn
 */
export function updateRateLimitUsage(api: string, used: number, limit: number): void {
  const usagePercent = (used / limit) * 100;
  metrics.rateLimitUsage.set({ api }, usagePercent);
  
  if (usagePercent > 80) {
    log.warn(`Rate limit usage cho ${api} cao: ${usagePercent.toFixed(2)}%`);
  }
}

/**
 * Cập nhật tỷ lệ cache hit
 * @param cacheName Tên cache
 * @param hits Số lượng cache hit
 * @param misses Số lượng cache miss
 */
export function updateCacheHitRatio(cacheName: string, hits: number, misses: number): void {
  const total = hits + misses;
  if (total > 0) {
    const ratio = (hits / total) * 100;
    metrics.cacheHitRatio.set({ cache: cacheName }, ratio);
  }
}

/**
 * Cập nhật thông tin batch size
 * @param size Kích thước batch hiện tại
 */
export function updateBatchSize(size: number): void {
  metrics.currentBatchSize.set(size);
}

/**
 * Hàm để lấy tất cả metrics hiện tại dưới dạng chuỗi
 * @returns Chuỗi đại diện cho tất cả metrics
 */
export async function getMetricsAsString(): Promise<string> {
  return await register.metrics();
}

/**
 * Hàm để lấy tất cả metrics hiện tại dưới dạng JSON
 * @returns Object chứa tất cả metrics
 */
export async function getMetricsAsJson(): Promise<any> {
  const metrics = await register.getMetricsAsJSON();
  return metrics;
}

// Export registry và metrics để sử dụng ở nơi khác
export { register, metrics };

// Export một object metrics với các hàm tiện ích
export default {
  trackDuration,
  increment,
  setGauge,
  updateCircuitBreakerState,
  updateWorkerMetrics,
  recordApiResponseTime,
  updateRateLimitUsage,
  updateCacheHitRatio,
  updateBatchSize,
  getMetricsAsString,
  getMetricsAsJson,
  register,
  metrics
}; 