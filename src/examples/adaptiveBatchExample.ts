import { PrismaClient } from '@prisma/client';
import { processBatchSync } from '../lib/batch-processor';

/**
 * Ví dụ về sử dụng batch processing thích ứng
 * 
 * File này minh họa cách sử dụng tính năng batch processing thích ứng và ưu tiên hóa
 * để tối ưu quá trình đồng bộ dữ liệu giữa Nhanh.vn và Shopify
 */
async function main() {
  try {
    console.log('Khởi động ví dụ batch processing thích ứng');
    
    // Khởi tạo Prisma client để truy vấn database
    const prisma = new PrismaClient();
    
    // Lọc sản phẩm cần đồng bộ từ database (ví dụ: các sản phẩm thành công hoặc đang chờ)
    const products = await prisma.productMapping.findMany({
      where: {
        OR: [
          { status: 'success' },
          { status: 'pending' },
          { status: null }
        ]
      },
      take: 100 // Giới hạn số lượng để ví dụ
    });
    
    if (products.length === 0) {
      console.log('Không tìm thấy sản phẩm nào để đồng bộ');
      return;
    }
    
    const productIds = products.map(p => p.id);
    console.log(`Tìm thấy ${productIds.length} sản phẩm để đồng bộ`);
    
    // Thông tin đồng bộ
    const syncType = 'inventory'; // Có thể là 'inventory', 'price', hoặc 'all'
    const username = 'system'; // Username của người thực hiện
    const initialBatchSize = 10; // Kích thước batch ban đầu
    
    console.log(`Bắt đầu đồng bộ ${syncType} với kích thước batch ban đầu: ${initialBatchSize}`);
    console.log('Batch size sẽ được điều chỉnh tự động dựa trên hiệu suất...');
    
    // Bắt đầu quá trình đồng bộ thích ứng
    const result = await processBatchSync(
      productIds,
      syncType as 'inventory' | 'price' | 'all',
      username,
      initialBatchSize
    );
    
    // Hiển thị kết quả
    console.log('\nKết quả đồng bộ:');
    console.log(`- Tổng số sản phẩm: ${result.total}`);
    console.log(`- Thành công: ${result.success}`);
    console.log(`- Lỗi: ${result.error}`);
    console.log(`- Bỏ qua: ${result.skipped}`);
    console.log(`- Kích thước batch cuối cùng: ${result.adaptiveBatchSize}`);
    console.log(`- Thời gian thực thi trung bình: ${result.averageExecutionTime?.toFixed(2)}ms`);
    
    // Đóng kết nối Prisma
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('Lỗi trong quá trình chạy ví dụ:', error);
    process.exit(1);
  }
}

// Chạy ví dụ
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Lỗi không mong đợi:', error);
    process.exit(1);
  }); 