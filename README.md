# SyncHub - Hệ thống đồng bộ Shopify và Nhanh.vn

SyncHub là một ứng dụng web giúp đồng bộ dữ liệu sản phẩm giữa Shopify và Nhanh.vn, bao gồm thông tin tồn kho và giá cả.

## Tính năng chính

### Mapping sản phẩm
- Tự động mapping sản phẩm giữa Shopify và Nhanh.vn
- Quản lý và chỉnh sửa mapping thủ công
- Hiển thị trạng thái mapping và thông tin chi tiết

### Đồng bộ dữ liệu
- Đồng bộ tồn kho từ Nhanh.vn sang Shopify
- Đồng bộ giá bán từ Nhanh.vn sang Shopify
- Lịch sử đồng bộ chi tiết với thông tin về trạng thái, thời gian và dữ liệu đã đồng bộ

### Tự động hóa quy trình đồng bộ
- Đồng bộ tự động nhiều sản phẩm cùng lúc
- Lên lịch đồng bộ theo thời gian cài đặt
- Theo dõi tiến trình và thống kê đồng bộ (tổng số, thành công, lỗi)
- Giao diện quản lý và giám sát quá trình đồng bộ
- Hỗ trợ lọc loại đồng bộ (tồn kho, giá, hoặc cả hai)
- Worker độc lập để đồng bộ tự động không phụ thuộc vào trình duyệt

### Quản lý hệ thống
- Quản lý người dùng với phân quyền (Admin, Editor, Viewer)
- Cài đặt API keys cho Shopify và Nhanh.vn
- Báo cáo và thống kê
- Giám sát trạng thái worker đồng bộ

## Công nghệ sử dụng
- Frontend: React, Next.js, TailwindCSS
- Backend: Node.js, Next.js API Routes
- Database: MySQL với Prisma ORM
- Authentication: JWT
- Job Queue: Bull với Redis
- Worker Management: PM2

## Hướng dẫn cài đặt

1. Clone repository
```bash
git clone <repository_url>
```

2. Cài đặt dependencies
```bash
npm install
```

3. Tạo file .env và cấu hình
```
DATABASE_URL="mysql://user:password@localhost:3306/api_modern"
JWT_SECRET="your-secret-key"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD="" # nếu có
```

4. Khởi tạo database
```bash
npx prisma migrate dev
```

5. Chạy ứng dụng
```bash
npm run dev
```

## Sử dụng Worker đồng bộ độc lập

Worker đồng bộ là một process riêng biệt, chạy độc lập với ứng dụng web. Worker này sẽ liên tục kiểm tra và thực hiện các tác vụ đồng bộ đã lên lịch, ngay cả khi không có người dùng đăng nhập vào hệ thống.

### Cài đặt và khởi động Worker

1. Cài đặt PM2 (Process Manager)
```bash
npm install -g pm2
```

2. Khởi động worker bằng PM2
```bash
pm2 start ecosystem.config.js --only apimodern-worker
```

Hoặc sử dụng script PowerShell (Windows):
```bash
.\scripts\start-worker.ps1
```

3. Kiểm tra trạng thái worker
```bash
pm2 status
pm2 logs apimodern-worker
```

4. Dừng worker
```bash
pm2 stop apimodern-worker
```

5. Khởi động lại worker
```bash
pm2 restart apimodern-worker
```

### Cài đặt để worker tự khởi động khi server khởi động lại

```bash
pm2 startup
pm2 save
```

### Giám sát và quản lý tác vụ đồng bộ

Bạn có thể theo dõi trạng thái Worker và các tác vụ đồng bộ thông qua giao diện web tại trang Cài đặt hệ thống. Các thông tin hiển thị bao gồm:
- Trạng thái hoạt động của worker
- Thời gian worker bắt đầu chạy
- Số lượng công việc đang chờ và đang được xử lý
- Thời gian kiểm tra gần nhất

## Phiên bản

Xem chi tiết phiên bản và lịch sử phát triển trong [CHANGELOG.md](CHANGELOG.md).



