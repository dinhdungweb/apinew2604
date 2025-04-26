# Ghi chú cải tiến và sửa lỗi

## Sửa lỗi file nhanh.ts (API Nhanh.vn Integration)

### Ngày: 16/04/2024

**Mô tả**: Sửa các lỗi liên quan đến import modules và TypeScript trong file `src/lib/nhanh.ts`.

### Chi tiết sửa đổi:

1. **Sửa lỗi import module logging không tồn tại**
   - Vấn đề: Import không hợp lệ `import { logger } from './logging';` trỏ đến module không tồn tại
   - Giải pháp: Tạo một đối tượng logger đơn giản trực tiếp trong file:
   ```typescript
   const logger = {
     info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
     error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
     warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
     debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || '')
   };
   ```

2. **Sửa lỗi import prismaClient**
   - Vấn đề: Import không hợp lệ `import { prismaClient } from './prisma';`
   - Giải pháp: Thay đổi thành `import prisma from './prisma';` vì module prisma.ts xuất default, không phải named export

3. **Sửa lỗi kiểu dữ liệu ngầm định**
   - Vấn đề: Tham số `item` trong hàm settings.forEach không có kiểu dữ liệu rõ ràng
   - Giải pháp: Thêm kiểu dữ liệu rõ ràng:
   ```typescript
   settings.forEach((item: { key: string; value: string }) => {
     result[item.key] = item.value;
   });
   ```

4. **Cải thiện cơ chế retry trong hàm callNhanhAPI**
   - Vấn đề: Biến `attempt` bị cố định giá trị là 1, không phản ánh đúng số lần thử lại
   - Giải pháp:
     - Loại bỏ biến `attempt` cố định
     - Thêm callback `onRetry` vào `retryOptions` để ghi log hiệu quả hơn sau mỗi lần retry
     - Chuyển logic ghi log lỗi vào callback `onRetry` để số lần thử đúng
     - Giữ lại logic kiểm tra các loại lỗi cụ thể để xác định xem có nên retry hay không

### Lợi ích của thay đổi:
- **Loại bỏ lỗi TypeScript**: Ứng dụng sẽ biên dịch mà không có lỗi
- **Cải thiện retry logic**: Xử lý lỗi tốt hơn, số lần retry chính xác
- **Ghi log tốt hơn**: Cung cấp thông tin chi tiết hơn về số lần retry và thông tin lỗi
- **Không phụ thuộc**: Giảm sự phụ thuộc vào các module bên ngoài không cần thiết

## Cải thiện Rate Limiting

### Ngày: 16/04/2024

**Mô tả**: Cải tiến hệ thống rate limiting để hỗ trợ nhiều API khác nhau và thích ứng với headers trả về từ API.

### Chi tiết triển khai:

1. **Tạo cấu trúc rate limiter linh hoạt**
   - Tạo lớp trừu tượng `BaseRateLimiter` làm lớp cơ sở cho tất cả rate limiters
   - Định nghĩa interface `RateLimitInfo` để chuẩn hóa thông tin rate limit
   - Tạo các lớp con cho từng API:
     - `ShopifyRateLimiter`: Dành riêng cho Shopify API
     - `NhanhRateLimiter`: Dành riêng cho Nhanh.vn API
   - Giữ lớp `RateLimiter` gốc cho khả năng tương thích ngược

2. **Tích hợp thông tin phản hồi từ API**
   - Thêm phương thức `updateLimitFromResponse` để xử lý headers từ API
   - Phương thức `extractLimitInfo` riêng biệt cho từng loại API để trích xuất thông tin
   - Hỗ trợ đọc các headers phổ biến:
     - Shopify: `X-Shopify-Shop-Api-Call-Limit` (39/40), `Retry-After`
     - Nhanh.vn: Các headers và thông báo lỗi trong body response

3. **Cơ chế backpressure thích ứng**
   - Xác định ngưỡng backpressure (mặc định 20% token còn lại)
   - Thêm logic tính toán thời gian delay dựa trên số token còn lại:
     - Khi gần hết token, thời gian delay lớn hơn
     - Khi còn nhiều token, thời gian delay nhỏ hơn
   - Sử dụng công thức phi tuyến (bậc 2) để tăng nhanh delay khi gần hết token

4. **Điều chỉnh tốc độ refill động**
   - Tính toán lại tốc độ refill dựa trên thông tin resetAt từ API
   - Tự động điều chỉnh khi nhận được Retry-After header

### Cách sử dụng:

