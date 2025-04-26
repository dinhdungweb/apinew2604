import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import axios from 'axios';
import { getSettings } from '@/lib/queue';
import prisma from '@/lib/prisma';

// API để lấy chi tiết tồn kho
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
    const NHANH_APP_ID = settings.nhanh_app_id;
    const NHANH_BUSINESS_ID = settings.nhanh_business_id;
    const NHANH_API_KEY = settings.nhanh_api_key;
    
    // Lấy tham số từ URL
    const url = new URL(req.url);
    const nhanhId = url.searchParams.get('nhanhId');
    
    if (!nhanhId) {
      return NextResponse.json({ 
        success: false,
        message: 'Thiếu tham số nhanhId' 
      }, { status: 400 });
    }
    
    // Lấy thông tin chi tiết sản phẩm từ Nhanh.vn
    try {
      const response = await axios.post(
        'https://open.nhanh.vn/api/product/search',
        new URLSearchParams({
          'version': '2.0',
          'appId': NHANH_APP_ID,
          'businessId': NHANH_BUSINESS_ID,
          'accessToken': NHANH_API_KEY,
          'data': JSON.stringify({ 'id': nhanhId })
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Kiểm tra và trả về kết quả
      if (response.data.code !== 1) {
        return NextResponse.json({
          success: false,
          message: 'Không thể lấy thông tin sản phẩm từ Nhanh.vn',
          error: response.data.code
        }, { status: 500 });
      }
      
      // Lấy thông tin sản phẩm từ dữ liệu trả về
      const products = response.data.data?.products || [];
      if (!products.length) {
        return NextResponse.json({
          success: false,
          message: 'Không tìm thấy sản phẩm' 
        }, { status: 404 });
      }
      
      // Trả về sản phẩm đầu tiên (sẽ chỉ có 1 sản phẩm khi tìm kiếm theo ID)
      const product = products[0];
      
      return NextResponse.json({
        success: true,
        product
      });
      
    } catch (error: any) {
      console.error('Nhanh.vn API error:', error.response?.data || error.message);
      return NextResponse.json({
        success: false,
        message: 'Lỗi khi kết nối đến API Nhanh.vn',
        error: error.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Lỗi server'
    }, { status: 500 });
  }
} 