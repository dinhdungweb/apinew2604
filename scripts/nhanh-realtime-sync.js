const { PrismaClient } = require('@prisma/client');
const { syncInventory, getNhanhData } = require('../src/lib/syncService');

// Khởi tạo Prisma Client
const prisma = new PrismaClient();

// Cấu hình polling
const POLL_INTERVAL = process.env.POLL_INTERVAL_MS || 60000; // 1 phút mặc định
const BATCH_SIZE = 10; // Số sản phẩm xử lý mỗi lần poll
let isRunning = false;
let lastRunTime = null;

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

// Hàm trì hoãn
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm chính để polling đồng bộ
async function pollInventoryChanges() {
  if (isRunning) {
    console.log('Đã có một phiên đồng bộ đang chạy, bỏ qua lần này');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();
  console.log(`[${lastRunTime.toLocaleString()}] Bắt đầu polling tồn kho từ Nhanh.vn...`);

  try {
    // Lấy cài đặt
    const settings = await getSettings();
    
    // Kiểm tra nếu settings còn thiếu
    if (!settings.nhanh_api_key || !settings.nhanh_business_id || !settings.nhanh_app_id) {
      console.error('Thiếu cài đặt Nhanh.vn API. Không thể đồng bộ.');
      return;
    }

    // Lấy danh sách sản phẩm cần kiểm tra (ưu tiên sản phẩm lỗi, mới cập nhật)
    const products = await prisma.productMapping.findMany({
      where: {
        OR: [
          { status: 'error' },
          { 
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Cập nhật trong 24h
            }
          }
        ]
      },
      orderBy: [
        { status: 'desc' }, // Ưu tiên status = error
        { updatedAt: 'desc' } // Sau đó là mới cập nhật
      ],
      take: BATCH_SIZE
    });

    if (products.length === 0) {
      console.log('Không tìm thấy sản phẩm cần kiểm tra.');
      return;
    }

    console.log(`Tìm thấy ${products.length} sản phẩm cần polling.`);

    // Khởi tạo bộ đếm
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Xử lý từng sản phẩm
    for (const product of products) {
      try {
        // Bỏ qua nếu không có externalId
        if (!product.externalId) {
          console.log(`Sản phẩm ID ${product.id} không có externalId (Nhanh ID), bỏ qua.`);
          skippedCount++;
          continue;
        }

        console.log(`Kiểm tra sản phẩm ${product.id}, Nhanh ID: ${product.externalId}`);

        // Lấy dữ liệu hiện tại từ Nhanh.vn
        const nhanhResponse = await getNhanhData(product.externalId, settings);
        
        // Kiểm tra phản hồi
        if (!nhanhResponse || nhanhResponse.code !== '1' || !nhanhResponse.data || !nhanhResponse.data.products) {
          console.error(`Không thể lấy dữ liệu từ Nhanh.vn cho sản phẩm ${product.externalId}`);
          errorCount++;
          continue;
        }

        // Tìm sản phẩm từ phản hồi
        const nhanhProduct = nhanhResponse.data.products.find(p => p.idNhanh == product.externalId);
        
        if (!nhanhProduct) {
          console.log(`Không tìm thấy sản phẩm ${product.externalId} trong dữ liệu Nhanh.vn`);
          skippedCount++;
          continue;
        }

        // Chuẩn bị dữ liệu Nhanh.vn
        const nhanhData = {
          idNhanh: nhanhProduct.idNhanh,
          inventory: nhanhProduct.inventory,
          name: nhanhProduct.name
        };

        // Thực hiện đồng bộ
        const result = await syncInventory(product, nhanhData, settings, 'realtime');

        if (result && result.updated) {
          updatedCount++;
          console.log(`✅ Đã cập nhật tồn kho cho sản phẩm ${product.id}: ${nhanhData.inventory}`);
        } else if (result && result.skipped) {
          skippedCount++;
          console.log(`⏭️ Bỏ qua sản phẩm ${product.id}: ${result.reason || 'không thay đổi'}`);
        } else {
          errorCount++;
          console.error(`❌ Lỗi khi đồng bộ sản phẩm ${product.id}: ${result?.error || 'không xác định'}`);
        }

        // Đợi một chút giữa các API call để tránh rate limit
        await sleep(1000);
      } catch (error) {
        console.error(`Lỗi khi xử lý sản phẩm ${product.id}:`, error);
        errorCount++;
      }
    }

    // Tạo bản ghi đồng bộ
    await prisma.syncLog.create({
      data: {
        action: 'realtime_sync',
        status: 'completed',
        message: `Đồng bộ real-time: ${updatedCount} cập nhật, ${skippedCount} bỏ qua, ${errorCount} lỗi`,
        details: JSON.stringify({
          total: products.length,
          updated: updatedCount,
          skipped: skippedCount,
          error: errorCount,
          timestamp: new Date().toISOString(),
          pollInterval: POLL_INTERVAL
        }),
        createdBy: 'realtime'
      }
    });

    console.log(`Hoàn thành polling: ${updatedCount} cập nhật, ${skippedCount} bỏ qua, ${errorCount} lỗi`);

  } catch (error) {
    console.error('Lỗi khi polling tồn kho:', error);
  } finally {
    isRunning = false;
  }
}

// Lên lịch chạy định kỳ
console.log(`Bắt đầu hệ thống đồng bộ real-time với chu kỳ ${POLL_INTERVAL}ms`);

// Chạy lần đầu ngay khi khởi động
pollInventoryChanges();

// Lên lịch chạy định kỳ
const interval = setInterval(pollInventoryChanges, POLL_INTERVAL);

// Xử lý tắt ứng dụng
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
  console.log('Đang tắt hệ thống đồng bộ real-time...');
  clearInterval(interval);
  prisma.$disconnect()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Hiển thị trạng thái cho người dùng
console.log(`
===================================================
🔄 HỆ THỐNG ĐỒNG BỘ REAL-TIME TỒN KHO NHANH.VN
===================================================
✅ Đang chạy với chu kỳ: ${POLL_INTERVAL/1000} giây
✅ Số lượng mỗi lần: ${BATCH_SIZE} sản phẩm
✅ Ưu tiên: Sản phẩm lỗi và mới cập nhật

👉 Để xem log real-time: tail -f logs/realtime-sync.log
👉 Để thoát, nhấn Ctrl+C
===================================================
`); 