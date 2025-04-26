const express = require('express');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const { syncInventory } = require('../src/lib/syncService');

// Khởi tạo Prisma Client
const prisma = new PrismaClient();

// Tạo ứng dụng Express
const app = express();
app.use(bodyParser.json());

// Khóa bảo mật để xác minh webhook
const WEBHOOK_SECRET = process.env.NHANH_WEBHOOK_SECRET || 'your-webhook-secret';

// Cổng server
const PORT = process.env.WEBHOOK_PORT || 3030;

// Lấy cài đặt hệ thống
async function getSettings() {
  try {
    const settingsData = await prisma.setting.findMany();
    const settings = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    return settings;
  } catch (error) {
    console.error('Lỗi khi lấy cài đặt:', error);
    return {};
  }
}

// Xử lý webhook khi có thay đổi tồn kho
app.post('/webhook/inventory', async (req, res) => {
  try {
    // Xác thực webhook
    const signature = req.headers['x-nhanh-signature'];
    if (!signature || signature !== WEBHOOK_SECRET) {
      console.error('Sai chữ ký webhook');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Log dữ liệu đến
    console.log('Nhận webhook inventory từ Nhanh.vn:', new Date().toISOString());
    
    // Trả về ngay để Nhanh.vn biết đã nhận webhook 
    // (xử lý bất đồng bộ phía sau để tránh timeout)
    res.status(200).json({ success: true });
    
    // Lấy dữ liệu từ webhook
    const payload = req.body;
    
    // Kiểm tra cấu trúc payload
    if (!payload || !payload.products || !Array.isArray(payload.products)) {
      console.error('Cấu trúc webhook không hợp lệ:', payload);
      return;
    }
    
    // Lấy cài đặt
    const settings = await getSettings();
    
    // Đếm số lượng để thống kê
    let processedCount = 0;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Xử lý từng sản phẩm trong webhook
    console.log(`Bắt đầu xử lý ${payload.products.length} sản phẩm từ webhook`);
    
    for (const product of payload.products) {
      try {
        // Thiếu thông tin nhanhId
        if (!product.id) {
          console.warn('Sản phẩm thiếu ID Nhanh');
          errorCount++;
          continue;
        }
        
        // Tìm product mapping dựa trên ID Nhanh
        const productMapping = await prisma.productMapping.findFirst({
          where: {
            externalId: product.id.toString()
          }
        });
        
        // Nếu không tìm thấy sản phẩm tương ứng
        if (!productMapping) {
          console.log(`Không tìm thấy sản phẩm với ID Nhanh: ${product.id}`);
          skipCount++;
          continue;
        }
        
        console.log(`Đồng bộ real-time sản phẩm ID: ${productMapping.id}, Nhanh ID: ${product.id}`);
        
        // Chuẩn bị dữ liệu Nhanh.vn
        const nhanhData = {
          idNhanh: product.id,
          inventory: product.inventory || 0,
          name: product.name || ''
        };
        
        // Thực hiện đồng bộ
        const result = await syncInventory(productMapping, nhanhData, settings, 'webhook');
        
        if (result && result.updated) {
          successCount++;
          console.log(`✅ ID ${productMapping.id}: Đã cập nhật tồn kho thành công`);
        } else if (result && result.skipped) {
          skipCount++;
          console.log(`⏭️ ID ${productMapping.id}: Bỏ qua (${result.reason || 'không thay đổi'})`);
        } else {
          errorCount++;
          console.error(`❌ ID ${productMapping.id}: Lỗi - ${result?.error || 'không xác định'}`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`Lỗi khi xử lý sản phẩm từ webhook: ${error.message}`, error);
        errorCount++;
      }
    }
    
    // Lưu log vào database
    await prisma.syncLog.create({
      data: {
        action: 'webhook_inventory',
        status: 'completed',
        message: `Xử lý webhook: ${successCount} cập nhật, ${skipCount} bỏ qua, ${errorCount} lỗi`,
        details: JSON.stringify({
          total: payload.products.length,
          processed: processedCount,
          success: successCount,
          skipped: skipCount,
          error: errorCount,
          timestamp: new Date().toISOString()
        }),
        createdBy: 'webhook'
      }
    });
    
    console.log(`Hoàn thành xử lý webhook: ${successCount} cập nhật, ${skipCount} bỏ qua, ${errorCount} lỗi`);
    
  } catch (error) {
    console.error('Lỗi khi xử lý webhook:', error);
  }
});

// Endpoint kiểm tra trạng thái
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Bắt đầu server
app.listen(PORT, () => {
  console.log(`[Webhook] Server đang lắng nghe trên cổng ${PORT}`);
  console.log(`[Webhook] URL: http://your-domain.com:${PORT}/webhook/inventory`);
  console.log('[Webhook] Lưu ý: Bạn cần cấu hình webhook trên Nhanh.vn để gửi thông báo đến URL này');
});

// Xử lý khi nhận SIGTERM hoặc SIGINT
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

async function shutDown() {
  console.log('[Webhook] Đang dừng server webhook...');
  try {
    await prisma.$disconnect();
  } catch (e) {}
  process.exit(0);
} 