```typescript
// Sử dụng Shopify Rate Limiter
const shopifyLimiter = ShopifyRateLimiter.getInstance();
await shopifyLimiter.throttle();

// Sau khi gọi API, cập nhật thông tin giới hạn
const response = await fetch(url, options);
shopifyLimiter.updateLimitFromResponse(response.headers);

// Sử dụng Nhanh.vn Rate Limiter
const nhanhLimiter = NhanhRateLimiter.getInstance();
await nhanhLimiter.throttle();

// Sau khi gọi API, cập nhật thông tin giới hạn
const response = await fetch(url, options);
const data = await response.json();
nhanhLimiter.updateLimitFromResponse(response.headers, data);
```

### Lợi ích:
- **Tối ưu hiệu suất**: Tránh bị rate limit bằng cách chủ động điều chỉnh tốc độ
- **Thích ứng tự động**: Tự điều chỉnh dựa trên phản hồi thực tế từ API
- **Tách biệt giới hạn**: Mỗi API có giới hạn riêng, không ảnh hưởng lẫn nhau
- **Backpressure thông minh**: Giảm dần tốc độ gửi request khi gần đạt giới hạn

## Triển khai Circuit Breaker

### Ngày: 16/04/2024

**Mô tả**: Triển khai mô hình Circuit Breaker để bảo vệ hệ thống khỏi các API không ổn định.

### Nguyên lý hoạt động:

1. **Ba trạng thái chính**:
   - `CLOSED`: Hoạt động bình thường, tất cả các yêu cầu đều được thực hiện
   - `OPEN`: Ngắt mạch, tất cả các yêu cầu đều bị từ chối ngay lập tức
   - `HALF_OPEN`: Thử nghiệm, cho phép một số yêu cầu đi qua để kiểm tra kết nối

2. **Cơ chế chuyển đổi trạng thái**:
   - `CLOSED` → `OPEN`: Khi số lần lỗi liên tiếp vượt ngưỡng (`failureThreshold`)
   - `OPEN` → `HALF_OPEN`: Sau một khoảng thời gian nhất định (`resetTimeout`)
   - `HALF_OPEN` → `CLOSED`: Khi số lần thành công liên tiếp đạt ngưỡng (`halfOpenSuccessThreshold`)
   - `HALF_OPEN` → `OPEN`: Khi gặp lỗi trong trạng thái HALF_OPEN

### Chi tiết triển khai:

1. **Tạo module circuit breaker**
   - File: `src/lib/circuit-breaker.ts`
   - Lớp `CircuitBreaker` với các phương thức chính:
     - `execute`: Thực hiện hàm với circuit breaker
     - `getState`: Lấy trạng thái hiện tại
     - `getMetrics`: Lấy các thông số hiệu suất
     - `reset`: Khôi phục về trạng thái ban đầu

2. **Cấu hình linh hoạt**
   - `failureThreshold`: Số lỗi liên tiếp trước khi mở circuit
   - `resetTimeout`: Thời gian trước khi thử kết nối lại
   - `halfOpenSuccessThreshold`: Số lần thành công cần thiết để đóng lại circuit
   - `timeoutDuration`: Thời gian chờ trước khi xác định request bị timeout
   - Các callback khi trạng thái thay đổi

3. **Tích hợp metrics**
   - Theo dõi số lượng request thành công/thất bại
   - Đo thời gian phản hồi trung bình
   - Phân loại các lỗi gặp phải
   - Ghi lại số lần bị từ chối và timeout

4. **Tích hợp vào syncService**
   - Áp dụng circuit breaker cho cả Shopify và Nhanh.vn API
   - Cấu hình riêng biệt cho từng API
   - Fallback khi circuit mở với thông báo lỗi cụ thể

### Cách sử dụng:

```typescript
// Cách sử dụng cơ bản
const result = await executeWithCircuitBreaker(
  'api-name',
  async () => {
    // Thực hiện API call
    return await apiCall();
  },
  {
    // Cấu hình tùy chọn
    failureThreshold: 5,
    resetTimeout: 30000
  },
  (error) => {
    // Fallback khi circuit mở
    return defaultResponse;
  }
);

// Sử dụng decorator (trong class)
class ApiService {
  @withCircuitBreaker('api-name')
  async callApi() {
    // Thực hiện API call
  }
}
```

