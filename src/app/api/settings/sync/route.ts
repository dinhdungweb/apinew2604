import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJwtToken } from '@/lib/auth';

const prisma = new PrismaClient();

// Interface cho settings
interface SyncSettings {
  sync_auto: string;
  sync_interval: string;
  [key: string]: string;
}

/**
 * API endpoint để lấy cài đặt đồng bộ
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
    
    // Lấy cài đặt đồng bộ từ database
    const settingsData = await prisma.setting.findMany({
      where: {
        key: {
          in: ['sync_auto', 'sync_interval']
        }
      }
    });
    
    // Tạo đối tượng cài đặt với giá trị mặc định
    const settings: SyncSettings = {
      sync_auto: 'false',
      sync_interval: '30'
    };
    
    // Cập nhật giá trị từ database
    settingsData.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching sync settings:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
}

/**
 * API endpoint để cập nhật cài đặt đồng bộ
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
    
    // Kiểm tra quyền admin hoặc editor
    const userRole = verifyResult.payload.role;
    if (userRole !== 'admin' && userRole !== 'editor') {
      return NextResponse.json({ 
        message: 'Bạn không có quyền thay đổi cài đặt đồng bộ' 
      }, { status: 403 });
    }
    
    // Lấy dữ liệu từ request
    const data = await req.json();
    
    // Danh sách cài đặt được phép cập nhật
    const allowedSettings = ['sync_auto', 'sync_interval'];
    
    // Tạo mảng promises cho các thao tác cập nhật
    const updatePromises = [];
    
    // Xử lý từng cài đặt
    for (const key of allowedSettings) {
      if (data[key] !== undefined) {
        let value = data[key];
        
        // Kiểm tra và chuẩn hóa các giá trị
        if (key === 'sync_auto') {
          value = String(value) === 'true' ? 'true' : 'false';
        }
        
        if (key === 'sync_interval') {
          const interval = parseInt(value);
          if (isNaN(interval) || interval < 1) {
            return NextResponse.json({
              success: false,
              message: 'Thời gian lặp lại phải là số nguyên dương'
            }, { status: 400 });
          }
          value = String(interval);
        }
        
        // Tạo hoặc cập nhật cài đặt
        updatePromises.push(
          prisma.setting.upsert({
            where: { key },
            update: { value },
            create: {
              key,
              value,
              group: 'sync',
              description: key === 'sync_auto' 
                ? 'Bật/tắt đồng bộ tự động'
                : 'Thời gian lặp lại đồng bộ tự động (phút)'
            }
          })
        );
      }
    }
    
    // Thực hiện tất cả các cập nhật
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    // Lấy lại cài đặt mới nhất
    const updatedSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: allowedSettings
        }
      }
    });
    
    // Chuyển đổi thành đối tượng
    const settings: Record<string, string> = {};
    updatedSettings.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    return NextResponse.json({
      success: true,
      message: 'Đã cập nhật cài đặt đồng bộ',
      ...settings
    });
  } catch (error: any) {
    console.error('Error updating sync settings:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 