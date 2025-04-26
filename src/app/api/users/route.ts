import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, isAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { JWTPayload } from 'jose';

// Hàm kiểm tra nếu là chính người dùng
function isOwnUser(payload: JWTPayload, userId: number): boolean {
  return payload && (
    payload.userId === userId || 
    payload.role === 'admin'
  );
}

// Interface cho các bản ghi User
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

// Lấy danh sách người dùng
export async function GET(req: NextRequest) {
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

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Tham số tìm kiếm và lọc
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';

    // Truy vấn người dùng trực tiếp bằng $queryRaw
    let users: User[];
    
    if (search && role) {
      users = await prisma.$queryRaw<User[]>`
        SELECT id, username, email, role, status, lastLogin, createdAt, updatedAt
        FROM User
        WHERE (username LIKE ${'%' + search + '%'} OR email LIKE ${'%' + search + '%'})
        AND role = ${role}
        ORDER BY username ASC
      `;
    } else if (search) {
      users = await prisma.$queryRaw<User[]>`
        SELECT id, username, email, role, status, lastLogin, createdAt, updatedAt
        FROM User
        WHERE username LIKE ${'%' + search + '%'} OR email LIKE ${'%' + search + '%'}
        ORDER BY username ASC
      `;
    } else if (role) {
      users = await prisma.$queryRaw<User[]>`
        SELECT id, username, email, role, status, lastLogin, createdAt, updatedAt
        FROM User
        WHERE role = ${role}
        ORDER BY username ASC
      `;
    } else {
      users = await prisma.$queryRaw<User[]>`
        SELECT id, username, email, role, status, lastLogin, createdAt, updatedAt
        FROM User
        ORDER BY username ASC
      `;
    }

    return NextResponse.json({
      success: true,
      users
    });
  } catch (error: any) {
    console.error('Users API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Tạo người dùng mới
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

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy thông tin từ request
    const { username, password, email, role } = await req.json();

    // Kiểm tra thông tin bắt buộc
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        message: 'Tên đăng nhập và mật khẩu là bắt buộc'
      }, { status: 400 });
    }

    // Kiểm tra người dùng đã tồn tại bằng Prisma
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại'
      }, { status: 400 });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'editor';

    // Tạo người dùng mới bằng Prisma
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        role: userRole,
        status: 'active'
      }
    });

    // Loại bỏ mật khẩu từ response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      message: 'Tạo người dùng thành công'
    });
  } catch (error: any) {
    console.error('Create user API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Cập nhật thông tin người dùng
export async function PUT(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success || !verifyResult.payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    const payload = verifyResult.payload;

    // Lấy dữ liệu từ body
    const body = await req.json();
    const { id, email, role, status, password, oldPassword } = body;

    if (!id) {
      return NextResponse.json({ message: 'Thiếu ID người dùng' }, { status: 400 });
    }
    
    // Kiểm tra nếu không phải admin và không phải cập nhật chính mình
    if (payload.role !== 'admin' && !isOwnUser(payload, Number(id))) {
      return NextResponse.json({ message: 'Không có quyền cập nhật người dùng này' }, { status: 403 });
    }

    // Kiểm tra người dùng tồn tại bằng Prisma
    const user = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!user) {
      return NextResponse.json({ message: 'Không tìm thấy người dùng' }, { status: 404 });
    }

    // Nếu đổi mật khẩu, kiểm tra mật khẩu cũ (trừ khi là admin)
    if (password && payload.role !== 'admin') {
      // Nếu không cung cấp mật khẩu cũ
      if (!oldPassword) {
        return NextResponse.json({ message: 'Cần cung cấp mật khẩu hiện tại' }, { status: 400 });
      }

      // Kiểm tra mật khẩu cũ
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        return NextResponse.json({ message: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (email !== undefined) {
      updateData.email = email;
    }
    
    if (status !== undefined && payload.role === 'admin') {
      updateData.status = status;
    }
    
    if (role !== undefined && payload.role === 'admin') {
      updateData.role = role;
    }
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Thực hiện cập nhật bằng Prisma
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData
    });

    // Loại bỏ mật khẩu từ response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      message: 'Cập nhật người dùng thành công'
    });
  } catch (error: any) {
    console.error('Update user API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
}

// Xóa người dùng
export async function DELETE(req: NextRequest) {
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

    // Kiểm tra quyền admin
    if (payload.role !== 'admin') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Lấy tham số từ URL
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ message: 'Thiếu ID người dùng' }, { status: 400 });
    }

    // Không cho phép xóa tài khoản chính mình
    if (payload.userId === Number(id)) {
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không thể xóa tài khoản của chính mình' 
      }, { status: 400 });
    }

    // Kiểm tra người dùng tồn tại
    const users = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!users) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy người dùng' 
      }, { status: 404 });
    }

    // Xóa người dùng
    await prisma.user.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({
      success: true,
      message: 'Xóa người dùng thành công'
    });
  } catch (error: any) {
    console.error('Delete user API error:', error.message);
    return NextResponse.json({
      success: false,
      message: `Lỗi server: ${error.message}`
    }, { status: 500 });
  }
} 