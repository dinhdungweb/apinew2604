# Lịch sử phát triển

## [Unreleased]
### Added
- Worker đồng bộ độc lập không phụ thuộc vào trình duyệt:
  - Tạo worker script chạy độc lập với ứng dụng web (scripts/worker.js)
  - Sử dụng PM2 để quản lý process worker (ecosystem.config.js)
  - Cập nhật trạng thái worker vào database để theo dõi
  - Hiển thị trạng thái worker trong trang cài đặt hệ thống
  - Thêm hướng dẫn sử dụng worker vào README.md
  - Thêm script PowerShell để khởi động worker trên Windows
- Hệ thống Rate Limiting cải tiến:
  - Tách biệt rate limiter cho từng API (Shopify và Nhanh.vn)
  - Thêm khả năng đọc và xử lý headers rate limit từ response
  - Điều chỉnh tốc độ gửi request dựa trên phản hồi từ API
  - Cơ chế "backpressure" thông minh giúp giảm tải khi gần đạt giới hạn
  - Tối ưu hóa Token Bucket algorithm với thông tin phản hồi thực tế
- Circuit Breaker cho API calls:
  - Triển khai mô hình Circuit Breaker với 3 trạng thái (closed, open, half-open)
  - Tự động ngắt kết nối đến API không ổn định sau một số lần lỗi liên tiếp
  - Cơ chế kiểm tra lại kết nối và phục hồi tự động
  - Hỗ trợ timeout và retry linh hoạt
  - Tích hợp metrics để theo dõi hiệu suất và trạng thái của API
  - Fallback cho các trạng thái lỗi với thông báo chi tiết
- Cải thiện quản lý Cache:
  - Triển khai cơ chế eviction policy LRU (Least Recently Used)
  - Thêm giới hạn kích thước cache dựa trên cấu hình 
  - Tự động làm sạch cache cũ theo định kỳ
  - Cache fallback đa tầng (Redis → NodeCache → LRUCache)
  - Kiểm tra định kỳ và phục hồi tự động kết nối Redis
  - Thống kê chi tiết về hiệu suất và trạng thái cache
- Cải thiện hệ thống Logging và Monitoring:
  - Thay thế console.log bằng module logging chuẩn hóa (Winston)
  - Hỗ trợ nhiều cấp độ log (debug, info, warn, error)
  - Thêm correlation ID để theo dõi toàn bộ luồng xử lý
  - Cung cấp API endpoints để xem metrics dạng Prometheus và JSON
  - Thu thập metrics về:
    - Hiệu suất đồng bộ (thời gian xử lý, tỷ lệ thành công)
    - Sử dụng rate limit và trạng thái circuit breaker
    - Số lượng worker và công việc trong hàng đợi
    - Hiệu suất cache và sử dụng tài nguyên
  - Trang dashboard trực quan hiển thị thông tin quan trọng về hệ thống
  - Middleware correlation tự động kèm correlation ID trong mọi request
- Thêm chức năng đồng bộ thông tin kho hàng từ hệ thống Nhanh.vn sang Shopify
- Thêm module logging cơ bản ghi lại thông tin đồng bộ và lỗi
- Tạo cấu trúc dự án (folders) theo mô hình MVC đơn giản
- Cài đặt đối tượng Prisma Client để tương tác với cơ sở dữ liệu
- Bổ sung hệ thống kiểm soát rate limit (tốc độ gọi API)
- Tạo file nhanh.ts để xử lý việc gọi API từ Nhanh.vn
- Thêm file syncService.ts để quản lý quy trình đồng bộ
- Đồng bộ thông tin tồn kho từ Nhanh.vn sang Shopify
- Module logging cơ bản cho quá trình đồng bộ và theo dõi lỗi
- Cấu trúc dự án theo mô hình MVC đơn giản
- Triển khai Prisma Client để tương tác với cơ sở dữ liệu
- Cải tiến hệ thống kiểm soát giới hạn request (rate limiting)
- Tạo các file `nhanh.ts` cho các API call và `syncService.ts` cho quản lý đồng bộ
- Cải tiến quản lý cache, bao gồm:
  - Cache đa lớp với cơ chế fallback
  - Chính sách loại bỏ cache (LRU)
  - Cấu hình linh hoạt thông qua biến môi trường
  - Kiểm tra kết nối Redis tự động
