# Nhanh.vn Webhook Receiver

Đây là dịch vụ nhận webhook từ Nhanh.vn để đồng bộ hóa tồn kho theo thời gian thực giữa Nhanh.vn và Shopify.

## Cài đặt

1. Cài đặt các package phụ thuộc:

```bash
npm install express body-parser crypto
```

2. Cấu hình các biến môi trường (trong file `.env` hoặc sử dụng công cụ quản lý biến môi trường của bạn):

```
WEBHOOK_PORT=3333
NHANH_WEBHOOK_SECRET=your-secure-secret-key
NODE_ENV=production
```

## Khởi động dịch vụ

Để khởi động dịch vụ webhook, chạy:

```bash
node scripts/webhook/nhanh-webhook-receiver.js
```

Hoặc sử dụng PM2 để chạy dịch vụ trong nền:

```bash
pm2 start scripts/webhook/nhanh-webhook-receiver.js --name nhanh-webhook
```

## Cấu hình Nhanh.vn

1. Đăng nhập vào hệ thống quản trị Nhanh.vn
2. Vào phần cài đặt Webhook
3. Thêm một webhook mới với:
   - URL: `http://your-domain.com:3333/webhook/inventory`
   - Secret key: Giá trị giống với `NHANH_WEBHOOK_SECRET` trong file .env
   - Events: Chọn events liên quan đến thay đổi tồn kho ("Product Inventory Update" hoặc tương tự)

## Kiểm tra trạng thái

Để kiểm tra trạng thái hoạt động của webhook receiver, truy cập:

```
http://your-domain.com:3333/status
```

Endpoint này sẽ trả về thông tin như:
- Thời gian uptime
- Số lượng webhook đã nhận
- Số lượng webhook đã xử lý thành công
- Số lượng lỗi

## Cấu trúc dữ liệu Webhook

Dịch vụ này mong đợi payload webhook từ Nhanh.vn có cấu trúc:

```json
{
  "event": "inventory_update",
  "data": {
    "products": [
      {
        "idNhanh": 123456,
        "inventory": 10,
        "name": "Tên sản phẩm"
      },
      // ... các sản phẩm khác
    ]
  }
}
```

## Bảo mật

Dịch vụ sử dụng HMAC SHA-256 để xác minh tính xác thực của webhook từ Nhanh.vn. Trong môi trường production, việc xác minh webhook signature là bắt buộc.

## Xử lý lỗi

Tất cả các lỗi trong quá trình xử lý webhook được ghi lại trong database (bảng `syncLog`) và hiển thị trong console.

## Sử dụng với NGINX

Nếu bạn đang sử dụng NGINX làm reverse proxy, cấu hình sau đây có thể hữu ích:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /webhook/ {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
``` 