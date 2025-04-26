import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import { updateInventoryLevel } from '@/lib/shopify';
import { getSettings } from '@/lib/queue';
import prisma from '@/lib/prisma';

// Giả lập dữ liệu đồng bộ
const syncStatus: Record<string, { status: 'success' | 'error', message: string, timestamp: string }> = {};

// API để đồng bộ tồn kho
export async function POST(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success || !verifyResult.payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    const payload = verifyResult.payload;

    // Lấy cài đặt từ database
    const settings = await getSettings();
    const NHANH_APP_ID = settings.nhanh_app_id;
    const NHANH_BUSINESS_ID = settings.nhanh_business_id;
    const NHANH_API_KEY = settings.nhanh_api_key;
    const SHOPIFY_STORE = settings.shopify_store;
    const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
    const SHOPIFY_LOCATION_ID = settings.shopify_location_id;

    // Lấy dữ liệu từ request
    const body = await req.json();
    console.log('Dữ liệu nhận được:', body);
    
    const { shopifyId, nhanhId, inventoryItemId } = body;
    
    // Chuẩn hóa ID sang chuỗi để đảm bảo định dạng nhất quán
    const shopifyIdStr = String(shopifyId);
    const nhanhIdStr = String(nhanhId);
    const inventoryItemIdNum = Number(inventoryItemId);
    
    console.log('ID đã chuẩn hóa:', {
      shopifyIdStr,
      nhanhIdStr,
      inventoryItemIdNum
    });

    // Kiểm tra dữ liệu đầu vào
    if (!shopifyIdStr || !nhanhIdStr || !inventoryItemId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Thiếu thông tin cần thiết cho đồng bộ tồn kho' 
      }, { status: 400 });
    }

    // Kiểm tra xem shopifyId có trong cơ sở dữ liệu không
    const mapping = await prisma.productMapping.findUnique({
      where: { shopifyId: shopifyIdStr }
    });

    if (!mapping) {
      console.error(`Không tìm thấy mapping cho sản phẩm ${shopifyIdStr}`);
      return NextResponse.json({ 
        success: false, 
        message: `Không tìm thấy mapping cho sản phẩm ${shopifyIdStr}` 
      }, { status: 404 });
    }

    console.log(`Bắt đầu đồng bộ tồn kho cho sản phẩm: shopifyId=${shopifyIdStr}, nhanhId=${nhanhIdStr}`);

    // Lấy tồn kho từ Nhanh.vn
    const nhanhResponse = await fetch('https://open.nhanh.vn/api/product/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'version': '2.0',
        'appId': NHANH_APP_ID || '',
        'businessId': NHANH_BUSINESS_ID || '',
        'accessToken': NHANH_API_KEY || '',
        'data': JSON.stringify({ 'id': nhanhIdStr })
      })
    });

    if (!nhanhResponse.ok) {
      console.error('Lỗi khi gọi API Nhanh.vn:', nhanhResponse.status, nhanhResponse.statusText);
      return NextResponse.json({ 
        success: false, 
        message: 'Lỗi kết nối đến Nhanh.vn' 
      }, { status: 500 });
    }

    const nhanhData = await nhanhResponse.json();
    console.log('Dữ liệu nhận được từ Nhanh.vn:', JSON.stringify(nhanhData));

    if (nhanhData.code !== 1) {
      console.error('Lỗi từ API Nhanh.vn:', nhanhData);
      return NextResponse.json({ 
        success: false, 
        message: 'Lỗi từ API Nhanh.vn: ' + (nhanhData.messages || 'Không xác định') 
      }, { status: 500 });
    }

    // Xử lý dữ liệu để lấy số lượng tồn kho
    let totalRemain = 0;

    if (nhanhData.data && nhanhData.data.products) {
      const products = nhanhData.data.products;
      let product = null;
      
      // Tìm sản phẩm theo ID
      if (products[nhanhIdStr]) {
        product = products[nhanhIdStr];
      } else {
        // Nếu không tìm thấy theo ID chính xác, kiểm tra tất cả sản phẩm
        for (const prodId in products) {
          if (products[prodId] && String(products[prodId].idNhanh) === nhanhIdStr) {
            product = products[prodId];
            break;
          }
        }
      }

      if (!product && Object.keys(products).length > 0) {
        product = products[Object.keys(products)[0]]; // Lấy sản phẩm đầu tiên nếu không tìm thấy
      }

      if (product) {
        const inventory = product.inventory || {};
        totalRemain = inventory.remain || 0;
        
        console.log('Tồn kho lấy được:', totalRemain);
        
        // Kiểm tra xem có dữ liệu kho cụ thể không
        if (inventory.depots && inventory.depots['175080']) {
          const depot = inventory.depots['175080'];
          if (depot.available !== undefined) {
            totalRemain = depot.available;
            console.log('Tồn kho từ kho 175080:', totalRemain);
          }
        }
      } else {
        console.warn('Không tìm thấy sản phẩm trong dữ liệu trả về từ Nhanh.vn');
      }
    } else if (nhanhData.data && nhanhData.data.inventory) {
      // Trường hợp API trả về dữ liệu inventory trực tiếp
      const inventory = nhanhData.data.inventory;
      totalRemain = inventory.remain || 0;
      console.log('Tồn kho từ dữ liệu inventory trực tiếp:', totalRemain);
    }

    // Cập nhật tồn kho trên Shopify
    console.log(`Cập nhật tồn kho Shopify: inventory_item_id=${inventoryItemIdNum}, quantity=${totalRemain}`);

    const shopifyResponse = await fetch(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({
        'location_id': SHOPIFY_LOCATION_ID,
        'inventory_item_id': inventoryItemIdNum,
        'available': totalRemain
      })
    });

    if (!shopifyResponse.ok) {
      console.error('Lỗi khi cập nhật tồn kho Shopify:', shopifyResponse.status, shopifyResponse.statusText);
      const errorData = await shopifyResponse.text();
      console.error('Chi tiết lỗi Shopify:', errorData);
      
      // Cập nhật trạng thái mapping
      await prisma.productMapping.update({
        where: { shopifyId: shopifyIdStr },
        data: { 
          status: 'error',
          errorMsg: `Lỗi cập nhật tồn kho Shopify: ${shopifyResponse.status} - ${errorData.substring(0, 100)}`
        }
      });
      
      return NextResponse.json({ 
        success: false, 
        message: 'Lỗi khi cập nhật tồn kho Shopify' 
      }, { status: 500 });
    }

    const shopifyData = await shopifyResponse.json();
    console.log('Kết quả cập nhật tồn kho Shopify:', shopifyData);

    // Cập nhật trạng thái mapping thành công
    await prisma.productMapping.update({
      where: { shopifyId: shopifyIdStr },
      data: { 
        status: 'success',
        errorMsg: null
      }
    });

    // Tạo bản ghi SyncLog để ghi lại lịch sử đồng bộ
    let productName = "Sản phẩm Nhanh";
    
    // Kiểm tra xem đã lấy được tên sản phẩm từ dữ liệu Nhanh.vn chưa
    if (nhanhData.data && nhanhData.data.products) {
      const products = nhanhData.data.products;
      for (const prodId in products) {
        if (products[prodId] && (String(products[prodId].idNhanh) === nhanhIdStr)) {
          productName = products[prodId].name || productName;
          break;
        }
      }
    }
    
    const details = {
      shopify: {
        id: shopifyIdStr,
        title: `Sản phẩm Shopify #${shopifyIdStr}`,
        inventory_item_id: inventoryItemIdNum,
        inventory: totalRemain
      },
      nhanh: {
        id: nhanhIdStr,
        title: productName + ` #${nhanhIdStr}`,
        inventory: totalRemain
      },
      difference: {
        inventory: 0 // Không có sự khác biệt vì chúng ta đang cập nhật để đồng bộ
      },
      productName: productName
    };

    try {
      // Lấy ID của mapping
      const mapping = await prisma.productMapping.findUnique({
        where: { shopifyId: shopifyIdStr }
      });

      if (mapping) {
        // Kiểm tra xem có log đồng bộ gần đây cho sản phẩm này hay không (trong vòng 1 phút)
        const recentSyncLogs = await prisma.syncLog.findMany({
          where: {
            productMappingId: mapping.id,
            action: 'sync_inventory',
            createdAt: {
              gt: new Date(Date.now() - 60000)
            }
          },
          take: 1
        });
        
        // Nếu không có log gần đây hoặc mảng kết quả rỗng, tạo log mới
        if (!recentSyncLogs || recentSyncLogs.length === 0) {
          await prisma.syncLog.create({
            data: {
              productMappingId: mapping.id,
              action: 'sync_inventory',
              status: 'success',
              message: 'Đồng bộ tồn kho từ Nhanh.vn sang Shopify thành công',
              details: JSON.stringify(details),
              createdBy: 'inventory_api'
            }
          });
          console.log('Đã tạo bản ghi SyncLog cho đồng bộ tồn kho');
        } else {
          console.log('Bỏ qua tạo SyncLog vì đã có bản ghi đồng bộ gần đây');
        }
      }
    } catch (logError) {
      console.error('Lỗi khi tạo bản ghi SyncLog:', logError);
      // Không ảnh hưởng đến luồng chính, vẫn trả về thành công
    }

    return NextResponse.json({ 
      success: true, 
      message: `Đã cập nhật tồn kho thành công: ${totalRemain} sản phẩm`,
      inventory: {
        quantity: totalRemain,
        shopifyData: shopifyData
      }
    });
  } catch (error: any) {
    console.error('Lỗi đồng bộ tồn kho:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Lỗi đồng bộ tồn kho: ${error.message || 'Không xác định'}` 
    }, { status: 500 });
  }
}

// API để lấy lịch sử đồng bộ
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    
    const url = new URL(req.url);
    const shopifyId = url.searchParams.get('shopifyId');
    
    if (shopifyId) {
      // Trả về trạng thái của một sản phẩm cụ thể
      return NextResponse.json(syncStatus[shopifyId] || { status: null, message: 'Chưa đồng bộ', timestamp: null });
    }
    
    // Trả về toàn bộ lịch sử
    return NextResponse.json(syncStatus);
  } catch (error) {
    console.error('Get sync history API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
} 