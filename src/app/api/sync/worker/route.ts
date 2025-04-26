import { NextRequest, NextResponse } from 'next/server';
import { initSyncProcessors } from '@/lib/syncWorker';
import { syncQueue, getPendingJobs } from '@/lib/queue';
import { verifyJwtToken } from '@/lib/auth';

// Biến lưu trạng thái khởi tạo
let isWorkerInitialized = false;

/**
 * API endpoint để khởi tạo worker đồng bộ
 */
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
    
    // Khởi tạo worker
    if (!isWorkerInitialized) {
      console.log('[API] Khởi tạo worker đồng bộ...');
      initSyncProcessors();
      isWorkerInitialized = true;
      console.log('[API] Đã khởi tạo worker đồng bộ thành công');
    } else {
      console.log('[API] Worker đồng bộ đã được khởi tạo từ trước');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Đã khởi tạo worker đồng bộ',
      isInitialized: isWorkerInitialized
    });
  } catch (error: any) {
    console.error('Error initializing worker:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}

/**
 * API endpoint để kiểm tra trạng thái worker
 */
export async function GET(req: NextRequest) {
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
    
    // Thông tin về Queue
    const pendingJobs = isWorkerInitialized ? await getPendingJobs() : { waiting: [], active: [] };
    const workerInfo = {
      isInitialized: isWorkerInitialized,
      pendingJobs
    };
    
    // Thêm header để không cache kết quả
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    return NextResponse.json({
      success: true,
      worker: workerInfo
    }, { headers });
  } catch (error: any) {
    console.error('Error checking worker status:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 