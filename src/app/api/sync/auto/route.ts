import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';
import { syncQueue, getPendingJobs } from '@/lib/queue';

const prisma = new PrismaClient();

// API để khởi chạy đồng bộ tự động sử dụng hệ thống queue
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
    
    const payload = verifyResult.payload;
    const username = payload.username || 'system';

    // Kiểm tra nếu đã có quá trình đồng bộ đang chạy
    const pendingJobs = await getPendingJobs();
    const activeJobs = pendingJobs.active;
    
    if (activeJobs.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Quá trình đồng bộ đang chạy, vui lòng đợi hoàn thành',
        activeJobs
      });
    }

    // Lấy cài đặt từ database
    const settingsData = await prisma.setting.findMany();
    const settings: Record<string, string> = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    const autoSyncEnabled = settings.sync_auto === 'true';

    // Kiểm tra xem tính năng đồng bộ tự động có được bật không
    if (!autoSyncEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Tính năng đồng bộ tự động chưa được bật trong cài đặt',
      });
    }

    // Lấy loại đồng bộ và tham số đồng bộ tất cả từ request
    let syncTypeValue = 'all'; // Giá trị mặc định
    let syncAllProducts = false; // Mặc định là chỉ đồng bộ sản phẩm theo trạng thái
    
    try {
      const body = await req.json();
      if (body && typeof body.syncType === 'string' && 
          ['all', 'inventory', 'price'].includes(body.syncType)) {
        syncTypeValue = body.syncType;
      }
      // Kiểm tra tham số đồng bộ tất cả sản phẩm
      if (body && body.syncAll === true) {
        syncAllProducts = true;
      }
    } catch (error) {
      console.error('Error parsing request body:', error);
    }
    
    // Thêm công việc vào queue để xử lý ngay lập tức
    const job = await syncQueue.add('sync-products', {
      syncType: syncTypeValue,
      username,
      syncAllProducts
    });
    
    console.log(`[API] Đã thêm công việc đồng bộ ${syncTypeValue} vào queue, job ID: ${job.id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Đã bắt đầu quá trình đồng bộ tự động',
      syncAll: syncAllProducts,
      jobId: job.id
    });
  } catch (error: any) {
    console.error('Error auto sync API:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}

// API để lấy trạng thái của quá trình đồng bộ
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
    
    // Lấy thông tin job từ queue
    const pendingJobs = await getPendingJobs();
    const activeJobs = pendingJobs.active;
    
    // Lấy log đồng bộ gần đây nhất
    const recentSyncLogs = await prisma.syncLog.findMany({
      where: {
        action: {
          startsWith: 'sync_'
        }
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Tạo thông tin trạng thái
    const inProgress = activeJobs.length > 0;
    let lastSyncTime = null;
    let syncStats = {
      total: 0,
      success: 0,
      error: 0,
      skipped: 0,
      startTime: null,
      endTime: null,
      currentProduct: '',
      progress: 0
    };
    
    // Nếu có job đang chạy, lấy thông tin từ job đó
    if (inProgress && activeJobs.length > 0) {
      const activeJob = activeJobs[0];
      
      // Lấy thông tin từ job đang chạy
      syncStats.progress = activeJob.progress || 0;
      
      // Lấy thông tin chi tiết từ log
      const syncLog = await prisma.syncLog.findFirst({
        where: {
          status: 'running'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (syncLog) {
        try {
          const details = JSON.parse(syncLog.details || '{}');
          syncStats.total = details.total || 0;
          syncStats.startTime = details.startTime || null;
          
          if (details.stats) {
            syncStats.success = details.stats.success || 0;
            syncStats.error = details.stats.error || 0;
            syncStats.skipped = details.stats.skipped || 0;
          }
        } catch (error) {
          console.error('Error parsing sync log details:', error);
        }
      }
    } 
    // Nếu không có job đang chạy, lấy thông tin từ log gần nhất
    else if (recentSyncLogs.length > 0) {
      const latestLog = recentSyncLogs[0];
      lastSyncTime = latestLog.createdAt;
      
      try {
        const details = JSON.parse(latestLog.details || '{}');
        syncStats.total = details.total || 0;
        syncStats.startTime = details.startTime || null;
        syncStats.endTime = details.endTime || null;
        
        if (details.stats) {
          syncStats.success = details.stats.success || 0;
          syncStats.error = details.stats.error || 0;
          syncStats.skipped = details.stats.skipped || 0;
        }
      } catch (error) {
        console.error('Error parsing sync log details:', error);
      }
    }
    
    // Thêm header để không cache kết quả
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    return NextResponse.json({
      success: true,
      inProgress,
      lastSyncTime,
      stats: syncStats,
      activeJobs,
      recentLogs: recentSyncLogs.map(log => ({
        id: log.id,
        action: log.action,
        status: log.status,
        message: log.message,
        createdAt: log.createdAt
      }))
    }, { headers });
  } catch (error: any) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}