Bảng điều khiển nâng cao
Dashboard insights: Thêm biểu đồ phân tích xu hướng đồng bộ
Predictive analytics: Dự đoán thời điểm tốt nhất để đồng bộ dựa trên lịch sử
Filtering và sorting: Cải thiện khả năng tìm kiếm và lọc sản phẩm
3. Mở rộng tính năng
3.1. Đồng bộ hai chiều
Hỗ trợ đồng bộ từ Shopify sang Nhanh.vn: Cho phép đồng bộ ngược dữ liệu
Conflict resolution: Xử lý xung đột khi cả hai nguồn đều thay đổi
3.2. Tính năng backup và khôi phục
Lịch sử phiên bản: Lưu trữ lịch sử thay đổi của sản phẩm
Khôi phục điểm: Cho phép khôi phục đến một thời điểm cụ thể
Export/Import: Xuất nhập dữ liệu mapping và cấu hình
3.3. Hỗ trợ nhiều nguồn dữ liệu
Mở rộng sang các nền tảng khác: WooCommerce, Haravan, Sapo
Adapter pattern: Kiến trúc adapter để dễ dàng tích hợp nguồn mới
Triển khai Circuit Breaker
Đầu việc 5.1: Tạo module circuit breaker
Tạo file src/lib/circuit-breaker.ts
Cài đặt các trạng thái: closed, open, half-open
Cấu hình threshold, timeout, reset
Đầu việc 5.2: Tích hợp circuit breaker vào quy trình đồng bộ
Áp dụng circuit breaker cho các API calls
Bổ sung metric theo dõi trạng thái circuit
Thêm thông báo khi circuit mở (tạm dừng đồng bộ)
6. Cải thiện Quản lý Cache
Đầu việc 6.1: Tối ưu bộ nhớ cache
Sửa src/lib/syncCache.ts để áp dụng eviction policy
Thiết lập giới hạn cache size dựa trên cấu hình
Thêm cơ chế xóa cache cũ
Đầu việc 6.2: Thêm cache fallback
Cài đặt cache cục bộ (in-memory) khi Redis lỗi
Sử dụng thư viện như node-cache hoặc lru-cache
Tự động chuyển đổi giữa Redis và cache cục bộ
Ưu tiên thấp
7. Tạo Module Cấu hình Tập trung
Đầu việc 7.1: Thiết kế module cấu hình
Tạo file src/lib/config.ts
Đọc cấu hình từ biến môi trường và database
Xác thực và chuẩn hóa cấu hình
Đầu việc 7.2: Thống nhất sử dụng cấu hình
Thay thế các giá trị hard-coded bằng tham chiếu đến module cấu hình
Bổ sung khả năng thay đổi cấu hình runtime
Thêm API endpoint để cập nhật cấu hình
8. Cải thiện Worker Pool
Đầu việc 8.1: Cài đặt worker pool động
Sửa src/lib/worker-threads.ts để hỗ trợ pool động
Thêm scaling policy dựa trên số lượng công việc đang chờ
Thêm metric theo dõi hiệu suất worker
Đầu việc 8.2: Tối ưu phân phối công việc
Thêm ưu tiên hóa tasks (priority queue)
Cải thiện chiến lược phân phối việc cho workers
Thêm cơ chế timeout cho tasks quá lâu
9. Cải thiện Batch Processing
Đầu việc 9.1: Triển khai batch processing thích ứng
Sửa src/lib/batch-processor.ts để điều chỉnh batch size động
Theo dõi tốc độ xử lý và điều chỉnh kích thước batch
Thêm cơ chế backoff khi xử lý batch chậm
Đầu việc 9.2: Thêm ưu tiên hóa cho batch
Thêm logic sắp xếp ưu tiên sản phẩm cần đồng bộ
Ưu tiên sản phẩm thay đổi nhiều, gần đây, hoặc đã lâu không đồng bộ
Tạo chiến lược phân bổ đồng bộ dựa trên thời gian trong ngày
10. Cải thiện Logging và Monitoring
Đầu việc 10.1: Cải thiện logging
Thay thế console.log bằng logger chuẩn như winston
Thêm correlation ID để theo dõi luồng xử lý
Phân cấp log levels (debug, info, warn, error)
Đầu việc 10.2: Thêm monitoring và trực quan hóa
Thêm endpoint API để lấy metrics
Tích hợp prometheus để thu thập metrics
Tạo dashboard để theo dõi hiệu suất đồng bộ

## Triển khai lên VPS Ubuntu 22.04

### 1. Chuẩn bị VPS

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt các phần mềm cần thiết
sudo apt install -y git curl build-essential
```

### 2. Cài đặt Node.js

```bash
# Cài đặt NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Áp dụng các thay đổi
source ~/.bashrc

# Cài đặt Node.js v18 (phù hợp với dự án)
nvm install 18
nvm use 18
nvm alias default 18
```

### 3. Cài đặt MySQL

```bash
# Cài đặt MySQL server
sudo apt install -y mysql-server

# Bảo mật cài đặt MySQL
sudo mysql_secure_installation

# Tạo database và user cho ứng dụng
sudo mysql -e "CREATE DATABASE apimodern_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'apimodern_user'@'localhost' IDENTIFIED BY 'mat_khau_an_toan';"
sudo mysql -e "GRANT ALL PRIVILEGES ON apimodern_db.* TO 'apimodern_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### 4. Cài đặt Redis (yêu cầu phiên bản 6.2.0 trở lên)