### Lợi ích:
- **Kiểm soát lỗi hiệu quả**: Ngăn chặn hệ thống tiếp tục gọi API không ổn định
- **Tự phục hồi**: Tự động thử lại kết nối sau khoảng thời gian cấu hình
- **Metrics chi tiết**: Cung cấp thông tin về hiệu suất và trạng thái API
- **Fallback linh hoạt**: Cho phép định nghĩa hành vi thay thế khi API không khả dụng
- **Cải thiện trải nghiệm người dùng**: Thay vì chờ đợi timeout, phản hồi lỗi ngay lập tức

## Cải thiện Quản lý Cache

### Ngày: 17/04/2024

**Mô tả**: Cải tiến hệ thống quản lý cache nhằm tối ưu hiệu suất và tăng khả năng chịu lỗi của ứng dụng.

### Vấn đề gặp phải:

1. **Phụ thuộc vào Redis**: Hệ thống trước đây hoàn toàn phụ thuộc vào Redis, nếu Redis không khả dụng sẽ dẫn đến lỗi khi đọc/ghi cache.
2. **Không có eviction policy**: Thiếu cơ chế để giới hạn kích thước cache và loại bỏ các entry cũ.
3. **Không có thống kê hiệu suất**: Thiếu các metrics về hiệu suất cache để giám sát và tối ưu.
4. **Thiếu khả năng phục hồi**: Không có cơ chế kiểm tra và tự động phục hồi kết nối Redis.

### Chi tiết cải tiến:

1. **Cache đa tầng với fallback**
   - Triển khai hệ thống cache 3 tầng:
     - Redis (tầng chính): Distributed cache, chia sẻ giữa các instances
     - NodeCache (fallback 1): In-memory cache đơn giản với TTL
     - LRUCache (fallback 2): Cache dựa trên thuật toán LRU, quản lý kích thước tự động
   - Tự động chuyển đổi giữa các tầng cache khi cần thiết
   - Truy vấn song song tất cả các tầng khi đọc dữ liệu để tăng tỷ lệ cache hit

2. **Eviction Policy**
   - Triển khai LRU (Least Recently Used) cho local cache
   - Thêm giám sát thời gian tồn tại tối đa (TTL)
   - Tự động xóa các entry cũ sau một khoảng thời gian cấu hình
   - Hỗ trợ cấu hình kích thước tối đa cho cache

3. **Cấu hình linh hoạt**
   - Thêm cấu hình qua biến môi trường:
     - `CACHE_MAX_ITEMS`: Số lượng item tối đa trong cache
     - `CACHE_MAX_SIZE`: Kích thước tối đa của cache (bytes)
     - `CACHE_MAX_AGE`: Thời gian tồn tại tối đa của cache (ms)
     - `CACHE_CLEANUP_INTERVAL`: Khoảng thời gian giữa các lần làm sạch cache (giây)
     - `CACHE_EVICTION_THRESHOLD`: Ngưỡng kích thước cache để trigger eviction (%)

4. **Kiểm tra và phục hồi tự động**
   - Thêm job kiểm tra sức khỏe Redis định kỳ (30 giây)
   - Tự động chuyển đổi sang local cache khi Redis không khả dụng
   - Tự động phục hồi về Redis khi kết nối được khôi phục
   - Job làm sạch cache định kỳ để tránh memory leak

5. **Thống kê hiệu suất**
   - Mở rộng `getSyncCacheStats` để cung cấp thêm thông tin:
     - Trạng thái kết nối Redis
     - Kích thước tổng của cache (bytes)
     - Thông tin sử dụng bộ nhớ
     - Loại eviction policy đang được sử dụng

### Cách sử dụng:

```typescript
// Lấy thông tin cache
const cache = await getProductSyncCache(productId);

// Cập nhật cache
await updateProductSyncCache(productId, dataHash, shopifyId);

// Xóa cache cụ thể
await clearProductSyncCache(productId);

// Xóa cache cũ theo thời gian
await evictOldCache();

// Lấy thống kê cache
const stats = await getSyncCacheStats();
```

### Lợi ích:
- **Tính sẵn sàng cao**: Hệ thống vẫn hoạt động khi Redis gặp vấn đề
- **Hiệu suất tốt hơn**: Cache đa tầng giúp tăng tỷ lệ cache hit
- **Sử dụng bộ nhớ hiệu quả**: Eviction policy giúp tránh tràn bộ nhớ
- **Khả năng giám sát**: Thống kê chi tiết giúp phát hiện vấn đề sớm
- **Tự phục hồi**: Tự động chuyển đổi giữa các chiến lược cache khi cần thiết