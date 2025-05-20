import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import { syncQueue } from '@/lib/queue';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'API batch sync interface' });
}

export async function POST(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }

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

    // Khởi tạo danh sách kết quả
    const results = {
      success: true,
      jobs: [],
      errors: {}
    };

    // Đẩy công việc vào hàng đợi và trả về kết quả
    for (const shopifyId of productIds) {
      try {
        // Thêm công việc vào hàng đợi
        const job = await syncQueue.add('sync-inventory', {
          shopifyId,
          username: 'system',
          warehouseId: '175080'
        });
        
        // Thêm vào kết quả
        results.jobs.push({
          id: shopifyId,
          status: 'queued',
          jobId: job.id
        });
      } catch (error) {
        console.error(`[BATCH SYNC] Lỗi đẩy task: ${error.message}`);
        results.jobs.push({
          id: shopifyId,
          status: 'error',
          errorMsg: error.message
        });
      }
    }

    // Tạo sync log
    const syncLog = await prisma.syncLog.create({
      data: {
        action: 'batch_sync',
        status: 'queued',
        message: `Đã đẩy ${results.jobs.length} sản phẩm vào hàng đợi để đồng bộ`,
        details: JSON.stringify(results),
        createdBy: 'system'
      }
    });

    // Thêm batchId vào kết quả
    results.batchId = syncLog.id;

    return NextResponse.json(results);
  } catch (error) {
    console.error('[BATCH SYNC] Lỗi server:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi server: ' + error.message
    }, { status: 500 });
  }
} 