import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import { getPendingJobs } from '@/lib/queue';

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
    
    // Kiểm tra role admin
    if (verifyResult.payload.role !== 'admin') {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện thao tác này' }, { status: 403 });
    }
    
    // Lấy trạng thái hiện tại
    const jobsInfo = await getPendingJobs();
    
    // Trong thực tế, đây sẽ gọi PM2 API hoặc cơ chế khác để bật/tắt worker
    // Ở phiên bản demo, chúng ta chỉ chuyển đổi trạng thái
    const currentStatus = {
      isRunning: true, // Đây sẽ đọc từ Redis hoặc cơ sở dữ liệu thực tế
      uptime: '2h 30m',
      pendingJobs: jobsInfo.waiting.length + jobsInfo.active.length,
      lastCheck: Date.now()
    };
    
    // Chuyển đổi trạng thái
    const newStatus = {
      ...currentStatus,
      isRunning: !currentStatus.isRunning
    };
    
    // Trong triển khai thực tế, sẽ lưu trạng thái mới và gọi API để bật/tắt worker
    
    // Trả về trạng thái mới
    return NextResponse.json({
      success: true,
      message: newStatus.isRunning ? 'Đã khởi động worker' : 'Đã dừng worker',
      workerStatus: newStatus
    });
  } catch (error: any) {
    console.error('Error toggling worker:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 