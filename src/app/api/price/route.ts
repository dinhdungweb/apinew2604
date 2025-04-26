import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import axios from 'axios';
import { getSettings } from '@/lib/queue';
import prisma from '@/lib/prisma';

// API để đồng bộ giá bán
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

    // Lấy dữ liệu từ request
    const body = await req.json();
    console.log('Dữ liệu nhận được:', body);
    
    const { shopifyId, nhanhId, variantId } = body;
    
    // Chuẩn hóa ID sang chuỗi để đảm bảo định dạng nhất quán
    const shopifyIdStr = String(shopifyId);
    const nhanhIdStr = String(nhanhId);
    const variantIdStr = String(variantId);
    
    console.log('ID đã chuẩn hóa:', {
      shopifyIdStr,
      nhanhIdStr,
      variantIdStr
    });

    // Kiểm tra dữ liệu đầu vào
    if (!shopifyIdStr || !nhanhIdStr || !variantId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Thiếu thông tin cần thiết cho đồng bộ giá' 
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

    console.log(`Bắt đầu đồng bộ giá cho sản phẩm: shopifyId=${shopifyIdStr}, nhanhId=${nhanhIdStr}`);

    // Lấy cài đặt API từ database
    const apiSettings = await getApiSettings();
    console.log('Cài đặt API:', apiSettings);

    // Parse dữ liệu từ nhanhData
    let nhanhData;
    try {
      nhanhData = JSON.parse(mapping.nhanhData);
      console.log('Dữ liệu Nhanh.vn:', nhanhData);
    } catch (error) {
      console.error('Lỗi khi parse dữ liệu Nhanh.vn:', error);
      return NextResponse.json({
        success: false,
        message: 'Dữ liệu Nhanh.vn không hợp lệ'
      }, { status: 500 });
    }

    // Lấy giá từ dữ liệu Nhanh.vn
    let priceValue = 0;

    if (nhanhData.price !== undefined) {
      // Trường hợp đơn giản - giá được lưu trực tiếp
      priceValue = Number(nhanhData.price);
      console.log('Lấy giá trực tiếp từ nhanhData:', priceValue);
    } else if (nhanhData.prices) {
      // Trường hợp có nhiều giá
      if (nhanhData.prices.web) {
        priceValue = Number(nhanhData.prices.web);
        console.log('Lấy giá web từ nhanhData:', priceValue);
      } else if (nhanhData.prices.default) {
        priceValue = Number(nhanhData.prices.default);
        console.log('Lấy giá mặc định từ nhanhData:', priceValue);
      }
    }

    // Nếu không tìm thấy giá, gửi thông báo lỗi
    if (priceValue <= 0) {
      console.error('Không tìm thấy thông tin giá hợp lệ');
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy thông tin giá từ Nhanh.vn'
      }, { status: 400 });
    }

    console.log(`Giá lấy được từ Nhanh.vn: ${priceValue}`);

    // Cấu hình Shopify từ settings
    const SHOPIFY_STORE = apiSettings.shopify_store || "b8b55c";
    const SHOPIFY_ACCESS_TOKEN = apiSettings.shopify_access_token || "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";

    // Cập nhật giá trên Shopify bằng cách gọi Shopify API
    console.log(`Cập nhật giá Shopify: variant_id=${variantIdStr}, price=${priceValue}`);

    // Lấy product ID từ variant ID (nếu cần)
    const shopifyProductId = shopifyIdStr.split('/').pop();
    
    // Gọi Shopify API để cập nhật giá
    const shopifyResponse = await fetch(`https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/variants/${variantIdStr}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({
        'variant': {
          'id': variantIdStr,
          'price': String(priceValue)
        }
      })
    });

    if (!shopifyResponse.ok) {
      console.error('Lỗi khi cập nhật giá Shopify:', shopifyResponse.status, shopifyResponse.statusText);
      const errorData = await shopifyResponse.text();
      console.error('Chi tiết lỗi Shopify:', errorData);
      
      // Cập nhật trạng thái mapping
      await prisma.productMapping.update({
        where: { shopifyId: shopifyIdStr },
        data: { 
          status: 'error',
          errorMsg: `Lỗi cập nhật giá Shopify: ${shopifyResponse.status} - ${errorData.substring(0, 100)}`
        }
      });
      
      return NextResponse.json({ 
        success: false, 
        message: 'Lỗi khi cập nhật giá Shopify' 
      }, { status: 500 });
    }

    const shopifyData = await shopifyResponse.json();
    console.log('Kết quả cập nhật giá Shopify:', shopifyData);

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
    
    // Kiểm tra xem đã có tên sản phẩm từ dữ liệu Nhanh.vn chưa
    if (nhanhData.name) {
      productName = nhanhData.name;
    }
    
    const details = {
      shopify: {
        id: shopifyIdStr,
        variant_id: variantIdStr,
        title: `Sản phẩm Shopify #${shopifyIdStr}`,
        price: priceValue
      },
      nhanh: {
        id: nhanhIdStr,
        title: productName + ` #${nhanhIdStr}`,
        price: priceValue
      },
      difference: {
        price: 0 // Không có sự khác biệt vì chúng ta đang cập nhật để đồng bộ
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
            action: 'sync_price',
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
              action: 'sync_price',
              status: 'success',
              message: 'Đồng bộ giá từ Nhanh.vn sang Shopify thành công',
              details: JSON.stringify(details),
              createdBy: 'price_api'
            }
          });
          console.log('Đã tạo bản ghi SyncLog cho đồng bộ giá');
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
      message: `Đã cập nhật giá thành công: ${priceValue}`,
      price: {
        value: priceValue,
        shopifyData: shopifyData
      }
    });
  } catch (error: any) {
    console.error('Lỗi đồng bộ giá:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Lỗi đồng bộ giá: ${error.message || 'Không xác định'}` 
    }, { status: 500 });
  }
}

// Hàm lấy cài đặt API từ database
async function getApiSettings() {
  try {
    // Sử dụng getSettings từ lib/queue thay vì truy vấn trực tiếp
    return await getSettings();
  } catch (error) {
    console.error('Error getting API settings:', error);
    // Sử dụng giá trị từ biến môi trường nếu getSettings() thất bại
    return {
      shopify_access_token: process.env.SHOPIFY_ACCESS_TOKEN || '',
      shopify_store: process.env.SHOPIFY_STORE || '',
      shopify_location_id: process.env.SHOPIFY_LOCATION_ID || '',
      nhanh_api_key: process.env.NHANH_API_KEY || '',
      nhanh_business_id: process.env.NHANH_BUSINESS_ID || '',
      nhanh_app_id: process.env.NHANH_APP_ID || ''
    };
  }
} 