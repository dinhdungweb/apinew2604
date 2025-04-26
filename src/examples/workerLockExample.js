// Sử dụng CommonJS thay vì ES modules
const { getWorkerPool } = require('../lib/worker-threads.js');

// Định nghĩa kiểu dữ liệu cho metrics đã không còn cần thiết trong JS

/**
 * Ví dụ sử dụng worker với khóa phân tán
 * 
 * File này minh họa cách sử dụng worker-threads với tính năng khóa phân tán
 * để đảm bảo các tác vụ không chạy đồng thời cho cùng một tài nguyên
 */
async function main() {
  try {
    console.log('Khởi động ví dụ worker với khóa phân tán');
    
    // Lấy worker pool
    const workerPool = getWorkerPool();
    
    // Lắng nghe sự kiện metrics để theo dõi hiệu suất worker
    workerPool.on('metrics', (metrics) => {
      console.log('Worker metrics:', metrics);
    });
    
    // Danh sách các sản phẩm cần đồng bộ
    const products = [
      { id: 1, shopifyId: 'variant-12345', name: 'Sản phẩm 1' },
      { id: 2, shopifyId: 'variant-67890', name: 'Sản phẩm 2' },
      { id: 1, shopifyId: 'variant-12345', name: 'Sản phẩm 1 (duplicate)' }, // Trùng ID với sản phẩm 1
      { id: 3, shopifyId: 'variant-13579', name: 'Sản phẩm 3' }
    ];
    
    // Dữ liệu Nhanh.vn giả lập
    const nhanhData = {
      idNhanh: '12345'
    };
    
    // Cài đặt giả lập
    const settings = {
      shopify_store: 'test-store',
      shopify_access_token: 'test-token',
      shopify_location_id: '12345',
      nhanh_app_id: 'test-app',
      nhanh_business_id: 'test-business',
      nhanh_api_key: 'test-key'
    };
    
    // Username giả lập
    const username = 'admin';
    
    // Mảng lưu các promise từ worker
    const promises = [];
    
    // Chạy đồng bộ tồn kho cho tất cả sản phẩm
    for (const product of products) {
      console.log(`Bắt đầu đồng bộ sản phẩm: ${product.name} (ID: ${product.id})`);
      
      // Sử dụng tính năng khóa phân tán
      const promise = workerPool.runTask(
        'syncInventory', 
        [product, nhanhData, settings, username],
        {
          priority: 1,
          timeout: 60000, // 1 phút timeout
          useDistributedLock: true, // Bật tính năng khóa phân tán
          lockTTL: 30, // 30 giây cho thời gian khóa
          lockResourceId: `product:${product.id}` // Resource ID dựa trên ID sản phẩm
        }
      );
      
      promises.push(promise);
    }
    
    // Đợi tất cả các tác vụ hoàn thành
    const results = await Promise.all(promises);
    
    // Hiển thị kết quả
    console.log('\nKết quả đồng bộ:');
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const result = results[i];
      
      if (result && result.skipped) {
        console.log(`- Sản phẩm: ${product.name} - BỎ QUA: ${result.reason}`);
      } else if (result && result.success) {
        console.log(`- Sản phẩm: ${product.name} - THÀNH CÔNG: Tồn kho = ${result.inventoryQuantity}`);
      } else {
        console.log(`- Sản phẩm: ${product.name} - LỖI: ${result?.error || 'Không xác định'}`);
      }
    }
    
    // Dọn dẹp tài nguyên
    setTimeout(() => {
      console.log('Dừng worker pool...');
      workerPool.terminate();
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('Lỗi trong quá trình chạy ví dụ:', error);
    process.exit(1);
  }
}

// Chạy ví dụ
main().catch(console.error); 