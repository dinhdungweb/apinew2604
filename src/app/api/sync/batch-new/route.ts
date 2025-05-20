import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncQueue } from '@/lib/queue';

// API để đồng bộ hàng loạt sản phẩm
export async function POST(req: NextRequest) {
  try {
    // Lấy dữ liệu từ body
    const data = await req.json();
    const { productIds } = data;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Danh sách sản phẩm không hợp lệ',
      }, { status: 400 });
    }

    console.log(`[BATCH SYNC] Đồng bộ hàng loạt ${productIds.length} sản phẩm`);

    // Tạo syncLog để theo dõi
    const syncLog = await prisma.syncLog.create({
      data: {
        action: 'batch_sync',
        status: 'queued',
        message: `Đã nhận yêu cầu đồng bộ ${productIds.length} sản phẩm`,
        details: JSON.stringify({ productIds }),
        createdBy: 'system'
      }
    });

    // Đẩy công việc xử lý vào hàng đợi riêng
    const job = await syncQueue.add('process-batch', {
      batchId: syncLog.id,
      productIds
    });

    return NextResponse.json({
      success: true,
      totalProducts: productIds.length,
      message: `Đã nhận yêu cầu đồng bộ ${productIds.length} sản phẩm`,
      batchId: syncLog.id,
      jobId: job.id
    });
  } catch (error: any) {
    console.error('[BATCH SYNC] Lỗi server:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi server: ' + (error.message || 'Lỗi không xác định')
    }, { status: 500 });
  }
}

// API để kiểm tra trạng thái đồng bộ
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const batchId = url.searchParams.get('batchId');
    
    if (!batchId) {
      return NextResponse.json({ 
        success: false,
        message: 'Thiếu batchId'
      }, { status: 400 });
    }
    
    // Lấy log đồng bộ từ database
    const batchLog = await prisma.syncLog.findUnique({
      where: {
        id: parseInt(batchId, 10)
      }
    });
    
    if (!batchLog) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy batch job'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      batchLog: {
        id: batchLog.id,
        action: batchLog.action,
        status: batchLog.status,
        message: batchLog.message,
        createdAt: batchLog.createdAt,
        createdBy: batchLog.createdBy
      }
    });
  } catch (error: any) {
    console.error('Batch status API error:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi khi lấy trạng thái batch: ${error.message}`
    }, { status: 500 });
  }
} 