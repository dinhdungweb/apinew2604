import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import axios from 'axios';
import { clearShopifyCache, CACHE_CONFIG } from '@/lib/shopifyCache';
import { getSettings } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Xóa cache hiện tại
    console.log('Đang xóa cache sản phẩm Shopify');
    clearShopifyCache();
    
    // Kích hoạt làm mới cache bằng cách gọi API products để lấy toàn bộ dữ liệu
    console.log('Đang làm mới dữ liệu sản phẩm từ Shopify');
    
    try {
      // Chỉ làm trống cache, không tự lấy dữ liệu mới - để API products xử lý việc lấy dữ liệu đầy đủ
      // Khi products/page.tsx gọi fetchProducts(), nó sẽ lấy toàn bộ dữ liệu, bao gồm tất cả variants
      console.log('Đã xóa cache, đợi API products lấy dữ liệu đầy đủ');
      
      return NextResponse.json({
        success: true,
        message: 'Đã xóa cache và yêu cầu làm mới dữ liệu sản phẩm'
      });
    } catch (error: any) {
      console.error('Lỗi khi kích hoạt làm mới cache:', error.message);
      return NextResponse.json({
        success: false,
        message: 'Đã xóa cache nhưng gặp lỗi khi kích hoạt làm mới dữ liệu',
        error: error.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Refresh cache API error:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Lỗi server: ' + error.message 
    }, { status: 500 });
  }
} 