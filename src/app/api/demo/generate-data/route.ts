import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Định nghĩa interface cho dữ liệu product mapping
interface ProductMapping {
  id: number;
  shopifyId: string;
  nhanhData: string;
  status: string;
  errorMsg: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Định nghĩa interface cho dữ liệu sync log
interface SyncLog {
  id: number;
  productMappingId: number;
  action: string;
  status: string;
  message: string;
  details: string | null;
  createdAt: Date;
  createdBy: string | null;
}

// Hàm chuyển đổi BigInt thành số thường
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToNumber(item));
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntToNumber(obj[key]);
    }
    return result;
  }
  
  return obj;
}

export async function GET(req: NextRequest) {
  try {
    // Xóa dữ liệu cũ (nếu có) bằng raw SQL
    console.log('1. Xóa dữ liệu cũ từ SyncLog và ProductMapping');
    await prisma.syncLog.deleteMany();
    await prisma.productMapping.deleteMany();

    // Tạo dữ liệu sản phẩm mẫu
    console.log('2. Bắt đầu tạo dữ liệu sản phẩm mẫu');
    const products = [];
    for (let i = 1; i <= 10; i++) {
      // Sử dụng Prisma ORM để tạo sản phẩm
      const productNhanhData = JSON.stringify({
        idNhanh: `nhanh_${2000 + i}`,
        inventory: Math.floor(Math.random() * 100),
        price: Math.floor(Math.random() * 1000000) + 50000
      });
      
      const status = Math.random() > 0.2 ? 'success' : 'error';
      const errorMsg = status === 'error' ? 'Lỗi đồng bộ dữ liệu từ Nhanh.vn' : null;
      
      console.log(`2.${i}. Tạo sản phẩm ${i} với shopifyId: shopify_${1000 + i}`);
      
      const newProduct = await prisma.productMapping.create({
        data: {
          shopifyId: 'shopify_' + (1000 + i),
          nhanhData: productNhanhData,
          status: status,
          errorMsg: errorMsg
        }
      });
      
      products.push(newProduct);
      console.log(`2.${i}. Đã tạo sản phẩm với ID: ${newProduct.id}`);
    }

    console.log(`3. Đã tạo ${products.length} sản phẩm mẫu`);

    // Tạo dữ liệu lịch sử đồng bộ
    console.log('4. Bắt đầu tạo dữ liệu lịch sử đồng bộ');
    let logs = [];
    
    if (products.length === 0) {
      console.error('Không có sản phẩm để tạo lịch sử đồng bộ!');
      return NextResponse.json({
        success: false,
        message: 'Không thể tạo lịch sử đồng bộ vì không có sản phẩm'
      }, { status: 500 });
    }
    
    for (let i = 0; i < 20; i++) {
      const productIndex = i % products.length; // Đảm bảo mỗi sản phẩm đều có ít nhất 1 bản ghi log
      const product = products[productIndex];
      
      const status = Math.random() > 0.2 ? 'success' : 'error';
      const actions = ['sync_inventory', 'sync_price', 'sync_product'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      
      // Tạo ngày trong khoảng 7 ngày gần đây
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 7));
      
      const shopifyInventory = Math.floor(Math.random() * 100);
      const nhanhInventory = Math.floor(Math.random() * 100);
      
      // Parse nhanhData từ product
      const nhanhData = JSON.parse(product.nhanhData);
      
      const details = JSON.stringify({
        shopify: {
          id: product.shopifyId,
          title: `Sản phẩm Shopify mẫu #${product.shopifyId}`,
          inventory: shopifyInventory,
          price: Math.floor(Math.random() * 1000000) + 50000
        },
        nhanh: {
          id: nhanhData.idNhanh,
          title: `Sản phẩm Nhanh mẫu #${nhanhData.idNhanh}`,
          inventory: nhanhInventory,
          price: Math.floor(Math.random() * 1000000) + 50000
        },
        difference: {
          inventory: Math.abs(shopifyInventory - nhanhInventory)
        },
        productName: `Sản phẩm Demo #${productIndex + 1}`
      });
      
      const creators = ['admin', 'system', 'cron'];
      const createdBy = creators[Math.floor(Math.random() * creators.length)];
      const message = status === 'success' ? 'Đồng bộ thành công' : 'Lỗi đồng bộ dữ liệu';

      console.log(`4.${i+1}. Tạo sync log cho sản phẩm ID ${product.id}`);
      
      // Sử dụng Prisma ORM để tạo log
      const newLog = await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: action,
          status: status,
          message: message,
          details: details,
          createdAt: date,
          createdBy: createdBy
        }
      });
      
      logs.push(newLog);
      console.log(`4.${i+1}. Đã tạo sync log với ID: ${newLog.id}`);
    }

    console.log(`5. Đã tạo ${logs.length} logs đồng bộ mẫu`);
    
    // Kiểm tra dữ liệu đã tạo
    const productCount = await prisma.productMapping.count();
    const syncLogCount = await prisma.syncLog.count();
    
    console.log(`6. Kiểm tra kết quả: ${productCount} sản phẩm, ${syncLogCount} logs`);

    return NextResponse.json({
      success: true,
      message: 'Đã tạo dữ liệu mẫu thành công',
      stats: {
        products: productCount,
        logs: syncLogCount
      }
    });
  } catch (error: any) {
    console.error('Error generating demo data:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message}`
    }, { status: 500 });
  }
} 