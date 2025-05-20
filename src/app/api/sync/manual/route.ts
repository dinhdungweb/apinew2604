import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import axios from 'axios';
import { JWTPayload } from 'jose';

// Interface cho model Setting
interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  group: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface cho model SyncLog
interface SyncLog {
  id: number;
  productMappingId: number | null;
  action: string;
  status: string;
  message: string | null;
  details: string | null;
  createdAt: Date;
  createdBy: string | null;
}

// Interface cho ProductMapping
interface ProductMapping {
  id: number;
  shopifyId: string;
  nhanhData: string;
  status: string | null;
  errorMsg: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API endpoint để thực hiện đồng bộ thủ công
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
    
    const payload = verifyResult.payload;

    // Lấy dữ liệu từ body request
    let productId = null;
    let syncTypeValue = null;
    let warehouseId = '175080'; // Mặc định kho 175080
    let syncAllProducts = false;
    
    try {
      const body = await req.json();
      if (body.productId) {
        productId = parseInt(body.productId, 10);
      }
      if (body && typeof body.syncType === 'string' && 
          ['all', 'inventory', 'price', 'orders'].includes(body.syncType)) {
        syncTypeValue = body.syncType;
      }
      if (body && typeof body.warehouseId === 'string') {
        warehouseId = body.warehouseId;
      }
      if (body && typeof body.syncAll === 'boolean') {
        syncAllProducts = body.syncAll;
      }
    } catch (error) {
      console.log('No body provided, using defaults');
    }

    // Lấy cài đặt API từ database
    const apiSettings = await getApiSettings();

    // Kiểm tra sản phẩm tồn tại
    let productMapping;
    
    if (productId) {
      // Sử dụng Prisma Client thay vì raw SQL
      productMapping = await prisma.productMapping.findUnique({
        where: {
          id: Number(productId)
        }
      });
      
      if (!productMapping) {
        return NextResponse.json({ 
          success: false, 
          message: 'Không tìm thấy sản phẩm' 
        }, { status: 404 });
      }
    }

    // Thực hiện đồng bộ sản phẩm (nếu có productId)
    let syncResults = [];
    
    if (syncTypeValue === 'orders') {
      // Đồng bộ đơn hàng
      try {
        // Sử dụng chức năng syncOrders từ syncService
        const { syncOrders } = require('@/lib/syncService.js');
        
        const result = await syncOrders(apiSettings, 
          (msg: string) => console.log(`[API][syncOrders] ${msg}`),
          (progress: number) => console.log(`[API][syncOrders] Progress: ${progress}%`)
        );
        
        await prisma.syncLog.create({
          data: {
            action: 'sync_orders',
            status: 'success',
            message: 'Đồng bộ đơn hàng thành công',
            details: JSON.stringify(result),
            createdBy: String(payload.username || 'system')
          }
        });
        
        console.log(`[API] Đồng bộ đơn hàng thành công:`, result);
        
        return NextResponse.json({
          success: true,
          results: result
        });
      } catch (error: any) {
        console.error(`[API] Lỗi đồng bộ đơn hàng:`, error);
        
        await prisma.syncLog.create({
          data: {
            action: 'sync_orders',
            status: 'error',
            message: `Lỗi: ${error.message || 'Không xác định'}`,
            details: JSON.stringify({
              error: error.message,
              stack: error.stack
            }),
            createdBy: String(payload.username || 'system')
          }
        });
        
        return NextResponse.json({
          success: false,
          message: `Lỗi khi đồng bộ đơn hàng: ${error.message || 'Không xác định'}`
        }, { status: 500 });
      }
    } else if (productMapping) {
      // Đồng bộ một sản phẩm cụ thể
      const result = await syncProduct(productMapping, apiSettings, String(payload.username || 'system'), warehouseId);
      syncResults.push(result);
    } else {
      // Đồng bộ bằng worker nếu không chỉ định sản phẩm cụ thể
      try {
        // Tạo mã tác vụ
        const jobId = Date.now().toString();
        
        // Thêm tác vụ vào queue
        const Bull = require('bullmq');
        const Redis = require('ioredis');
        
        // Kết nối Redis
        const redisConnection = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10)
        });
        
        // Chọn queue dựa trên loại đồng bộ
        let queueName = 'scheduled-queue';
        if (syncTypeValue === 'inventory') queueName = 'inventory-sync-queue';
        if (syncTypeValue === 'price') queueName = 'price-sync-queue';
        
        const queue = new Bull.Queue(queueName, { connection: redisConnection });
        
        // Thêm tác vụ vào queue
        await queue.add('sync-products', {
          syncType: syncTypeValue || 'inventory',
          username: String(payload.username || 'system'),
          syncAllProducts: syncAllProducts,
          scheduledLogId: null,
          warehouseId: warehouseId
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        });
        
        // Tạo log tác vụ
        await prisma.syncLog.create({
          data: {
            action: `schedule_${syncTypeValue || 'inventory'}`,
            status: 'scheduled',
            message: `Lên lịch đồng bộ ${syncTypeValue || 'inventory'} thủ công`,
            details: JSON.stringify({
              scheduledTime: new Date().toISOString(),
              username: String(payload.username || 'system'),
              syncAllProducts,
              warehouseId
            }),
            createdBy: String(payload.username || 'system')
          }
        });
        
        return NextResponse.json({
          success: true,
          message: 'Đã thêm tác vụ đồng bộ vào hàng đợi'
        });
        
      } catch (error: any) {
        console.error(`[API] Lỗi khi thêm tác vụ đồng bộ vào queue:`, error);
        return NextResponse.json({
          success: false,
          message: `Lỗi khi thêm tác vụ đồng bộ: ${error.message}`
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      results: syncResults
    });
  } catch (error: any) {
    console.error('Sync API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Hàm lấy cài đặt API từ database
async function getApiSettings() {
  try {
    // Sử dụng Prisma Client thay vì raw SQL
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'shopify_access_token',
            'shopify_store',
            'shopify_location_id',
            'nhanh_api_key',
            'nhanh_business_id',
            'nhanh_app_id',
            'nhanh_warehouse_id'
          ]
        }
      }
    });

    const apiSettings: Record<string, string> = {};
    settings.forEach((setting: Setting) => {
      apiSettings[setting.key] = setting.value;
    });

    return {
      shopify_access_token: apiSettings.shopify_access_token || process.env.SHOPIFY_ACCESS_TOKEN || '',
      shopify_store: apiSettings.shopify_store || process.env.SHOPIFY_STORE || '',
      shopify_location_id: apiSettings.shopify_location_id || process.env.SHOPIFY_LOCATION_ID || '',
      nhanh_api_key: apiSettings.nhanh_api_key || process.env.NHANH_API_KEY || '',
      nhanh_business_id: apiSettings.nhanh_business_id || process.env.NHANH_BUSINESS_ID || '',
      nhanh_app_id: apiSettings.nhanh_app_id || process.env.NHANH_APP_ID || '',
      nhanh_warehouse_id: apiSettings.nhanh_warehouse_id || process.env.NHANH_WAREHOUSE_ID || '175080'
    };
  } catch (error) {
    console.error('Error getting API settings:', error);
    // Trả về cài đặt từ biến môi trường nếu không thể lấy từ database
    return {
      shopify_access_token: process.env.SHOPIFY_ACCESS_TOKEN || '',
      shopify_store: process.env.SHOPIFY_STORE || '',
      shopify_location_id: process.env.SHOPIFY_LOCATION_ID || '',
      nhanh_api_key: process.env.NHANH_API_KEY || '',
      nhanh_business_id: process.env.NHANH_BUSINESS_ID || '',
      nhanh_app_id: process.env.NHANH_APP_ID || '',
      nhanh_warehouse_id: process.env.NHANH_WAREHOUSE_ID || '175080'
    };
  }
}

