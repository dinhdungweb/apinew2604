import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Kết nối Redis
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

export async function GET() {
  try {
    // Lấy thông tin worker từ database
    const workerStatusSetting = await prisma.setting.findUnique({
      where: { key: 'worker_status' }
    });

    let workerStatus = { isRunning: false };
    if (workerStatusSetting && workerStatusSetting.value) {
      try {
        workerStatus = JSON.parse(workerStatusSetting.value);
      } catch (e) {
        console.error('Lỗi phân tích dữ liệu worker_status:', e);
      }
    }

    // Lấy cài đặt đồng bộ tự động
    const syncAutoSetting = await prisma.setting.findUnique({
      where: { key: 'sync_auto' }
    });
    
    const syncIntervalSetting = await prisma.setting.findUnique({
      where: { key: 'sync_interval' }
    });

    // Kiểm tra tiến trình Redis
    let redisStatus = false;
    try {
      const pingResult = await redisConnection.ping();
      redisStatus = pingResult === 'PONG';
    } catch (e) {
      console.error('Lỗi kết nối Redis:', e);
    }

    // Lấy 5 tác vụ gần nhất
    const recentTasks = await prisma.syncLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    // Thống kê theo trạng thái
    const statusStats = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count 
      FROM \`SyncLog\`
      WHERE createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY status
    `;

    // Đếm tổng số sản phẩm đã mapping
    const totalProducts = await prisma.productMapping.count();

    // Đếm số sản phẩm theo trạng thái
    const productStatusCount = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count
      FROM \`ProductMapping\`
      GROUP BY status
    `;

    // Thống kê hiệu suất đồng bộ
    const lastSyncPerformanceSetting = await prisma.setting.findUnique({
      where: { key: 'last_sync_performance' }
    });

    let lastSyncPerformance = {};
    if (lastSyncPerformanceSetting && lastSyncPerformanceSetting.value) {
      try {
        lastSyncPerformance = JSON.parse(lastSyncPerformanceSetting.value);
      } catch (e) {
        console.error('Lỗi phân tích dữ liệu last_sync_performance:', e);
      }
    }

    // Đóng kết nối với redis
    await redisConnection.quit();

    // Đóng kết nối với database
    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      data: {
        workerStatus,
        syncSettings: {
          autoSync: syncAutoSetting?.value === 'true',
          interval: parseInt(syncIntervalSetting?.value || '30', 10)
        },
        redisStatus,
        recentTasks,
        statusStats,
        productStats: {
          total: totalProducts,
          byStatus: productStatusCount
        },
        performance: lastSyncPerformance
      }
    });
  } catch (error) {
    console.error('API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 