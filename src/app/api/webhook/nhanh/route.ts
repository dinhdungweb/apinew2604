import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncQueue } from '@/lib/queue';
import crypto from 'crypto';
import { discoverNewProducts } from '@/lib/productDiscovery';
import { getSettings } from '@/lib/queue';

/**
 * Interface cho dữ liệu webhook Nhanh.vn
 */
interface NhanhWebhookData {
  event: string;
  businessId?: number | string;
  webhooksVerifyToken: string;
  data: any;
}

/**
 * Xác thực webhook từ Nhanh.vn
 */
function validateWebhookSignature(request: NextRequest, webhookData: NhanhWebhookData): boolean {
  try {
    // Lấy token xác minh từ cấu hình
    const configToken = process.env.WEBHOOK_VERIFY_TOKEN || '';
    
    // Nếu đang trong môi trường dev/test, có thể bỏ qua xác thực
    if (process.env.NODE_ENV === 'development' && !configToken) {
      console.log('[Webhook] Dev mode - bỏ qua xác thực webhook');
      return true;
    }
    
    // Kiểm tra token
    if (!webhookData.webhooksVerifyToken) {
      console.error('[Webhook] Thiếu token xác thực');
      return false;
    }
    
    // Kiểm tra token từ webhook với token trong cấu hình
    return webhookData.webhooksVerifyToken === configToken;
  } catch (error) {
    console.error('[Webhook] Lỗi khi xác thực webhook:', error);
    return false;
  }
}

/**
 * Endpoint xử lý webhook từ Nhanh.vn
 */
