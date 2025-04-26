import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import metrics from '@/lib/metrics';
import logger from '@/lib/logger';
import { PrismaClient } from '@prisma/client';
import { withCorrelation } from '@/middleware/correlation';

const log = logger.createLogger('metrics-api');
const prisma = new PrismaClient();

// Cập nhật thông tin bổ sung từ database vào metrics
async function updateMetricsFromDatabase() {
  try {
    // Lấy tổng số product mapping
    const productCount = await prisma.productMapping.count();
    metrics.metrics.productsTotal.set(productCount);

    // Lấy thông tin lần sync gần nhất
    const recentSyncs = await prisma.syncLog.findMany({
      where: {
        action: { startsWith: 'sync_' },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 giờ qua
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Thống kê các sync trong 24h qua
    const syncStats = {
      success: 0,
      error: 0,
      skipped: 0
    };

    recentSyncs.forEach(sync => {
      if (sync.status === 'success') syncStats.success++;
      else if (sync.status === 'error') syncStats.error++;
      else if (sync.status === 'skipped') syncStats.skipped++;
    });

    // Cập nhật metrics sử dụng increment thay vì setGauge cho Counter
    metrics.increment(metrics.metrics.syncTotal, { type: 'all', status: 'success' }, syncStats.success);
    metrics.increment(metrics.metrics.syncTotal, { type: 'all', status: 'error' }, syncStats.error);
    metrics.increment(metrics.metrics.syncTotal, { type: 'all', status: 'skipped' }, syncStats.skipped);

    log.debug('Đã cập nhật metrics từ database', { productCount, syncStats });
  } catch (error: any) {
    log.error('Lỗi khi cập nhật metrics từ database', { error: error.message, stack: error.stack });
  }
}

// Handler cho việc lấy metrics dưới dạng text Prometheus
async function getMetricsHandler(req: NextRequest): Promise<NextResponse> {
  // Kiểm tra xác thực (tùy chọn, tùy theo yêu cầu bảo mật)
  const authResult = await verifyAuth(req);
  
  // Nếu cần xác thực và không có
  if (process.env.METRICS_REQUIRE_AUTH === 'true' && !authResult.authenticated) {
    return NextResponse.json(
      { error: 'Không có quyền truy cập metrics' },
      { status: 401 }
    );
  }

  try {
    // Cập nhật metrics từ database
    await updateMetricsFromDatabase();

    // Lấy metrics dưới dạng chuỗi
    const metricsAsString = await metrics.getMetricsAsString();

    // Trả về dưới dạng text/plain theo định dạng của Prometheus
    return new NextResponse(metricsAsString, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  } catch (error: any) {
    log.error('Lỗi khi lấy metrics', { error: error.message, stack: error.stack });
    
    return NextResponse.json(
      { error: 'Lỗi khi lấy metrics' },
      { status: 500 }
    );
  }
}

// Handler cho việc lấy metrics dưới dạng JSON
async function getMetricsJsonHandler(req: NextRequest): Promise<NextResponse> {
  // Kiểm tra xác thực
  const authResult = await verifyAuth(req);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Không có quyền truy cập metrics' },
      { status: 401 }
    );
  }

  try {
    // Cập nhật metrics từ database
    await updateMetricsFromDatabase();

    // Lấy thêm thông tin worker metrics từ worker pool nếu có
    try {
      const workerModule = await import('@/lib/worker-threads');
      const workerPool = workerModule.default();
      const workerMetrics = workerPool.getMetrics();
      metrics.updateWorkerMetrics(workerMetrics);
    } catch (error) {
      log.warn('Không thể lấy worker metrics', { error });
    }

    // Lấy metrics dưới dạng json
    const metricsJson = await metrics.getMetricsAsJson();

    // Mở rộng JSON với thông tin thêm
    const enrichedMetrics = {
      metrics: metricsJson,
      system: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    };

    return NextResponse.json(enrichedMetrics);
  } catch (error: any) {
    log.error('Lỗi khi lấy metrics dạng JSON', { error: error.message, stack: error.stack });
    
    return NextResponse.json(
      { error: 'Lỗi khi lấy metrics dạng JSON' },
      { status: 500 }
    );
  }
}

// GET handler cho endpoint /api/metrics
export const GET = (req: NextRequest) => withCorrelation(req, async (req) => {
  // Kiểm tra format từ query parameter
  const format = req.nextUrl.searchParams.get('format');
  
  // Nếu là json, trả về dạng JSON, ngược lại trả về dạng text Prometheus
  if (format === 'json') {
    return getMetricsJsonHandler(req);
  } else {
    return getMetricsHandler(req);
  }
}); 