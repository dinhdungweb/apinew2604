import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';
import { syncQueue, getPendingJobs } from '@/lib/queue';

const prisma = new PrismaClient();

// Định nghĩa interface cho trạng thái worker
interface WorkerStatusData {
  startTime?: string;
  lastChecked?: string;
  [key: string]: any;
}

// Định nghĩa interface cho thông tin task
interface TaskInfo {
  id: string | number;
  name?: string;
  data?: any;
  progress?: number;
  attemptsMade?: number;
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
}

// Định nghĩa interface cho SyncLog
interface SyncLogInfo {
  id: number;
  action: string;
  status: string;
  message: string | null;
  createdAt: Date;
}

/**
 * API endpoint để lấy trạng thái worker
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
    
    // Kiểm tra role admin
    if (verifyResult.payload.role !== 'admin') {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện thao tác này' }, { status: 403 });
    }
    
    // Lấy thông tin về các công việc đang chờ
    const jobsInfo = await getPendingJobs();
    
    // Đọc thông tin trạng thái worker từ Redis hoặc file
    // Giả lập thông tin worker trong phiên bản demo
    const workerStatus = {
      isRunning: true, // Thường sẽ lấy từ Redis hoặc thông qua pm2 api
      uptime: '2h 30m',
      pendingJobs: jobsInfo.waiting.length + jobsInfo.active.length,
      lastCheck: Date.now(),
      activeTasks: jobsInfo.active.map(job => ({
        id: job.id,
        name: job.name,
        progress: job.progress || 0,
        processedOn: job.processedOn
      }))
    };
    
    // Mô phỏng nhật ký hoạt động
    const workerLogs = [
      {
        message: 'Worker đã khởi động thành công',
        timestamp: Date.now() - 9000000,
        type: 'info'
      },
      {
        message: 'Đã hoàn thành đồng bộ 50 sản phẩm',
        timestamp: Date.now() - 7200000,
        type: 'info'
      },
      {
        message: 'Cảnh báo: Tỷ lệ lỗi đồng bộ cao (15%)',
        timestamp: Date.now() - 3600000,
        type: 'warning'
      },
      {
        message: 'Đã xử lý 3 công việc đồng bộ',
        timestamp: Date.now() - 1800000,
        type: 'info'
      },
      {
        message: 'Kiểm tra kết nối Redis thành công',
        timestamp: Date.now() - 600000,
        type: 'info'
      }
    ];
    
    return NextResponse.json({
      success: true,
      workerStatus,
      workerLogs
    });
  } catch (error: any) {
    console.error('Error getting worker status:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 