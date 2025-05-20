import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint mặc định
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Batch sync API chuyển hướng',
    info: 'Vui lòng sử dụng /api/sync/batch-new thay thế. Đây là phiên bản cải tiến với đầy đủ chức năng như phiên bản cũ.'
  });
}

/**
 * Chuyển hướng yêu cầu đồng bộ batch sang endpoint mới
 */
export async function POST(req: NextRequest) {
  try {
    // Chuyển hướng sang endpoint mới
    const url = new URL(req.url);
    const baseUrl = url.protocol + '//' + url.host;
    const newEndpoint = '/api/sync/batch-new';
    
    // Ghi log thông báo chuyển hướng
    console.log(`[BATCH SYNC] Chuyển hướng yêu cầu sang endpoint mới: ${newEndpoint}`);
    
    return NextResponse.json({ 
      message: 'Batch sync API đã được chuyển', 
      info: 'Vui lòng gửi yêu cầu của bạn đến /api/sync/batch-new',
      redirect: baseUrl + newEndpoint
    }, {
      status: 308,
      headers: {
        'Location': baseUrl + newEndpoint
      }
    });
  } catch (error: any) {
    console.error('[BATCH SYNC] Lỗi server:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi server: ' + (error.message || 'Lỗi không xác định')
    }, { status: 500 });
  }
} 