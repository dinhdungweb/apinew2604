import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getNhanhProductById, getNhanhApiSettings } from "@/lib/nhanh";
import syncService from '@/lib/syncService';
import { syncQueue } from '@/lib/queue';

// Khởi tạo Redis connection
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Khởi tạo BullMQ queue
const syncLocalQueue = new Queue('product-sync', {
  connection: redisClient
});

interface RequestData {
  productIds: string[];
}

interface SyncJob {
  id: string;
  status: string;
  errorMsg?: string | null;
  jobId?: string;
}

interface BatchSyncResponse {
  success: boolean;
  message?: string;
  jobs: SyncJob[];
  errors?: Record<string, string>;
  batchId?: number;
}

// API endpoint để đồng bộ hàng loạt sản phẩm
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

    // Lấy dữ liệu từ body
    const data: RequestData = await req.json();
    const { productIds } = data;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Danh sách sản phẩm không hợp lệ',
      }, { status: 400 });
    }

    console.log(`[BATCH SYNC] Đồng bộ hàng loạt ${productIds.length} sản phẩm`);

    // Khởi tạo danh sách kết quả
    const results: BatchSyncResponse = {
      success: true,
      jobs: [],
      errors: {}
    };

    // Khởi tạo mảng chứa các công việc đã đẩy vào hàng đợi
    const queuedJobs: any[] = [];

    // Lặp qua từng sản phẩm để đẩy vào hàng đợi
    for (const shopifyId of productIds) {
      try {
        // Tìm mapping hiện tại nếu có
        const existingMapping = await prisma.productMapping.findUnique({
          where: {
            shopifyId: shopifyId
          }
        });

        // Kiểm tra mapping đã tồn tại chưa
        if (!existingMapping) {
          results.jobs.push({
            id: shopifyId,
            status: 'error',
            errorMsg: 'Sản phẩm chưa được thiết lập mapping'
          });
          
          if (results.errors) {
            results.errors[shopifyId] = 'Sản phẩm chưa được thiết lập mapping';
          }
          
          continue;
        }

        // Parse nhanhData to get nhanhId
        let nhanhData;
        try {
          nhanhData = JSON.parse(existingMapping.nhanhData);
        } catch (e) {
          results.jobs.push({
            id: shopifyId,
            status: 'error',
            errorMsg: `Error parsing nhanhData: ${(e as Error).message}`
          });
          
          if (results.errors) {
            results.errors[shopifyId] = `Error parsing nhanhData: ${(e as Error).message}`;
          }
          
          continue;
        }

        const nhanhId = nhanhData?.idNhanh || nhanhData?.id || nhanhData?.nhanhId;
        if (!nhanhId) {
          results.jobs.push({
            id: shopifyId,
            status: 'error',
            errorMsg: 'Không tìm thấy Nhanh ID trong dữ liệu mapping'
          });
          
          if (results.errors) {
            results.errors[shopifyId] = 'Không tìm thấy Nhanh ID trong dữ liệu mapping';
          }
          
          continue;
        }

        // Đẩy công việc vào hàng đợi thay vì xử lý trực tiếp
        const job = await syncQueue.add('sync-products', {
          syncType: 'inventory',
          username: 'system',
          productId: parseInt(nhanhId),
          shopifyVariantId: shopifyId,
          warehouseId: '175080' // Thêm warehouseId để đảm bảo tính nhất quán với getInventoryQuantity
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        });

        // Thêm công việc vào danh sách đã đẩy vào hàng đợi
        queuedJobs.push({
          productId: parseInt(nhanhId),
          shopifyVariantId: shopifyId,
          jobId: job.id.toString(),
          status: 'queued'
        });
        
        results.jobs.push({
          id: shopifyId,
          status: 'queued',
          jobId: job.id.toString()
        });
      } catch (error: any) {
        console.error(`[BATCH SYNC] Lỗi khi đồng bộ sản phẩm ${shopifyId}:`, error.message);
        
        // Thêm kết quả lỗi vào danh sách
        results.jobs.push({
          id: shopifyId,
          status: 'error',
          errorMsg: error.message || 'Lỗi không xác định'
        });
        
        if (results.errors) {
          results.errors[shopifyId] = error.message || 'Lỗi không xác định';
        }
      }
    }

    // Tạo syncLog để theo dõi tiến trình đồng bộ hàng loạt
    const syncLog = await prisma.syncLog.create({
      data: {
        action: 'batch_sync',
        status: 'queued',
        message: `Đã đẩy ${queuedJobs.length} sản phẩm vào hàng đợi để đồng bộ`,
        details: JSON.stringify({
          queuedJobs,
          totalProducts: productIds.length
        }),
        createdBy: 'system'
      }
    });

    // Thêm batchId vào kết quả để có thể theo dõi sau này
    results.batchId = syncLog.id;

    // Trả về kết quả
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[BATCH SYNC] Lỗi server:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi server: ' + (error.message || 'Lỗi không xác định')
    }, { status: 500 });
  }
}