- Cải tiến Worker Pool, bao gồm:
  - Hỗ trợ pool động với khả năng tự động tăng/giảm số lượng worker
  - Chính sách scaling dựa trên số lượng công việc đang chờ
  - Hệ thống ưu tiên hóa tasks với priority queue
  - Theo dõi hiệu suất worker và thu thập các metrics
  - Cơ chế timeout cho các tasks quá lâu
- Tích hợp khóa phân tán (distributed locking) vào worker-threads:
  - Thêm cơ chế khóa phân tán cho các tác vụ worker
  - Bổ sung tham số useDistributedLock cho worker tasks
  - Tự động bỏ qua tác vụ trùng lặp dựa trên khóa tài nguyên
  - Hỗ trợ tùy chỉnh lockTTL và lockResourceId
  - Thêm ví dụ về cách sử dụng worker với khóa phân tán
- Cải thiện Batch Processing:
  - Triển khai batch processing thích ứng với kích thước batch động
  - Theo dõi hiệu suất xử lý và điều chỉnh kích thước batch tự động
  - Thêm cơ chế backoff thông minh khi xử lý batch chậm hoặc có lỗi
  - Hệ thống ưu tiên hóa sản phẩm khi đồng bộ dựa trên nhiều tiêu chí:
    - Tần suất đồng bộ trước đây
    - Thời gian kể từ lần đồng bộ cuối
    - Lịch sử lỗi của sản phẩm
    - Mức độ tồn kho
    - Thời gian trong ngày
  - Tự động phân bổ lại các batch còn lại khi thay đổi kích thước
  - Theo dõi và ghi log chi tiết về hiệu suất và kích thước batch

### Fixed
- Bug trong API đồng bộ tự động:
  - Sửa lỗi kiểu dữ liệu syncType trong file sync/auto/route.ts
  - Thay thế ScheduledSync bằng SyncLog để giải quyết vấn đề với Prisma client:
    - Xóa model ScheduledSync khỏi schema.prisma
    - Mở rộng model SyncLog để lưu trữ thông tin lịch trình đồng bộ
    - Sửa lại API endpoints để sử dụng SyncLog thay vì ScheduledSync
  - Sửa lỗi trong xử lý request body
  - Sửa lỗi TypeScript type checking:
    - Định nghĩa interface SyncSettings để xử lý lỗi '{}' is not assignable to parameter of type 'string'
    - Cập nhật interface JwtPayload để xử lý kiểu dữ liệu rõ ràng cho token
    - Làm rõ kiểu dữ liệu cho các đối số truyền vào hàm
  - Sửa lỗi không cập nhật được trạng thái đồng bộ tự động trong cài đặt:
    - Thay đổi tên key từ sync_auto_enabled sang sync_auto để khớp với key trong database
    - Cập nhật tất cả các references trong các file API route và trang cài đặt
- Lỗi imports và TypeScript trong src/lib/nhanh.ts:
  - Sửa lỗi import module không tồn tại './logging' bằng cách tạo logger đơn giản trực tiếp trong file
  - Sửa lỗi import prismaClient không đúng cách từ './prisma' thành `import prisma from './prisma'`
  - Sửa lỗi kiểu dữ liệu `any` ngầm định cho tham số `item` trong hàm `settings.forEach`
  - Cải thiện cơ chế retry trong hàm `callNhanhAPI`: loại bỏ biến `attempt` cố định và sử dụng callback `onRetry` để ghi log