```bash
# Thêm PPA để cài đặt Redis mới hơn
sudo add-apt-repository ppa:redislabs/redis -y
sudo apt update

# Cài đặt Redis server
sudo apt install -y redis-server

# Cấu hình Redis để chạy với systemd
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 5. Clone dự án

```bash
# Tạo thư mục chứa ứng dụng
mkdir -p /var/www/
cd /var/www/

# Clone dự án từ repository (thay thế URL với repository của bạn)
git clone <repository_url> apimodern
cd apimodern
```

### 6. Cấu hình môi trường

```bash
# Tạo file .env
cat > .env << EOF
# Database
DATABASE_URL="mysql://apimodern_user:mat_khau_an_toan@localhost:3306/apimodern_db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Worker
WORKER_CONCURRENCY=5

# API Keys
SHOPIFY_API_KEY="your_shopify_api_key" 
SHOPIFY_API_SECRET="your_shopify_api_secret"
SHOPIFY_STORE_URL="https://your-store.myshopify.com"
SHOPIFY_ACCESS_TOKEN="your_shopify_access_token"

# Nhanh.vn API
NHANH_API_KEY="your_nhanh_api_key"
NHANH_USERNAME="your_nhanh_username"
NHANH_API_URL="https://api.nhanh.vn/api"

# JWT Authentication
JWT_SECRET="your_jwt_secret_key_at_least_32_chars"
JWT_EXPIRY="24h"

# Server Settings
PORT=3000
NODE_ENV="production"

# Logging
LOG_LEVEL="info"
EOF
```

### 7. Cài đặt các phụ thuộc và build ứng dụng

```bash
# Cài đặt các phụ thuộc
npm ci --legacy-peer-deps

# Tạo Prisma client
npx prisma generate

# Chạy migration database
npx prisma migrate deploy

# Khởi tạo database (tùy chọn)
npm run db:init

# Build ứng dụng
npm run build
```

### 8. Cài đặt PM2 để quản lý process

```bash
# Cài đặt PM2 toàn cục
npm install -g pm2

# Khởi động ứng dụng với PM2 sử dụng ecosystem.config.js
pm2 start ecosystem.config.js

# Cấu hình PM2 tự khởi động khi reboot server
pm2 startup
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u $(whoami) --hp $(echo $HOME)
pm2 save
```

### 9. Cài đặt Nginx làm reverse proxy

```bash
# Cài đặt Nginx
sudo apt install -y nginx

# Cấu hình Nginx
sudo tee /etc/nginx/sites-available/apimodern << EOF
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Kích hoạt cấu hình
sudo ln -s /etc/nginx/sites-available/apimodern /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 10. Cấu hình HTTPS với Certbot

```bash
# Cài đặt Certbot
sudo apt install -y certbot python3-certbot-nginx

# Lấy chứng chỉ SSL và cấu hình tự động
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

### 11. Cấu hình tường lửa

```bash
# Mở các cổng cần thiết
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

### 12. Cấu hình thư mục logs

```bash
# Tạo thư mục logs nếu chưa tồn tại
mkdir -p /var/www/apimodern/logs
chmod 755 /var/www/apimodern/logs

# Cấu hình logrotate để quản lý logs
sudo tee /etc/logrotate.d/apimodern << EOF
/var/www/apimodern/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
EOF
```

### 13. Khắc phục sự cố phổ biến

#### Lỗi Redis version

Nếu bạn nhận được cảnh báo "It is highly recommended to use a minimum Redis version of 6.2.0", hãy đảm bảo bạn đã cài đặt Redis ≥ 6.2.0 theo hướng dẫn bước 4.

#### Lỗi Navigator tại build time

Nếu bạn gặp lỗi "ReferenceError: navigator is not defined" khi build, hãy đảm bảo tất cả mã truy cập navigator (và các API trình duyệt khác) đều được kiểm tra `typeof window !== 'undefined'` trước khi sử dụng.

#### Xung đột phụ thuộc với React

Dự án này sử dụng React 19 và một số dependencies yêu cầu React phiên bản thấp hơn. Hãy luôn sử dụng flag `--legacy-peer-deps` khi cài đặt packages để tránh xung đột.

### 14. Bảo trì và cập nhật

```bash
# Cập nhật code mới
cd /var/www/apimodern
git pull

# Cài đặt các phụ thuộc mới
npm ci --legacy-peer-deps

# Tạo lại Prisma client
npx prisma generate

# Chạy migration database (nếu có thay đổi schema)
npx prisma migrate deploy

# Build lại ứng dụng
npm run build

# Khởi động lại dịch vụ
pm2 restart all
```

### 15. Theo dõi hệ thống

```bash
# Xem logs realtime
pm2 logs

# Xem thông tin và trạng thái hệ thống
pm2 monit

# Xem trạng thái các dịch vụ
pm2 status
```