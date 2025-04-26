import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

// API để lấy danh sách sản phẩm đã mapping
export async function GET(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const payload = await verifyJwtToken(token);
    if (!payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Lấy tất cả mappings từ database
    const mappings = await prisma.productMapping.findMany();
    
    // Chuyển đổi kết quả thành các đối tượng
    const formattedMappings: Record<string, any> = {};
    const syncStatusMap: Record<string, any> = {};
    const errorMap: Record<string, string> = {};
    
    for (const mapping of mappings) {
      // Chuyển đổi ID sang string để đảm bảo định dạng nhất quán
      const shopifyIdStr = String(mapping.shopifyId);
      
      // Lưu dữ liệu sản phẩm
      formattedMappings[shopifyIdStr] = JSON.parse(mapping.nhanhData);
      
      // Lưu trạng thái
      syncStatusMap[shopifyIdStr] = mapping.status;
      
      // Lưu thông báo lỗi nếu có
      if (mapping.errorMsg) {
        errorMap[shopifyIdStr] = mapping.errorMsg;
      }
    }
    
    console.log('Mapping API trả về:', {
      mappings: formattedMappings,
      syncStatus: syncStatusMap,
      syncErrors: errorMap
    });
    
    return NextResponse.json({
      mappings: formattedMappings,
      syncStatus: syncStatusMap,
      syncErrors: errorMap
    });
  } catch (error) {
    console.error('Get mappings API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// API để tạo hoặc cập nhật mapping
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const payload = await verifyJwtToken(token);
    if (!payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    const body = await req.json();
    console.log('[DEBUG MAPPING] Dữ liệu mapping nhận được:', body);
    
    let { shopifyId, nhanhProduct } = body;
    const status = body.status || 'done';
    const errorMsg = body.errorMsg || null;
    
    // Chuyển đổi ID sang string để đảm bảo định dạng nhất quán
    shopifyId = String(shopifyId);
    
    if (!shopifyId || !nhanhProduct) {
      console.log('[DEBUG MAPPING] Lỗi - Thiếu thông tin mapping');
      return NextResponse.json(
        { message: 'Thiếu thông tin mapping' }, 
        { status: 400 }
      );
    }
    
    console.log('[DEBUG MAPPING] Đang tạo mapping với dữ liệu:', {
      shopifyId,
      nhanhData: JSON.stringify(nhanhProduct),
      status,
      errorMsg
    });
    
    // Kiểm tra xem mapping đã tồn tại chưa
    const existingMapping = await prisma.productMapping.findUnique({
      where: { shopifyId }
    });
    
    console.log('[DEBUG MAPPING] Mapping đã tồn tại?', !!existingMapping);
    
    // Lưu hoặc cập nhật mapping vào database
    const result = await prisma.productMapping.upsert({
      where: { shopifyId },
      update: {
        nhanhData: JSON.stringify(nhanhProduct),
        status,
        errorMsg
      },
      create: {
        shopifyId,
        nhanhData: JSON.stringify(nhanhProduct),
        status,
        errorMsg
      },
    });
    
    console.log('[DEBUG MAPPING] Kết quả lưu mapping:', result);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Mapping thành công',
      data: result
    });
  } catch (error) {
    console.error('[DEBUG MAPPING] Create mapping API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// API để cập nhật trạng thái
export async function PATCH(req: NextRequest) {
  try {
    // Kiểm tra xác thực (tùy chọn)
    const token = req.headers.get('Authorization')?.split(' ')[1];
    
    const { shopifyId, status, errorMsg } = await req.json();
    console.log('Cập nhật trạng thái mapping với dữ liệu:', { shopifyId, status, errorMsg });

    // Kiểm tra xem các trường bắt buộc có tồn tại không
    if (!shopifyId) {
      return NextResponse.json({
        error: 'Thiếu thông tin shopifyId'
      }, { status: 400 });
    }

    // Kiểm tra xem sản phẩm có tồn tại và lấy dữ liệu hiện tại
    const existingMapping = await prisma.productMapping.findUnique({
      where: { shopifyId }
    });

    if (!existingMapping) {
      return NextResponse.json({
        error: 'Sản phẩm không tồn tại'
      }, { status: 404 });
    }

    // Kiểm tra nếu trạng thái giống nhau và thời gian cập nhật gần đây (trong vòng 1 phút)
    // thì không tạo log mới để tránh quá nhiều bản ghi trùng lặp
    let skipLogCreation = false;
    if (existingMapping.status === status) {
      const lastUpdateTime = new Date(existingMapping.updatedAt).getTime();
      const currentTime = new Date().getTime();
      const oneMinuteInMs = 60 * 1000;
      
      if ((currentTime - lastUpdateTime) < oneMinuteInMs) {
        console.log('Bỏ qua tạo SyncLog vì sản phẩm vừa được cập nhật gần đây với cùng trạng thái');
        skipLogCreation = true;
      }
    }

    // Cập nhật mapping
    const mapping = await prisma.productMapping.update({
      where: { shopifyId },
      data: { 
        status, 
        errorMsg,
        updatedAt: new Date()
      }
    });

    console.log('Kết quả cập nhật mapping:', mapping);

    // Tạo bản ghi SyncLog nếu không bỏ qua
    if (!skipLogCreation) {
      const nhanhData = JSON.parse(mapping.nhanhData);
      const nhanhProductName = nhanhData?.name || 'Sản phẩm Nhanh';
      
      const syncDetails = {
        shopify: {
          id: shopifyId,
          title: 'Đồng bộ mapping Shopify/Nhanh'
        },
        nhanh: {
          id: nhanhData?.idNhanh || 'unknown',
          title: nhanhProductName
        },
        productName: nhanhProductName
      };

      await prisma.syncLog.create({
        data: {
          productMappingId: mapping.id,
          action: 'sync_inventory',
          status: status, 
          message: status === 'success' ? 'Đồng bộ tồn kho thành công' : errorMsg || 'Lỗi đồng bộ tồn kho',
          details: JSON.stringify(syncDetails),
          createdBy: 'system'
        }
      });
      console.log('Đã tạo SyncLog mới cho sản phẩm:', shopifyId);
    }

    return NextResponse.json(mapping);
  } catch (error: any) {
    console.error('Lỗi cập nhật mapping:', error);
    return NextResponse.json({
      error: 'Lỗi cập nhật mapping',
      message: error.message
    }, { status: 500 });
  }
}

// API để xóa mapping
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const payload = await verifyJwtToken(token);
    if (!payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const shopifyIdParam = url.searchParams.get('shopifyId');
    
    // Chuyển đổi ID sang string nếu có
    const shopifyId = shopifyIdParam ? String(shopifyIdParam) : null;
    
    console.log('Xóa mapping với shopifyId:', shopifyId);
    
    if (!shopifyId) {
      return NextResponse.json(
        { message: 'Thiếu ID Shopify' }, 
        { status: 400 }
      );
    }
    
    // Kiểm tra xem mapping có tồn tại không
    const existingMapping = await prisma.productMapping.findUnique({
      where: { shopifyId },
    });
    
    if (!existingMapping) {
      return NextResponse.json(
        { message: 'Không tìm thấy mapping' }, 
        { status: 404 }
      );
    }
    
    // Xóa mapping từ database
    const result = await prisma.productMapping.delete({
      where: { shopifyId },
    });
    
    console.log('Kết quả xóa mapping:', result);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Xóa mapping thành công' 
    });
  } catch (error) {
    console.error('Delete mapping API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
} 