### Changed
- Điều chỉnh cách lưu trữ dữ liệu lịch đồng bộ:
  - Sử dụng SyncLog với action có tiền tố 'schedule_' thay vì bảng riêng
  - Format lại dữ liệu trả về cho API để đảm bảo tương thích với giao diện
- Cải thiện hệ thống type:
  - Thêm type definitions rõ ràng trong lib/auth.ts
  - Sử dụng TypeScript interfaces thay vì các kiểu dữ liệu any và object
- Cải thiện cơ chế đồng bộ tự động:
  - Tách biệt worker thành process riêng không phụ thuộc vào trình duyệt
  - Lưu trạng thái worker vào database thay vì biến trong bộ nhớ
  - Cải thiện cơ chế xử lý lỗi và retry
- Cải thiện hệ thống Rate Limiting
  - Tạo cấu trúc rate limiter linh hoạt
  - Tích hợp thông tin phản hồi từ API
  - Cơ chế backpressure thích ứng
  - Điều chỉnh tốc độ refill động
- Triển khai mô hình Circuit Breaker
  - Tạo module circuit breaker với ba trạng thái chính
  - Cơ chế chuyển đổi trạng thái thông minh
  - Tích hợp vào syncService cho cả Shopify và Nhanh.vn API
  - Cung cấp metrics và hỗ trợ fallback khi API không khả dụng
- Cải thiện Quản lý Cache
  - Triển khai cache đa tầng với fallback khi Redis không khả dụng
  - Thêm eviction policy (LRU) để quản lý kích thước cache
  - Cấu hình linh hoạt qua biến môi trường
  - Tự động kiểm tra và phục hồi kết nối Redis
  - Cung cấp thống kê hiệu suất cache
- Tái cấu trúc mô hình Rate Limiting và Circuit Breaker
- Thay đổi cơ chế xử lý lỗi API
- Cải tiến hệ thống đồng bộ hóa dữ liệu
- Sử dụng distributed locking để tránh race condition
- Nâng cấp hiệu suất worker với cơ chế phân phối công việc thông minh hơn

### Removed
- Khắc phục lỗi trùng lặp sản phẩm khi đồng bộ
- Sửa lỗi memory leak trong worker pool
- Cải thiện khả năng khôi phục sau lỗi mạng

## [0.3.0] - 2024-11-11
### Added
- Tự động hóa quy trình đồng bộ
  - Tạo API endpoint `/api/sync/auto` để chạy đồng bộ tự động cho nhiều sản phẩm
  - Tạo API endpoint `/api/sync/schedule` để lên lịch đồng bộ tự động
  - Theo dõi tiến trình đồng bộ với thông tin chi tiết (tổng số, thành công, lỗi)
  - Tạo giao diện /sync để theo dõi và quản lý đồng bộ tự động
  - Xử lý đồng bộ song song cho cả tồn kho và giá
  - Hỗ trợ lọc loại đồng bộ (tồn kho, giá, hoặc cả hai)

## [0.2.0] - 2024-11-10
### Added
- Chức năng đồng bộ giá từ Nhanh.vn sang Shopify
  - Thêm API endpoint `/api/price` để xử lý việc đồng bộ giá
  - Cập nhật component ProductTable để thêm hàm `handleSyncPrice` và UI hiển thị nút đồng bộ giá
  - Hỗ trợ đồng bộ giá trong cả 3 dạng xem (Table, Grid, Card)
  - Lưu lịch sử đồng bộ giá vào bảng SyncLog với action="sync_price"

## [0.1.0] - 2024-11-01
### Added
- Tính năng đồng bộ tồn kho từ Nhanh.vn sang Shopify
- Hệ thống xác thực và phân quyền người dùng
- Mapping sản phẩm giữa Shopify và Nhanh.vn
- Quản lý cài đặt API keys
- Dashboard và báo cáo cơ bản 