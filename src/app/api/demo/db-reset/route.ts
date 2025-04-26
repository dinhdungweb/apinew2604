import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';

const execPromise = promisify(exec);

// Định nghĩa kiểu cho kết quả thực thi
interface ExecResult {
  stdout: string;
  stderr: string;
  error?: any;
}

// Chạy lệnh một cách an toàn, bắt lỗi nếu có
async function safeExec(command: string): Promise<ExecResult> {
  try {
    return await execPromise(command);
  } catch (err: any) {
    // Trả về lỗi trong định dạng tương tự kết quả thành công
    return {
      stdout: '',
      stderr: err.message || 'Lỗi không xác định',
      error: err
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    // Lưu thời gian bắt đầu
    const startTime = new Date();
    
    // Tạo file marker để restart server
    const restartFile = path.join(process.cwd(), '.restart-needed');
    await fs.writeFile(restartFile, startTime.toISOString());
    
    // Xóa dữ liệu từ các bảng theo thứ tự để tránh lỗi khóa ngoại
    let dbResetResult;
    try {
      // Vô hiệu hóa khóa ngoại tạm thời nếu có thể
      try {
        await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`;
      } catch (err) {
        console.warn("Không thể vô hiệu hóa kiểm tra khóa ngoại, tiếp tục xóa theo thứ tự");
      }
      
      // Xóa dữ liệu theo thứ tự
      await prisma.syncLog.deleteMany();
      await prisma.productMapping.deleteMany();
      await prisma.setting.deleteMany();
      await prisma.user.deleteMany();
      
      // Bật lại kiểm tra khóa ngoại
      try {
        await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`;
      } catch (err) {
        console.warn("Không thể bật lại kiểm tra khóa ngoại, nhưng dữ liệu đã được xóa");
      }
      
      dbResetResult = { stdout: "Đã xóa tất cả dữ liệu thành công", stderr: "", error: null };
    } catch (err: any) {
      console.warn("Lỗi khi xóa dữ liệu:", err.message);
      dbResetResult = { 
        stdout: "", 
        stderr: `Lỗi xóa dữ liệu: ${err.message}`, 
        error: err 
      };
    }
    
    // Chạy lệnh Prisma DB push để cập nhật database theo schema mới
    const dbPushResult = await safeExec('npx prisma db push');
    
    // Chạy lệnh Prisma generate để cập nhật Prisma Client
    const generateResult = await safeExec('npx prisma generate');
    
    // Tính thời gian thực hiện
    const executionTime = new Date().getTime() - startTime.getTime();
    
    return NextResponse.json({
      success: !dbPushResult.error && !generateResult.error,
      message: 'Đã cập nhật database và Prisma client',
      note: 'Vui lòng khởi động lại server Next.js để áp dụng các thay đổi',
      executionTime: `${executionTime/1000} giây`,
      details: {
        dbReset: dbResetResult.stdout || dbResetResult.stderr,
        dbPush: dbPushResult.stdout || dbPushResult.stderr,
        generate: generateResult.stdout || generateResult.stderr,
        errors: {
          dbReset: dbResetResult.error ? dbResetResult.stderr : null,
          dbPush: dbPushResult.error ? dbPushResult.stderr : null,
          generate: generateResult.error ? generateResult.stderr : null
        }
      }
    });
  } catch (error: any) {
    console.error('Error resetting database:', error);
    return NextResponse.json({
      success: false,
      message: `Lỗi: ${error.message}`,
      details: error.stderr || error.stdout || 'Lỗi không xác định'
    }, { status: 500 });
  }
} 