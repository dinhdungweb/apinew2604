import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Interface cho User
interface User {
  id: number;
  username: string;
  password: string;
  email: string | null;
  role: string;
  status: string;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(req: NextRequest) {
  try {
    // Kiểm tra đã có user nào chưa sử dụng Prisma
    const userCount = await prisma.user.count();
    
    // Nếu đã có user, trả về thông báo
    if (userCount > 0) {
      return NextResponse.json({
        success: true,
        message: 'Đã có tài khoản trong hệ thống. Không tạo mới.',
        userCount
      });
    }
    
    // Tạo tài khoản admin mặc định
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Sử dụng Prisma để tạo admin account
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        role: 'admin',
        status: 'active'
      }
    });

    // Che giấu mật khẩu trước khi trả về
    const { password, ...adminInfo } = admin;
    
    return NextResponse.json({
      success: true,
      message: 'Đã tạo tài khoản admin mặc định thành công',
      user: adminInfo
    });
  } catch (error: any) {
    console.error('Error creating default admin:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message}`
    }, { status: 500 });
  }
} 