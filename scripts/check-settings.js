const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Kiểm tra và hiển thị cài đặt hệ thống
 */
async function checkSettings() {
  try {
    console.log('Đang kiểm tra cài đặt hệ thống...\n');
    
    // Lấy cài đặt từ database
    const settingsData = await prisma.setting.findMany();
    console.log(`Tìm thấy ${settingsData.length} cài đặt trong cơ sở dữ liệu.`);
    
    if (settingsData.length === 0) {
      console.error('Không tìm thấy cài đặt nào trong cơ sở dữ liệu!');
      console.log('Vui lòng khởi tạo cài đặt trước khi sử dụng hệ thống.');
      return;
    }
    
    const settings = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    // Kiểm tra và hiển thị cài đặt Shopify
    console.log('\n=== CÀI ĐẶT SHOPIFY ===');
    const shopifyStore = settings.shopify_store;
    const shopifyToken = settings.shopify_access_token;
    const shopifyLocation = settings.shopify_location_id;
    
    console.log(`Shopify Store: ${shopifyStore || 'Không có'} ${shopifyStore ? '✅' : '❌'}`);
    console.log(`Shopify Access Token: ${shopifyToken ? '[Đã cấu hình]' : 'Không có'} ${shopifyToken ? '✅' : '❌'}`);
    console.log(`Shopify Location ID: ${shopifyLocation || 'Không có'} ${shopifyLocation ? '✅' : '❌'}`);
    
    // Kiểm tra và hiển thị cài đặt Nhanh.vn
    console.log('\n=== CÀI ĐẶT NHANH.VN ===');
    const nhanhApiKey = settings.nhanh_api_key;
    const nhanhBusinessId = settings.nhanh_business_id;
    const nhanhAppId = settings.nhanh_app_id;
    
    console.log(`Nhanh API Key: ${nhanhApiKey ? '[Đã cấu hình]' : 'Không có'} ${nhanhApiKey ? '✅' : '❌'}`);
    console.log(`Nhanh Business ID: ${nhanhBusinessId || 'Không có'} ${nhanhBusinessId ? '✅' : '❌'}`);
    console.log(`Nhanh App ID: ${nhanhAppId || 'Không có'} ${nhanhAppId ? '✅' : '❌'}`);
    
    // Kiểm tra và hiển thị cài đặt đồng bộ
    console.log('\n=== CÀI ĐẶT ĐỒNG BỘ ===');
    const syncInterval = settings.sync_interval || '30';
    const autoSync = settings.sync_auto === 'true';
    
    console.log(`Khoảng thời gian đồng bộ: ${syncInterval} phút`);
    console.log(`Tự động đồng bộ: ${autoSync ? 'Bật ✅' : 'Tắt ❌'}`);
    
    // Kiểm tra tính đầy đủ của cài đặt
    console.log('\n=== TỔNG KẾT ===');
    const shopifyConfigOK = shopifyStore && shopifyToken && shopifyLocation;
    const nhanhConfigOK = nhanhApiKey && nhanhBusinessId;
    
    console.log(`Cấu hình Shopify: ${shopifyConfigOK ? 'Đầy đủ ✅' : 'Thiếu ❌'}`);
    console.log(`Cấu hình Nhanh.vn: ${nhanhConfigOK ? 'Đầy đủ ✅' : 'Thiếu ❌'}`);
    console.log(`Trạng thái hệ thống: ${shopifyConfigOK && nhanhConfigOK ? 'Sẵn sàng ✅' : 'Cần cấu hình ❌'}`);
    
    if (!shopifyConfigOK || !nhanhConfigOK) {
      console.log('\n⚠️ Hệ thống chưa được cấu hình đầy đủ. Vui lòng cập nhật cài đặt thiếu.');
    } else {
      console.log('\n✅ Hệ thống đã được cấu hình đầy đủ và sẵn sàng hoạt động.');
    }
    
  } catch (error) {
    console.error('Lỗi khi kiểm tra cài đặt:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi hàm chính
checkSettings().catch(error => {
  console.error('Lỗi không xử lý được:', error);
  process.exit(1);
}); 