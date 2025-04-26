import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import { getShopifyCacheInfo, CACHE_CONFIG } from '@/lib/shopifyCache';

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
    
    // Lấy thông tin cache từ hàm tiện ích
    const cacheInfo = await getShopifyCacheInfo();
    
    return NextResponse.json({
      success: true,
      cacheInfo: {
        timestamp: cacheInfo.timestamp,
        isExpired: cacheInfo.isExpired,
        itemCount: cacheInfo.itemCount,
        cache: cacheInfo.cache
      }
    });
  } catch (error: any) {
    console.error('Error getting cache info:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message || 'Không xác định'}`
    }, { status: 500 });
  }
} 