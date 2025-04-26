import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Interface cho cài đặt
interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  group: string;
  createdAt: Date;
  updatedAt: Date;
}

// Lấy danh sách cài đặt
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
    
    const payload = verifyResult.payload;

    // Lấy nhóm cài đặt từ query params nếu có
    const url = new URL(req.url);
    const group = url.searchParams.get('group');

    // Sử dụng Prisma để truy vấn cài đặt
    let settingsQuery;
    if (group) {
      settingsQuery = await prisma.setting.findMany({
        where: {
          group: group
        },
        orderBy: [
          { group: 'asc' },
          { key: 'asc' }
        ]
      });
    } else {
      settingsQuery = await prisma.setting.findMany({
        orderBy: [
          { group: 'asc' },
          { key: 'asc' }
        ]
      });
    }

    // Nhóm cài đặt theo group
    const groupedSettings: Record<string, any[]> = {};
    settingsQuery.forEach((setting: Setting) => {
      if (!groupedSettings[setting.group]) {
        groupedSettings[setting.group] = [];
      }
      groupedSettings[setting.group].push(setting);
    });

    return NextResponse.json({
      success: true,
      settings: groupedSettings
    });
  } catch (error: any) {
    console.error('Settings API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Tạo hoặc cập nhật cài đặt
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

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy dữ liệu từ request
    const { key, value, description, group } = await req.json();

    // Kiểm tra thông tin bắt buộc
    if (!key || value === undefined) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu thông tin key hoặc value'
      }, { status: 400 });
    }

    // Kiểm tra cài đặt đã tồn tại
    const existingSetting = await prisma.setting.findFirst({
      where: { key }
    });
    
    if (existingSetting) {
      // Cập nhật cài đặt hiện có
      await prisma.setting.updateMany({
        where: { key },
        data: {
          value: String(value),
          description: description || existingSetting.description,
          group: group || existingSetting.group
        }
      });
    } else {
      // Tạo cài đặt mới
      await prisma.setting.create({
        data: {
          key,
          value: String(value),
          description: description || null,
          group: group || 'system'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: existingSetting ? 'Cập nhật cài đặt thành công' : 'Tạo cài đặt thành công'
    });
  } catch (error: any) {
    console.error('Settings API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Xóa cài đặt
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
    
    const payload = verifyResult.payload;

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy key từ query params
    const url = new URL(req.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu thông tin key'
      }, { status: 400 });
    }

    // Kiểm tra cài đặt tồn tại
    const existingSetting = await prisma.setting.findFirst({
      where: { key }
    });

    if (!existingSetting) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy cài đặt'
      }, { status: 404 });
    }

    // Xóa cài đặt
    await prisma.setting.deleteMany({
      where: { key }
    });

    return NextResponse.json({
      success: true,
      message: 'Xóa cài đặt thành công'
    });
  } catch (error: any) {
    console.error('Settings API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Khởi tạo các cài đặt mặc định
export async function PATCH(req: NextRequest) {
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

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Kiểm tra nếu createOnly=true từ request body
    const { createOnly } = await req.json().catch(() => ({}));

    // Danh sách cài đặt mặc định
    const defaultSettings = [
      {
        key: 'shopify_access_token',
        value: process.env.SHOPIFY_ACCESS_TOKEN || '',
        description: 'Access token cho Shopify API',
        group: 'api'
      },
      {
        key: 'shopify_store',
        value: process.env.SHOPIFY_STORE || '',
        description: 'Tên store Shopify',
        group: 'api'
      },
      {
        key: 'shopify_location_id',
        value: process.env.SHOPIFY_LOCATION_ID || '',
        description: 'ID location mặc định của Shopify',
        group: 'api'
      },
      {
        key: 'nhanh_api_key',
        value: process.env.NHANH_API_KEY || '',
        description: 'API key cho Nhanh.vn API',
        group: 'api'
      },
      {
        key: 'nhanh_business_id',
        value: process.env.NHANH_BUSINESS_ID || '',
        description: 'Business ID của Nhanh.vn',
        group: 'api'
      },
      {
        key: 'nhanh_app_id',
        value: process.env.NHANH_APP_ID || '',
        description: 'App ID của Nhanh.vn',
        group: 'api'
      },
      {
        key: 'sync_interval',
        value: process.env.SYNC_INTERVAL || '30',
        description: 'Khoảng thời gian đồng bộ tự động (phút)',
        group: 'system'
      },
      {
        key: 'sync_auto',
        value: process.env.SYNC_AUTO || 'false',
        description: 'Bật/tắt đồng bộ tự động',
        group: 'system'
      },
      {
        key: 'notification_email',
        value: process.env.NOTIFICATION_EMAIL || 'admin@example.com',
        description: 'Email nhận thông báo',
        group: 'notification'
      },
      {
        key: 'error_notification',
        value: process.env.ERROR_NOTIFICATION || 'true',
        description: 'Bật/tắt thông báo lỗi',
        group: 'notification'
      }
    ];

    const now = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;

    // Tạo hoặc cập nhật từng cài đặt
    for (const setting of defaultSettings) {
      // Kiểm tra cài đặt đã tồn tại
      const existingSetting = await prisma.setting.findFirst({
        where: { key: setting.key }
      });
      
      if (existingSetting) {
        // Không cập nhật nếu đã tồn tại hoặc createOnly=true
        if (!createOnly) {
          // Chỉ cập nhật khi createOnly=false hoặc không xác định
          await prisma.setting.updateMany({
            where: { key: setting.key },
            data: {
              value: setting.value,
              description: setting.description || existingSetting.description,
              group: setting.group || existingSetting.group
            }
          });
        }
        updatedCount++;
      } else {
        // Tạo cài đặt mới
        await prisma.setting.create({
          data: {
            key: setting.key,
            value: setting.value,
            description: setting.description || null,
            group: setting.group || 'system'
          }
        });
        
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Khởi tạo cài đặt mặc định thành công (${createdCount} mới, ${updatedCount} cập nhật)`,
      stats: {
        created: createdCount,
        updated: updatedCount,
        total: defaultSettings.length
      }
    });
  } catch (error: any) {
    console.error('Init settings API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
} 