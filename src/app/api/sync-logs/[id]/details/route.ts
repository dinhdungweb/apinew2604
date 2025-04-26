import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * API endpoint để lấy chi tiết đồng bộ theo ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Lấy ID đồng bộ
    const syncId = parseInt(params.id);
    if (isNaN(syncId)) {
      return NextResponse.json({ message: 'ID không hợp lệ' }, { status: 400 });
    }
    
    // Lấy thông tin đồng bộ
    const syncLog = await prisma.syncLog.findUnique({
      where: { id: syncId }
    });
    
    if (!syncLog) {
      return NextResponse.json({ message: 'Không tìm thấy đồng bộ' }, { status: 404 });
    }
    
    // Phân tích dữ liệu details
    let details = [];
    let stats = {
      total: 0,
      success: 0,
      error: 0,
      skipped: 0
    };
    let syncInfo = {
      syncType: syncLog.action.replace('sync_', ''),
      status: syncLog.status,
      syncTime: syncLog.createdAt,
      createdBy: syncLog.createdBy
    };
    
    try {
      if (syncLog.details) {
        const detailsData = JSON.parse(syncLog.details);
        
        // Lấy thống kê nếu có
        if (detailsData.stats) {
          stats = detailsData.stats;
        }
        
        // Lấy danh sách chi tiết sản phẩm nếu có
        if (detailsData.products) {
          details = detailsData.products;
        } else if (detailsData.productDetails) {
          details = detailsData.productDetails;
        }
        
        // Nếu có thông tin thời gian bắt đầu, cập nhật syncInfo
        if (detailsData.startTime) {
          syncInfo.syncTime = detailsData.startTime;
        }
        
        // Tạo dữ liệu mẫu nếu không có chi tiết
        if (details.length === 0 && detailsData.shopify && detailsData.nhanh) {
          // Thêm một mục dữ liệu mẫu dựa trên thông tin hiện có
          details = [{
            productId: syncLog.productMappingId || 0,
            shopifyId: detailsData.shopify.id || 'unknown',
            productName: detailsData.shopify.title || detailsData.nhanh.title || 'Sản phẩm không xác định',
            inventoryBefore: detailsData.shopify.inventory,
            inventoryAfter: detailsData.nhanh.inventory,
            priceBefore: detailsData.shopify.price,
            priceAfter: detailsData.nhanh.price,
            syncTime: syncLog.createdAt.toISOString(),
            status: syncLog.status === 'success' ? 'success' : syncLog.status === 'error' ? 'error' : 'pending',
            error: syncLog.status === 'error' ? syncLog.message : undefined
          }];
          
          // Cập nhật thống kê
          stats.total = 1;
          stats.success = syncLog.status === 'success' ? 1 : 0;
          stats.error = syncLog.status === 'error' ? 1 : 0;
          stats.skipped = 0;
        }
      }
    } catch (error) {
      console.error('Lỗi khi phân tích dữ liệu chi tiết:', error);
    }
    
    return NextResponse.json({
      success: true,
      syncInfo,
      details,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching sync details:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 