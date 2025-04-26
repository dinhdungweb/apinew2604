import { jwtVerify, JWTPayload } from 'jose';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Thêm type definition rõ ràng cho JWT payload
export interface JwtPayload {
  username: string;
  role: string;
  userId: number;
  iat?: number;
  exp?: number;
}

// Định nghĩa kiểu trả về cho verifyJwtToken
export interface VerifyResult {
  success: boolean;
  payload: JwtPayload | null;
  error?: string;
}

/**
 * Xác thực JWT token và trả về payload
 */
export async function verifyJwtToken(token: string): Promise<VerifyResult> {
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256']
    });
    
    // Kiểm tra và chuyển đổi kiểu an toàn
    const jwtPayload = payload as unknown as JwtPayload;
    
    return {
      success: true,
      payload: jwtPayload
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return {
      success: false,
      payload: null,
      error: error instanceof Error ? error.message : 'An error occurred'
    };
  }
}

/**
 * Xác thực API request sử dụng Bearer token
 */
export async function verifyAuth(req: NextRequest, requiredRole?: string) {
  // Lấy Authorization header
  const authorization = req.headers.get('Authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Thiếu token xác thực',
      userId: null,
      username: null,
      role: null
    };
  }
  
  // Lấy token từ header
  const token = authorization.substring(7);
  const verifyResult = await verifyJwtToken(token);
  
  if (!verifyResult.success || !verifyResult.payload) {
    return {
      authenticated: false,
      error: verifyResult.error || 'Token không hợp lệ',
      userId: null,
      username: null,
      role: null
    };
  }
  
  // Kiểm tra quyền nếu cần
  if (requiredRole && verifyResult.payload.role !== requiredRole && verifyResult.payload.role !== 'admin') {
    return {
      authenticated: false,
      error: 'Không đủ quyền truy cập',
      userId: verifyResult.payload.userId,
      username: verifyResult.payload.username,
      role: verifyResult.payload.role
    };
  }
  
  // Xác thực thành công
  return {
    authenticated: true,
    userId: verifyResult.payload.userId,
    username: verifyResult.payload.username,
    role: verifyResult.payload.role
  };
}

/**
 * Kiểm tra quyền admin
 */
export function isAdmin(payload: JWTPayload): boolean {
  return payload && payload.role === 'admin';
}

/**
 * Kiểm tra token có thuộc user không
 */
export function isOwnUser(payload: JWTPayload, userId: string | number): boolean {
  return payload && (
    payload.userId === userId || 
    payload.role === 'admin'
  );
} 