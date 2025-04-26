import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';
import { syncQueue } from '@/lib/queue';

const prisma = new PrismaClient();

/**
 * API endpoint để xóa một lịch đồng bộ đã lên lịch
 */
export async function DELETE(
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
    
    // Kiểm tra ID lịch đồng bộ - Sửa lỗi "params.id should be awaited"
    // Trong Next.js App Router, toàn bộ params có thể là một Promise
    // Nên cần await toàn bộ params trước khi truy cập thuộc tính
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    const syncId = parseInt(id);
    
    if (isNaN(syncId)) {
      return NextResponse.json({ message: 'ID không hợp lệ' }, { status: 400 });
    }
    
    // Tìm bản ghi lịch đồng bộ
    const syncLog = await prisma.syncLog.findUnique({
      where: { id: syncId }
    });
    
    if (!syncLog) {
      return NextResponse.json({ message: 'Không tìm thấy lịch đồng bộ' }, { status: 404 });
    }
    
    // Kiểm tra xem lịch đồng bộ có đang chạy hoặc đã hoàn thành không
    if (syncLog.status === 'running' || syncLog.status === 'completed') {
      return NextResponse.json({ 
        message: `Không thể xóa lịch đồng bộ đang ${syncLog.status === 'running' ? 'chạy' : 'đã hoàn thành'}`
      }, { status: 400 });
    }
    
    // Lấy jobId từ details nếu có
    let jobId: string | undefined;
    try {
      const details = JSON.parse(syncLog.details || '{}');
      jobId = details.jobId;
    } catch (error) {
      console.error('Lỗi phân tích dữ liệu jobId:', error);
    }
    
    // Xóa job từ queue nếu có jobId
    if (jobId) {
      try {
        await syncQueue.removeJobs(jobId);
        console.log(`Đã xóa job ${jobId} từ queue`);
      } catch (error) {
        console.error(`Lỗi khi xóa job ${jobId} từ queue:`, error);
      }
    }
    
    // Xóa bản ghi từ database
    await prisma.syncLog.delete({
      where: { id: syncId }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Đã xóa lịch đồng bộ thành công'
    });
  } catch (error: any) {
    console.error('Error deleting scheduled sync:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 