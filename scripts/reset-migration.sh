#!/bin/bash

# Dừng ứng dụng nếu đang chạy
echo "Kiểm tra và dừng ứng dụng nếu đang chạy..."
pm2 stop all || true

# Đảm bảo quyền cho user database
echo "Đảm bảo quyền truy cập database..."
sudo mysql -e "GRANT ALL PRIVILEGES ON apimodern_db.* TO 'apimodern_user'@'localhost';"
sudo mysql -e "GRANT ALL PRIVILEGES ON mysql.* TO 'apimodern_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Reset database
echo "Xóa và tạo lại database..."
sudo mysql -e "DROP DATABASE IF EXISTS apimodern_db;"
sudo mysql -e "CREATE DATABASE apimodern_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Chạy migrations
echo "Chạy migration..."
npx prisma migrate deploy

# Khởi tạo dữ liệu
echo "Khởi tạo dữ liệu ban đầu..."
npm run db:init

# Chạy lại ứng dụng
echo "Khởi động lại ứng dụng..."
pm2 start ecosystem.config.js || true

echo "Hoàn tất! Migration đã được reset và chạy lại." 