export async function POST(req: NextRequest) {
  console.log('[Webhook] Nhận webhook từ Nhanh.vn');
  
  try {
    // Lấy dữ liệu webhook
    const webhookData: NhanhWebhookData = await req.json();
    
    console.log('[Webhook] Dữ liệu nhận được:', JSON.stringify(webhookData));
    
    if (!webhookData || !webhookData.event) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    
    // Xác thực webhook
    if (!validateWebhookSignature(req, webhookData)) {
      console.error('[Webhook] Xác thực webhook thất bại');
      return NextResponse.json({ error: 'Xác thực thất bại' }, { status: 401 });
    }
    
    // Xử lý sự kiện webhooksEnabled - đây là sự kiện test
    if (webhookData.event === 'webhooksEnabled') {
      console.log('[Webhook] Nhận sự kiện webhooksEnabled - Webhook đã được kết nối thành công');
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook kết nối thành công'
      });
    }
    
    // Xử lý theo loại sự kiện
    const { event, data } = webhookData;
    
    // Xử lý sự kiện thêm sản phẩm mới
    if (event === 'productAdd') {
      console.log('[Webhook] Sự kiện thêm sản phẩm mới');
      
      // Lấy cài đặt API
      const settings = await getSettings();
      
      // Tạo sản phẩm mới trong hệ thống
      try {
        await discoverNewProducts(settings);
        
        return NextResponse.json({
          success: true,
          message: 'Đã xử lý sự kiện thêm sản phẩm mới'
        });
      } catch (error: any) {
        console.error('[Webhook] Lỗi khi xử lý sản phẩm mới:', error);
        return NextResponse.json({
          success: false,
          message: 'Lỗi khi xử lý sản phẩm mới: ' + error.message
        });
      }
    }
    
    // Xử lý sự kiện inventoryChange - thay đổi tồn kho
    if (event === 'inventoryChange') {
      console.log('[Webhook] Sự kiện thay đổi tồn kho');
      
      // Kiểm tra dữ liệu
      if (!data || !data.id) {
        return NextResponse.json({ error: 'Thiếu thông tin sản phẩm' }, { status: 400 });
      }
      
      // Tìm sản phẩm trong hệ thống
      const product = await prisma.productMapping.findFirst({
        where: {
          nhanhData: {
            contains: data.id.id.toString()
          }
        }
      });
      
      if (!product) {
        console.log(`[Webhook] Không tìm thấy sản phẩm với ID Nhanh: ${data.id.id}`);
        return NextResponse.json({ 
          success: false,
          message: 'Sản phẩm không tồn tại trong hệ thống, đã lên lịch kiểm tra sản phẩm mới'
        });
      }
      
      // Thêm vào hàng đợi với ưu tiên cao
      await syncQueue.add('sync-products', {
        syncType: 'inventory',
        productIds: [product.id],
        priority: 'high',
        source: 'webhook',
        username: 'webhook',
        webhookData: data
      }, {
        priority: 10, // Ưu tiên cao hơn đồng bộ theo lịch
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 }
      });
      
      console.log(`[Webhook] Đã thêm sản phẩm ${product.id} vào hàng đợi đồng bộ tồn kho`);
      
      // Tạo log đồng bộ
      await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: 'webhook_inventory',
          status: 'scheduled',
          message: `Đồng bộ tồn kho từ webhook - ${event}`,
          details: JSON.stringify({
            webhookEvent: event,
            webhookData: data,
            scheduledTime: new Date()
          }),
          createdBy: 'webhook'
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Đã nhận webhook thay đổi tồn kho và thêm vào hàng đợi đồng bộ',
        productId: product.id
      });
    }
    
    // Xử lý sự kiện productUpdate - cập nhật sản phẩm
    if (event === 'productUpdate') {
      console.log('[Webhook] Sự kiện cập nhật sản phẩm');
      
      // Kiểm tra dữ liệu
      if (!data || !data.productId) {
        return NextResponse.json({ error: 'Thiếu thông tin sản phẩm' }, { status: 400 });
      }
      
      // Tìm sản phẩm trong hệ thống
      const product = await prisma.productMapping.findFirst({
        where: {
          nhanhData: {
            contains: data.productId.toString()
          }
        }
      });
      
      if (!product) {
        console.log(`[Webhook] Không tìm thấy sản phẩm với ID Nhanh: ${data.productId}`);
        return NextResponse.json({ 
          success: false,
          message: 'Sản phẩm không tồn tại trong hệ thống, đã lên lịch kiểm tra sản phẩm mới'
        });
      }
      
      // Thêm vào hàng đợi với ưu tiên cao
      await syncQueue.add('sync-products', {
        syncType: 'all', // Đồng bộ cả tồn kho và giá
        productIds: [product.id],
        priority: 'high',
        source: 'webhook',
        username: 'webhook',
        webhookData: data
      }, {
        priority: 10,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 }
      });
      
      console.log(`[Webhook] Đã thêm sản phẩm ${product.id} vào hàng đợi đồng bộ toàn bộ`);
      
      // Tạo log đồng bộ
      await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: 'webhook_all',
          status: 'scheduled',
          message: `Đồng bộ thông tin từ webhook - ${event}`,
          details: JSON.stringify({
            webhookEvent: event,
            webhookData: data,
            scheduledTime: new Date()
          }),
          createdBy: 'webhook'
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Đã nhận webhook cập nhật sản phẩm và thêm vào hàng đợi đồng bộ',
        productId: product.id
      });
    }
    
    // Xử lý các sự kiện khác
    console.log(`[Webhook] Sự kiện chưa được xử lý: ${event}`);
    return NextResponse.json({
      success: true,
      message: `Đã nhận webhook nhưng chưa xử lý sự kiện: ${event}`
    });
    
  } catch (error: any) {
    console.error('[Webhook] Lỗi xử lý webhook:', error);
    return NextResponse.json({ 
      error: 'Lỗi server: ' + (error.message || 'Không xác định')
    }, { status: 500 });
  }
}

/**
 * Endpoint kiểm tra trạng thái webhook
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    message: 'Nhanh.vn webhook endpoint đang hoạt động',
    time: new Date().toISOString()
  });
} 