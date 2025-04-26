const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Hàm cập nhật trạng thái cho các tác vụ lỗi
 */
async function fixErrorTasks() {
  try {
    console.log('Đang tìm kiếm các tác vụ lỗi với thiếu cấu hình Shopify...');
    
    // Tìm các tác vụ error liên quan đến thiếu cấu hình Shopify
    const errorTasks = await prisma.syncLog.findMany({
      where: {
        status: 'error',
        message: {
          contains: 'Thiếu cấu hình Shopify'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });
    
    console.log(`Tìm thấy ${errorTasks.length} tác vụ lỗi cần sửa chữa.`);
    
    // Kiểm tra cài đặt hệ thống
    const settingsData = await prisma.setting.findMany();
    const settings = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    // Hiển thị cài đặt hiện tại
    console.log('\n=== CÀI ĐẶT HIỆN TẠI ===');
    console.log(`Shopify Store: ${settings.shopify_store || 'Không có'}`);
    console.log(`Shopify Access Token: ${settings.shopify_access_token ? '[Đã cấu hình]' : 'Không có'}`);
    console.log(`Shopify Location ID: ${settings.shopify_location_id || 'Không có'}`);
    console.log(`Nhanh API Key: ${settings.nhanh_api_key ? '[Đã cấu hình]' : 'Không có'}`);
    console.log(`Nhanh Business ID: ${settings.nhanh_business_id || 'Không có'}`);
    
    // Kiểm tra xem cài đặt đã đầy đủ chưa
    if (!settings.shopify_store || !settings.shopify_access_token) {
      console.error('\nKhông thể sửa chữa tác vụ vì cài đặt vẫn chưa đầy đủ!');
      console.log('Vui lòng cập nhật cài đặt trước khi thử lại.');
      return;
    }
    
    // Đặt các tác vụ về trạng thái chờ để thử lại
    let updatedCount = 0;
    
    for (const task of errorTasks) {
      try {
        // Cập nhật trạng thái tác vụ về pending
        await prisma.syncLog.update({
          where: {
            id: task.id
          },
          data: {
            status: 'pending',
            message: 'Đã sửa chữa từ trạng thái lỗi, chờ xử lý lại'
          }
        });
        
        console.log(`✅ Đã sửa chữa tác vụ #${task.id} - ${task.action}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Lỗi khi sửa chữa tác vụ #${task.id}:`, error.message);
      }
    }
    
    console.log(`\nĐã sửa chữa ${updatedCount}/${errorTasks.length} tác vụ lỗi thành công.`);
    console.log('Các tác vụ đã được đặt về trạng thái "pending" và sẽ được xử lý lại khi worker chạy.');
    
  } catch (error) {
    console.error('Lỗi khi sửa chữa tác vụ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi hàm chính
fixErrorTasks().catch(error => {
  console.error('Lỗi không xử lý được:', error);
  process.exit(1);
}); 