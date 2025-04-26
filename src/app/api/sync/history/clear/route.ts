import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * Xóa tất cả lịch sử đồng bộ
 */
export async function DELETE(req: NextRequest) {
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
    
    // Kiểm tra role (chỉ admin và editor được phép xóa logs)
    const userRole = verifyResult.payload.role;
    if (userRole !== 'admin' && userRole !== 'editor') {
      return NextResponse.json({ 
        message: 'Bạn không có quyền thực hiện thao tác này' 
      }, { status: 403 });
    }
    
    // Tìm hiểu xem nếu có thời gian giới hạn
    let beforeDate: Date | undefined;
    
    try {
      const requestData = await req.json();
      if (requestData && requestData.beforeDate) {
        beforeDate = new Date(requestData.beforeDate);
      }
    } catch (e) {
      // Không có body trong request - xóa tất cả
    }
    
    // Tạo điều kiện truy vấn
    const where = beforeDate ? {
      createdAt: {
        lt: beforeDate
      }
    } : {};
    
    // Lấy số lượng bản ghi sẽ bị xóa
    const count = await prisma.syncLog.count({
      where
    });
    
    // Xóa logs
    await prisma.syncLog.deleteMany({
      where
    });
    
    return NextResponse.json({
      success: true,
      message: `Đã xóa ${count} bản ghi đồng bộ thành công`,
      count
    });
  } catch (error: any) {
    console.error('Error clearing sync logs:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 