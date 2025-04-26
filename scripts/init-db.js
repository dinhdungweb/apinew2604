const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

console.log('Khởi tạo cơ sở dữ liệu MySQL...');

async function initDatabase() {
  try {
    const prisma = new PrismaClient();
    
    // Tạo tài khoản admin mặc định nếu chưa tồn tại
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin' }
    });
    
    if (!adminUser) {
      console.log('Tạo tài khoản admin mặc định...');
      const hashedPassword = bcrypt.hashSync('admin', 10);
      
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@example.com',
          role: 'admin',
          status: 'active'
        }
      });
      
      console.log('Đã tạo tài khoản admin mặc định (username: admin, password: admin)');
    } else {
      console.log('Tài khoản admin đã tồn tại');
    }
    
    // Kiểm tra và tạo cài đặt mặc định nếu chưa tồn tại
    const apiKeySetting = await prisma.setting.findFirst({
      where: { key: 'nhanh_api_key' }
    });
    
    if (!apiKeySetting) {
      console.log('Tạo cài đặt mặc định...');
      
      // NHANH API
      await prisma.setting.create({
        data: {
          key: 'nhanh_api_key',
          value: process.env.NHANH_API_KEY || '',
          description: 'Khóa API Nhanh.vn',
          group: 'api'
        }
      });
      
      await prisma.setting.create({
        data: {
          key: 'nhanh_business_id',
          value: process.env.NHANH_BUSINESS_ID || '',
          description: 'ID doanh nghiệp Nhanh.vn',
          group: 'api'
        }
      });
      
      await prisma.setting.create({
        data: {
          key: 'nhanh_app_id',
          value: process.env.NHANH_APP_ID || '',
          description: 'ID ứng dụng Nhanh.vn',
          group: 'api'
        }
      });
      
      // SHOPIFY API
      await prisma.setting.create({
        data: {
          key: 'shopify_access_token',
          value: process.env.SHOPIFY_ACCESS_TOKEN || '',
          description: 'Token truy cập Shopify',
          group: 'api'
        }
      });
      
      await prisma.setting.create({
        data: {
          key: 'shopify_store',
          value: process.env.SHOPIFY_STORE || '',
          description: 'ID cửa hàng Shopify',
          group: 'api'
        }
      });
      
      await prisma.setting.create({
        data: {
          key: 'shopify_location_id',
          value: process.env.SHOPIFY_LOCATION_ID || '',
          description: 'ID vị trí Shopify',
          group: 'api'
        }
      });
      
      // Cấu hình chung
      await prisma.setting.create({
        data: {
          key: 'sync_interval',
          value: process.env.SYNC_INTERVAL || '15',
          description: 'Khoảng thời gian đồng bộ (phút)',
          group: 'system'
        }
      });
      
      console.log('Đã tạo các cài đặt mặc định');
    } else {
      console.log('Các cài đặt mặc định đã tồn tại');
    }
    
    await prisma.$disconnect();
    console.log('Khởi tạo cơ sở dữ liệu MySQL hoàn tất!');
    
  } catch (error) {
    console.error('Lỗi khi khởi tạo cơ sở dữ liệu:', error);
    process.exit(1);
  }
}

initDatabase(); 