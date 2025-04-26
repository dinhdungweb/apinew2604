import { NextRequest, NextResponse } from 'next/server';
import logger, { initCorrelationId, setCorrelationId } from '@/lib/logger';

// Tên header để truyền correlation ID
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Middleware để xử lý correlation ID
 * 
 * Kiểm tra header request có correlation ID không, nếu không thì tạo ID mới.
 * Đảm bảo tất cả log và response đều chứa cùng một correlation ID để dễ theo dõi.
 */
export async function withCorrelation(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Kiểm tra header có correlation ID không
  const correlationIdFromHeader = req.headers.get(CORRELATION_ID_HEADER);

  // Nếu có, sử dụng ID từ header
  if (correlationIdFromHeader) {
    setCorrelationId(correlationIdFromHeader);
  } else {
    // Nếu không, tạo ID mới
    initCorrelationId();
  }

  // Lấy correlation ID hiện tại
  const correlationId = logger.getCorrelationId();
  
  // Log thông tin request với correlation ID
  logger.http(`Request ${req.method} ${req.nextUrl.pathname}`, {
    module: 'middleware',
    method: req.method,
    url: req.nextUrl.pathname,
    query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    headers: {
      'user-agent': req.headers.get('user-agent'),
      'content-type': req.headers.get('content-type'),
      'accept': req.headers.get('accept'),
    }
  });

  try {
    // Xử lý request
    const response = await handler(req);
    
    // Thêm correlation ID vào header response
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    
    // Log thông tin response
    logger.http(`Response ${response.status} ${req.nextUrl.pathname}`, {
      module: 'middleware',
      status: response.status,
      url: req.nextUrl.pathname,
    });
    
    return response;
  } catch (error: any) {
    // Log lỗi với correlation ID
    logger.error(`Error handling request ${req.nextUrl.pathname}`, {
      module: 'middleware',
      error: error.message,
      stack: error.stack,
      url: req.nextUrl.pathname,
    });
    
    // Tạo response lỗi
    const errorResponse = NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
    
    // Thêm correlation ID vào header response lỗi
    errorResponse.headers.set(CORRELATION_ID_HEADER, correlationId);
    
    return errorResponse;
  }
} 