import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Hàm để chuyển đổi BigInt thành số trong kết quả
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToNumber(item));
  }

  if (typeof obj === 'object') {
    const converted: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        converted[key] = convertBigIntToNumber(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

export async function GET(req: NextRequest) {
  try {
    // Kiểm tra số lượng bản ghi trong bảng SyncLog
    const syncLogCount = await prisma.syncLog.count();
    
    // Lấy 5 bản ghi mới nhất
    const recentLogs = await prisma.syncLog.findMany({
      select: {
        id: true,
        productMappingId: true,
        action: true,
        status: true,
        message: true,
        createdAt: true,
        createdBy: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    // Kiểm tra các bảng khác
    const productMappingCount = await prisma.productMapping.count();
    const userCount = await prisma.user.count();
    const settingCount = await prisma.setting.count();
    
    // Lấy thông tin về cấu trúc bảng (không có tương đương trực tiếp trong Prisma,
    // nhưng chúng ta có thể cung cấp thông tin về model từ Prisma)
    const prismaModels = {
      syncLog: Object.keys(prisma.syncLog.fields),
      productMapping: Object.keys(prisma.productMapping.fields),
      user: Object.keys(prisma.user.fields),
      setting: Object.keys(prisma.setting.fields)
    };
    
    // Chuyển đổi các giá trị BigInt trước khi gửi JSON
    const result = {
      success: true,
      count: syncLogCount,
      recentLogs: convertBigIntToNumber(recentLogs),
      tables: {
        ProductMapping: productMappingCount,
        User: userCount,
        Setting: settingCount
      },
      schema: prismaModels
    };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Debug SyncLog error:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message}`
    }, { status: 500 });
  }
} 