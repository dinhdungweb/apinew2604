const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Hàm thử lại một tác vụ cụ thể
 * @param {number} taskId - ID của tác vụ cần thử lại
 */
async function retryTask(taskId) {
  try {
    // Kiểm tra tác vụ tồn tại
    const task = await prisma.syncLog.findUnique({
      where: {
        id: parseInt(taskId, 10)
      }
    });
    
    if (!task) {
      console.error(`Không tìm thấy tác vụ với ID: ${taskId}`);
      return;
    }
    
    console.log(`\n=== THÔNG TIN TÁC VỤ HIỆN TẠI ===`);
    console.log(`ID: ${task.id}`);
    console.log(`Hành động: ${task.action}`);
    console.log(`Trạng thái hiện tại: ${task.status || 'Không có'}`);
    console.log(`Thông báo: ${task.message || 'Không có'}`);
    console.log(`Người tạo: ${task.createdBy || 'Không có'}`);
    console.log(`Thời gian tạo: ${task.createdAt}`);
    
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
      console.error('\nKhông thể thử lại tác vụ vì cài đặt chưa đầy đủ!');
      console.log('Vui lòng cập nhật cài đặt trước khi thử lại.');
      return;
    }
    
    // Xác nhận với người dùng
    console.log(`\nBạn có chắc chắn muốn thử lại tác vụ #${task.id} không? (y/n)`);
    
    // Trong môi trường không tương tác, mặc định thực hiện
    // Trong môi trường thực tế, nên có xác nhận từ người dùng
    
    // Thực hiện thử lại tác vụ
    const updatedTask = await prisma.syncLog.update({
      where: {
        id: task.id
      },
      data: {
        status: 'pending',
        message: `Tác vụ đã được đặt lại để thử lại tại ${new Date().toLocaleString()}`
      }
    });
    
    console.log(`\n✅ Tác vụ #${task.id} (${task.action}) đã được đặt về trạng thái PENDING.`);
    console.log('Tác vụ sẽ được xử lý lại khi worker chạy.');
    
    // Nếu là tác vụ đồng bộ tồn kho, tạo tác vụ mới song song để đảm bảo thực thi
    if (task.action === 'sync_inventory') {
      const newTask = await prisma.syncLog.create({
        data: {
          action: 'sync_inventory',
          status: 'pending',
          message: `Tác vụ được tạo lại từ #${task.id}`,
          details: task.details,
          createdBy: 'system',
          productMappingId: task.productMappingId
        }
      });
      
      console.log(`\n✅ Đã tạo tác vụ mới #${newTask.id} (${newTask.action}) dựa trên tác vụ cũ.`);
      console.log('Tác vụ mới cũng sẽ được xử lý bởi worker.');
    }
    
  } catch (error) {
    console.error('Lỗi khi thử lại tác vụ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Hàm chính
 */
async function main() {
  try {
    const taskId = process.argv[2];
    
    if (!taskId) {
      console.error('Vui lòng cung cấp ID của tác vụ cần thử lại');
      console.log('Cách sử dụng: node retry-task.js <task_id>');
      process.exit(1);
    }
    
    await retryTask(taskId);
    process.exit(0);
  } catch (error) {
    console.error(`Lỗi khi thực thi: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi hàm chính
main(); 