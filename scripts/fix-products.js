const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Hàm sửa chữa các sản phẩm trong database
 */
async function fixProducts() {
  try {
    console.log('Đang tìm kiếm các sản phẩm cần sửa chữa...');
    
    // Lấy tất cả sản phẩm
    const products = await prisma.productMapping.findMany();
    console.log(`Tìm thấy ${products.length} sản phẩm trong database.`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const product of products) {
      // Chuẩn hóa shopifyId - loại bỏ prefix "gid://" nếu có
      let normalizedShopifyId = product.shopifyId;
      let needsUpdate = false;
      
      if (normalizedShopifyId && normalizedShopifyId.includes('gid://')) {
        normalizedShopifyId = normalizedShopifyId.split('/').pop();
        needsUpdate = true;
      }
      
      // Cập nhật nếu cần thiết
      if (needsUpdate) {
        try {
          await prisma.productMapping.update({
            where: { id: product.id },
            data: {
              shopifyId: normalizedShopifyId,
              status: 'pending',  // Đặt lại trạng thái để thử lại
              errorMsg: null      // Xóa thông báo lỗi cũ
            }
          });
          
          console.log(`✅ Đã cập nhật sản phẩm ID: ${product.id}, shopifyId mới: ${normalizedShopifyId}`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Lỗi khi cập nhật sản phẩm ID: ${product.id}: ${error.message}`);
        }
      } else {
        skippedCount++;
      }
    }
    
    // Đặt lại trạng thái các sản phẩm bị lỗi
    const errorProducts = await prisma.productMapping.findMany({
      where: {
        status: 'error',
        errorMsg: {
          contains: 'không có biến thể'
        }
      }
    });
    
    console.log(`\nTìm thấy ${errorProducts.length} sản phẩm có lỗi "không có biến thể"`);
    
    let fixedCount = 0;
    for (const product of errorProducts) {
      try {
        await prisma.productMapping.update({
          where: { id: product.id },
          data: {
            status: 'pending',  // Đặt lại trạng thái để thử lại
            errorMsg: null      // Xóa thông báo lỗi cũ
          }
        });
        
        console.log(`✅ Đã đặt lại trạng thái sản phẩm ID: ${product.id}, shopifyId: ${product.shopifyId}`);
        fixedCount++;
      } catch (error) {
        console.error(`❌ Lỗi khi đặt lại trạng thái sản phẩm ID: ${product.id}: ${error.message}`);
      }
    }
    
    // Tạo task đồng bộ mới để xử lý các sản phẩm đã sửa
    if (updatedCount > 0 || fixedCount > 0) {
      const syncLog = await prisma.syncLog.create({
        data: {
          action: 'sync_inventory',
          status: 'pending',
          message: `Đồng bộ tồn kho cho ${updatedCount + fixedCount} sản phẩm đã sửa`,
          details: JSON.stringify({
            updatedProducts: updatedCount,
            fixedProducts: fixedCount,
            fixedAt: new Date().toISOString()
          }),
          createdBy: 'fix-script'
        }
      });
      
      console.log(`\n✅ Đã tạo task đồng bộ mới, ID: ${syncLog.id}`);
    }
    
    console.log(`\n=== TỔNG KẾT ===`);
    console.log(`Tổng số sản phẩm: ${products.length}`);
    console.log(`Đã cập nhật shopifyId: ${updatedCount}`);
    console.log(`Bỏ qua (không cần cập nhật): ${skippedCount}`);
    console.log(`Đã đặt lại trạng thái lỗi: ${fixedCount}`);
    
  } catch (error) {
    console.error('Lỗi khi sửa chữa sản phẩm:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi hàm chính
fixProducts().catch(error => {
  console.error('Lỗi không xử lý được:', error);
  process.exit(1);
}); 