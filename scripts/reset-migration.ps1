# Dừng ứng dụng nếu đang chạy
Write-Host "Kiểm tra và dừng ứng dụng nếu đang chạy..." -ForegroundColor Cyan
try { 
    pm2 stop all 
} catch {
    # Không làm gì nếu lỗi
}

# Reset database và migration
Write-Host "Xóa và tạo lại database..." -ForegroundColor Cyan
mysql -u root -e "DROP DATABASE IF EXISTS apimodern_db;"
mysql -u root -e "CREATE DATABASE apimodern_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "GRANT ALL PRIVILEGES ON apimodern_db.* TO 'apimodern_user'@'localhost';"
mysql -u root -e "GRANT ALL PRIVILEGES ON mysql.* TO 'apimodern_user'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"

# Chạy migration
Write-Host "Chạy migration..." -ForegroundColor Cyan
npx prisma migrate deploy

# Khởi tạo dữ liệu
Write-Host "Khởi tạo dữ liệu ban đầu..." -ForegroundColor Cyan
npm run db:init

# Khởi động lại ứng dụng
Write-Host "Khởi động lại ứng dụng..." -ForegroundColor Cyan
try { 
    pm2 start ecosystem.config.js 
} catch {
    # Không làm gì nếu lỗi
}

Write-Host "Hoàn tất! Migration đã được reset và chạy lại." -ForegroundColor Green 