const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
  try {
    console.log('===== KIỂM TRA CÀI ĐẶT ĐỒNG BỘ =====');
    
    // Lấy tất cả cài đặt
    const allSettings = await prisma.setting.findMany();
    
    // Tìm cài đặt sync_auto
    const syncAutoSetting = allSettings.find(s => s.key === 'sync_auto');
    
    if (syncAutoSetting) {
      console.log(`Cài đặt đồng bộ tự động: ${syncAutoSetting.value}`);
      
      // Nếu đồng bộ tự động đang tắt, hỏi người dùng có muốn bật không
      if (syncAutoSetting.value !== 'true') {
        console.log('Đồng bộ tự động đang TẮT. Đang cập nhật thành BẬT...');
        
        // Cập nhật thành true
        await prisma.setting.update({
          where: { key: 'sync_auto' },
          data: { value: 'true' }
        });
        
        console.log('Đã BẬT đồng bộ tự động!');
      }
    } else {
      console.log('Không tìm thấy cài đặt sync_auto. Đang tạo...');
      
      // Tạo mới nếu không tồn tại
      await prisma.setting.create({
        data: {
          key: 'sync_auto',
          value: 'true',
          description: 'Bật/tắt đồng bộ tự động',
          group: 'system'
        }
      });
      
      console.log('Đã tạo và BẬT đồng bộ tự động!');
    }
    
    // Kiểm tra Redis host và port
    console.log('Cài đặt Redis:');
    console.log(`REDIS_HOST: ${process.env.REDIS_HOST || 'localhost (mặc định)'}`);
    console.log(`REDIS_PORT: ${process.env.REDIS_PORT || '6379 (mặc định)'}`);
    
    // Hiển thị tất cả cài đặt liên quan đến đồng bộ
    console.log('\nCác cài đặt đồng bộ khác:');
    const syncSettings = allSettings.filter(s => s.key.startsWith('sync_') || s.group === 'system');
    syncSettings.forEach(s => {
      console.log(`${s.key}: ${s.value}`);
    });
    
    await prisma.$disconnect();
    console.log('===== KẾT THÚC KIỂM TRA =====');
  } catch (error) {
    console.error('Lỗi khi kiểm tra cài đặt:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Chạy hàm
checkSettings(); 