// API endpoint để lấy trạng thái của một batch job
export async function GET(req: NextRequest) {
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
    
    // Lấy batchId từ URL
    const url = new URL(req.url);
    const batchId = url.searchParams.get('batchId');
    
    if (!batchId) {
      return NextResponse.json({ message: 'Thiếu batchId' }, { status: 400 });
    }
    
    // Lấy log đồng bộ từ database
    const batchLog = await prisma.syncLog.findUnique({
      where: {
        id: parseInt(batchId, 10)
      }
    });
    
    if (!batchLog) {
      return NextResponse.json({ message: 'Không tìm thấy batch job' }, { status: 404 });
    }
    
    // Parse chi tiết batch từ chuỗi JSON
    let batchDetails: any = {};
    try {
      batchDetails = JSON.parse(batchLog.details || '{}');
    } catch (error) {
      console.error(`Error parsing batch details for log ${batchLog.id}:`, error);
    }
    
    // Lấy danh sách các công việc trong batch
    const queuedJobs = batchDetails.queuedJobs || [];
    const jobIds = queuedJobs.map((job: any) => job.jobId);
    
    // Lấy trạng thái các công việc từ BullMQ
    const jobStatuses = await Promise.all(jobIds.map(async (jobId: string) => {
      try {
        const job = await syncQueue.getJob(jobId);
        if (!job) {
          return { jobId, status: 'unknown' };
        }
        
        return {
          jobId,
          status: await job.getState(),
          progress: job.progress,
          returnvalue: job.returnvalue,
          failedReason: job.failedReason
        };
      } catch (error: any) {
        console.error(`Error getting job status for ${jobId}:`, error);
        return { jobId, status: 'error', error: error.message };
      }
    }));
    
    // Tính toán số liệu thống kê
    const stats = {
      total: jobIds.length,
      completed: jobStatuses.filter((job: any) => job.status === 'completed').length,
      failed: jobStatuses.filter((job: any) => job.status === 'failed').length,
      waiting: jobStatuses.filter((job: any) => ['waiting', 'delayed'].includes(job.status)).length,
      active: jobStatuses.filter((job: any) => job.status === 'active').length,
      progress: Math.floor((jobStatuses.filter((job: any) => job.status === 'completed').length / (jobIds.length || 1)) * 100)
    };
    
    return NextResponse.json({
      success: true,
      batchId,
      batchLog: {
        id: batchLog.id,
        action: batchLog.action,
        status: batchLog.status,
        message: batchLog.message,
        createdAt: batchLog.createdAt,
        createdBy: batchLog.createdBy
      },
      details: batchDetails,
      jobs: jobStatuses,
      stats
    });
  } catch (error: any) {
    console.error('Batch status API error:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi khi lấy trạng thái batch: ${error.message}`
    }, { status: 500 });
  }
} 