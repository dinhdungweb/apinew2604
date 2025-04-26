import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken, JwtPayload } from '@/lib/auth';
import { scheduleSyncJob } from '@/lib/queue';

// Định nghĩa interface cho settings
interface SyncSettings {
  shopify_access_token: string;
  shopify_store: string;
  shopify_location_id: string;
  nhanh_api_key: string;
  nhanh_business_id: string;
  nhanh_app_id: string;
  sync_interval: string;
  sync_auto: string;
  [key: string]: string;
}

const prisma = new PrismaClient();

// API endpoint để thiết lập lịch đồng bộ tự động
export async function POST(req: NextRequest) {
  try {
    console.log("[API Schedule] Đang xử lý POST request đến /api/sync/schedule");
    
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      console.log("[API Schedule] Thiếu token xác thực");
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success || !verifyResult.payload) {
      console.log("[API Schedule] Token không hợp lệ");
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Lấy thông tin username từ payload
    const username = verifyResult.payload.username;
    console.log(`[API Schedule] Người dùng: ${username} đang lên lịch đồng bộ`);
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    const autoSyncEnabled = settings.sync_auto === 'true';
    
    // Kiểm tra xem tính năng đồng bộ tự động có được bật không
    if (!autoSyncEnabled) {
      console.log("[API Schedule] Tính năng đồng bộ tự động chưa được bật trong cài đặt");
      return NextResponse.json({
        success: false,
        message: 'Tính năng đồng bộ tự động chưa được bật trong cài đặt',
      });
    }
    
    // Lấy thông tin đồng bộ từ request
    const body = await req.json();
    const syncType = typeof body.syncType === 'string' ? body.syncType : 'all';
    
    // Lấy delayMinutes từ request, nếu không có thì mới dùng giá trị mặc định từ settings
    const delayMinutes = body.delayMinutes !== undefined ? parseInt(body.delayMinutes.toString(), 10) : 
                         parseInt(settings.sync_interval || '30', 10);
    
    // Kiểm tra syncAll (đồng bộ tất cả sản phẩm hay chỉ các sản phẩm cụ thể)
    const syncAll = body.syncAll === true || body.syncAll === 'true';
    
    // Log để debug
    console.log(`[API Schedule] Lên lịch đồng bộ ${syncType} sau ${delayMinutes} phút, syncAll: ${syncAll}`);
    
    // Sử dụng hàm scheduleSyncJob từ queue thay vì tự tạo bản ghi
    const scheduledJob = await scheduleSyncJob(
      syncType as 'all' | 'inventory' | 'price',
      username,
      delayMinutes
    );
    
    console.log(`[API Schedule] Đã lập lịch thành công: ${JSON.stringify(scheduledJob)}`);
    
    return NextResponse.json({
      success: true,
      message: `Đã lên lịch đồng bộ ${syncType} sau ${delayMinutes} phút`,
      scheduledSync: {
        id: scheduledJob.id,
        jobId: scheduledJob.jobId,
        syncType,
        status: 'scheduled',
        executionTime: scheduledJob.scheduledTime,
        createdBy: username,
        createdAt: new Date()
      }
    });
  } catch (error: any) {
    console.error('Error scheduling sync:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}

// API endpoint để lấy danh sách các đồng bộ đã lên lịch
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
    
    // Lấy thông tin username từ payload
    const username = verifyResult.payload.username;
    
    // Lấy 10 bản ghi mới nhất từ bảng SyncLog với action bắt đầu bằng 'schedule_'
    const scheduledSyncs = await prisma.syncLog.findMany({
      where: {
        action: {
          startsWith: 'schedule_'
        }
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Chuyển đổi dữ liệu SyncLog thành định dạng ScheduledSync
    const formattedSyncs = scheduledSyncs.map(log => {
      try {
        const details = JSON.parse(log.details || '{}');
        return {
          id: log.id,
          syncType: log.action.replace('schedule_', ''),
          status: log.status,
          executionTime: details.scheduledTime || log.createdAt.toISOString(),
          createdBy: log.createdBy,
          createdAt: log.createdAt,
          message: log.message
        };
      } catch (error) {
        return {
          id: log.id,
          syncType: 'all',
          status: log.status,
          executionTime: log.createdAt.toISOString(),
          createdBy: log.createdBy,
          createdAt: log.createdAt,
          message: log.message
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      scheduledSyncs: formattedSyncs
    });
  } catch (error: any) {
    console.error('Error fetching scheduled syncs:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}

// Hàm lấy cài đặt từ database
async function getSettings(): Promise<SyncSettings> {
  try {
    const settingsData = await prisma.setting.findMany();
    
    const settings: Record<string, string> = {};
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    return {
      shopify_access_token: settings.shopify_access_token || '',
      shopify_store: settings.shopify_store || '',
      shopify_location_id: settings.shopify_location_id || '',
      nhanh_api_key: settings.nhanh_api_key || '',
      nhanh_business_id: settings.nhanh_business_id || '',
      nhanh_app_id: settings.nhanh_app_id || '',
      sync_interval: settings.sync_interval || '30',
      sync_auto: settings.sync_auto || 'false'
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      shopify_access_token: '',
      shopify_store: '',
      shopify_location_id: '',
      nhanh_api_key: '',
      nhanh_business_id: '',
      nhanh_app_id: '',
      sync_interval: '30',
      sync_auto: 'false'
    };
  }
} 