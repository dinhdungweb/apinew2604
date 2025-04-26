import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma Client để sử dụng trong toàn bộ ứng dụng
// Chỉ tạo một instance duy nhất để tối ưu performance

// Khai báo các phương thức mở rộng
declare global {
  var prisma: PrismaClient;
}

// Tạo client với cấu hình phù hợp
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
};

// Đảm bảo chỉ có một instance duy nhất
const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Khai báo các phương thức mở rộng
const extendedClient = prisma as PrismaClient & {
  $queryRaw: any;
  $executeRaw: any;
  $transaction: any;
  setting: any;
  productMapping: any;
  syncLog: any;
  user: any;
};

export default extendedClient; 