// Hàm đồng bộ một sản phẩm
async function syncProduct(product: any, apiSettings: Record<string, string>, username: string, warehouseId: string = '175080') {
  try {
    // Lấy dữ liệu sản phẩm từ Shopify
    const shopifyData = await getShopifyProduct(product.shopifyId, apiSettings);
    
    // Phân tích dữ liệu Nhanh.vn từ trường nhanhData
    let nhanhData;
    try {
      nhanhData = typeof product.nhanhData === 'string' 
        ? JSON.parse(product.nhanhData) 
        : product.nhanhData;
    } catch (parseError) {
      console.error(`Lỗi parse nhanhData cho sản phẩm ${product.id}:`, parseError.message);
      nhanhData = { idNhanh: product.externalId || product.id };
    }
    
    // Log thông tin trước khi đồng bộ để debug
    console.log(`[Manual Sync] Đồng bộ sản phẩm ${product.id}, shopifyId: ${product.shopifyId}, warehouseId: ${warehouseId}`);
    
    // Thực hiện đồng bộ sản phẩm với syncInventory của syncService
    const { syncInventory } = require('@/lib/syncService.js');
    const result = await syncInventory(product, nhanhData, apiSettings, username, warehouseId);
    
    return {
      productId: product.shopifyId,
      success: true,
      message: 'Đồng bộ sản phẩm thành công',
      details: result
    };
  } catch (error: any) {
    console.error(`Error syncing product ${product.id}:`, error.message);
    
    // Không tạo bản ghi lỗi thứ hai, thay vào đó chỉ ghi log lỗi
    console.log(`Lỗi đồng bộ sản phẩm ${product.id}: ${error.message}`);
    
    // Cập nhật trạng thái sản phẩm bằng Prisma
    await prisma.productMapping.update({
      where: {
        id: product.id
      },
      data: {
        status: 'error',
        errorMsg: 'Lỗi đồng bộ: ' + error.message
      }
    });

    return {
      productId: product.shopifyId,
      syncId: 0,
      success: false,
      message: `Lỗi đồng bộ: ${error.message}`
    };
  }
}

// Hàm lấy dữ liệu sản phẩm từ Shopify
async function getShopifyProduct(productId: string, apiSettings: Record<string, string>) {
  try {
    console.log(`Đang lấy dữ liệu sản phẩm Shopify ID: ${productId}`);
    
    const shopifyEndpoint = `https://${apiSettings.shopify_store}.myshopify.com/admin/api/2023-01/products/${productId.replace('shopify_', '')}.json`;
    
    const response = await axios.get(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': apiSettings.shopify_access_token
      }
    });
    
    if (response.data && response.data.product) {
      return response.data.product;
    } else {
      throw new Error('Không tìm thấy dữ liệu sản phẩm từ Shopify');
    }
  } catch (error) {
    console.warn(`Không thể lấy dữ liệu từ Shopify cho sản phẩm ${productId}: ${error}`);
    // Trả về dữ liệu mẫu cho mục đích testing
    console.log('Trả về dữ liệu mẫu cho sản phẩm Shopify');
    return {
      id: productId.replace('shopify_', ''),
      title: 'Sản phẩm mẫu',
      variants: [
        {
          id: `variant_${productId.replace('shopify_', '')}`,
          inventory_quantity: Math.floor(Math.random() * 100),
          price: Math.floor(Math.random() * 1000000) + 50000
        }
      ]
    };
  }
} 