import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { processBatchSync } from '@/lib/batch-processor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Xử lý yêu cầu đồng bộ sản phẩm với batch processing
export async function POST(req: NextRequest) {
  try {
    // Kiểm tra xác thực
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Không được phép truy cập' },
        { status: 401 }
      );
    }
    
    // Lấy thông tin người dùng đã xác thực
    const { username } = authResult;
    // Đảm bảo username không null
    const safeUsername = username || 'system';
    
    // Parse request body
    const requestData = await req.json();
    const { productIds, syncType, batchSize } = requestData;
    
    // Kiểm tra đầu vào
    if (!syncType || !['inventory', 'price', 'all'].includes(syncType)) {
      return NextResponse.json(
        { error: 'Loại đồng bộ không hợp lệ. Chỉ chấp nhận: inventory, price, all' },
        { status: 400 }
      );
    }
    
    // Sử dụng tất cả sản phẩm nếu không có productIds
    const finalProductIds = productIds || [];
    
    if (finalProductIds.length === 0) {
      // Lấy tất cả sản phẩm có trạng thái success, done, pending hoặc null
      const allProducts = await prisma.productMapping.findMany({
        where: {
          OR: [
            { status: 'success' },
            { status: 'done' },
            { status: 'pending' },
            { status: null }
          ]
        },
        select: { id: true }
      });
      
      // Trích xuất IDs
      allProducts.forEach(product => finalProductIds.push(product.id));
    }
    
    // Tạo bản ghi log đồng bộ
    const syncLog = await prisma.syncLog.create({
      data: {
        action: `sync_${syncType}`,
        status: 'scheduled',
        message: `Đã lên lịch đồng bộ ${syncType} cho ${finalProductIds.length} sản phẩm`,
        details: JSON.stringify({
          syncType,
          productIds: finalProductIds,
          scheduledTime: new Date().toISOString()
        }),
        createdBy: safeUsername
      }
    });
    
    // Bắt đầu xử lý đồng bộ trong một process riêng biệt
    processBatchSync(
      finalProductIds,
      syncType as 'inventory' | 'price' | 'all',
      safeUsername,
      batchSize || 20,
      syncLog.id
    ).catch(error => {
      console.error('[API] Lỗi khi xử lý đồng bộ hàng loạt:', error);
    });
    
    // Trả về thành công ngay lập tức, không chờ đợi hoàn thành
    return NextResponse.json({
      success: true,
      message: `Đã bắt đầu đồng bộ ${syncType} cho ${finalProductIds.length} sản phẩm`,
      syncLogId: syncLog.id
    });
  } catch (error: any) {
    console.error('[API] Lỗi khi xử lý yêu cầu đồng bộ:', error);
    
    return NextResponse.json(
      { error: error.message || 'Lỗi máy chủ nội bộ' },
      { status: 500 }
    );
  }
}

// Lấy trạng thái đồng bộ
export async function GET(req: NextRequest) {
  try {
    // Kiểm tra xác thực
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Không được phép truy cập' },
        { status: 401 }
      );
    }
    
    // Lấy ID của log đồng bộ từ query string
    const url = new URL(req.url);
    const syncLogId = url.searchParams.get('id');
    
    if (!syncLogId) {
      // Nếu không có ID, trả về danh sách đồng bộ gần đây
      const recentSyncs = await prisma.syncLog.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });
      
      return NextResponse.json({ logs: recentSyncs });
    }
    
    // Lấy thông tin chi tiết của log đồng bộ cụ thể
    const syncLog = await prisma.syncLog.findUnique({
      where: { id: parseInt(syncLogId) }
    });
    
    if (!syncLog) {
      return NextResponse.json(
        { error: 'Không tìm thấy log đồng bộ' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ sync: syncLog });
  } catch (error: any) {
    console.error('[API] Lỗi khi lấy trạng thái đồng bộ:', error);
    
    return NextResponse.json(
      { error: error.message || 'Lỗi máy chủ nội bộ' },
      { status: 500 }
    );
  }
} 