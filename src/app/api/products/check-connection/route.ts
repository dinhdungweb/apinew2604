import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import axios from 'axios';
import { getSettings } from '@/lib/queue';

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
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    const SHOPIFY_STORE = settings.shopify_store;
    const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
    
    try {
      // Kiểm tra kết nối đến Shopify API
      const shopifyResponse = await axios.get(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      
      return NextResponse.json({
        success: true,
        message: 'Kết nối đến Shopify thành công',
        details: {
          shopName: shopifyResponse.data.shop.name,
          shopEmail: shopifyResponse.data.shop.email,
          shopDomain: shopifyResponse.data.shop.domain
        }
      });
    } catch (error: any) {
      console.error('Shopify connection error:', error.response?.data || error.message);
      return NextResponse.json({
        success: false,
        message: 'Không thể kết nối đến Shopify API',
        error: error.response?.data?.errors || error.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Connection check API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
} 