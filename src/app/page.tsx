'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Chuyển hướng người dùng đến trang sản phẩm hoặc đăng nhập
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/products');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-dark-bg">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Hệ thống đồng bộ Shopify - Nhanh.vn</h1>
        <p className="text-lg mb-6">Đang chuyển hướng...</p>
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    </main>
  );
}
