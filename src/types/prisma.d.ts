declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $transaction<R>(fn: (prisma: PrismaClient) => Promise<R>): Promise<R>;
    
    // Khai báo các mô hình theo schema của bạn
    productMapping: {
      count(options?: any): Promise<number>;
      findUnique(options?: any): Promise<any>;
      findMany(options?: any): Promise<any[]>;
      create(options?: any): Promise<any>;
      update(options?: any): Promise<any>;
      delete(options?: any): Promise<any>;
      upsert(options?: any): Promise<any>;
    };
    
    syncLog: {
      create(options?: any): Promise<any>;
      findMany(options?: any): Promise<any[]>;
      findUnique(options?: any): Promise<any>;
      update(options?: any): Promise<any>;
    };
    
    setting: {
      findMany(options?: any): Promise<any[]>;
    };
  }
} 