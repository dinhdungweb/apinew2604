# Khởi động worker trên Windows
Write-Host "Đang khởi động APIModern Worker..." -ForegroundColor Green

# Kiểm tra xem đã cài đặt PM2 chưa
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Exists) {
    Write-Host "Không tìm thấy PM2. Đang cài đặt PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

# Khởi động worker bằng PM2
Write-Host "Đang khởi động worker bằng PM2..." -ForegroundColor Cyan
pm2 start .\ecosystem.config.js --only apimodern-worker
Write-Host "Worker đã được khởi động!" -ForegroundColor Green

# Hiển thị trạng thái
pm2 status 