import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'mysupersecretkey';

export async function POST(req: NextRequest) {
  try {
    // Lấy thông tin đăng nhập từ body
    const { username, password } = await req.json();

    // Kiểm tra thông tin bắt buộc
    if (!username || !password) {
      return NextResponse.json(
        { message: "Thiếu thông tin đăng nhập" },
        { status: 400 }
      );
    }

    // Tìm user trong database
    const user = await prisma.user.findFirst({
      where: {
        username: username,
        status: 'active'
      }
    });

    // Kiểm tra user tồn tại và password đúng
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return NextResponse.json(
        { message: "Sai tên đăng nhập hoặc mật khẩu" },
        { status: 401 }
      );
    }

    // Cập nhật thời gian đăng nhập cuối
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date()
      }
    });

    // Tạo JWT token
    const tokenData = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    // Tạo chuỗi JWT thủ công
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 24 * 60 * 60; // 24 giờ

    const payload = {
      ...tokenData,
      iat: now,
      exp: expiry
    };

    // Mã hóa header và payload thành base64
    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // Tạo chữ ký
    const signature = crypto.createHmac('sha256', Buffer.from(JWT_SECRET))
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Tạo JWT
    const token = `${headerBase64}.${payloadBase64}.${signature}`;

    // Trả về token
    return NextResponse.json({
      token,
      role: user.role,
      username: user.username,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Lỗi server" }, { status: 500 });
  }
}