'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAppContext } from '@/context/AppContext';
import Cookies from 'js-cookie';
import { LogIn, User, Lock, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { token, setToken, setUser } = useAppContext();

  useEffect(() => {
    // If already logged in, redirect to products page
    if (token) {
      router.push('/products');
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Lưu token vào localStorage và cookie
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        
        // Đặt cookie cho middleware
        Cookies.set('token', data.token, { expires: 1 }); // Hết hạn sau 1 ngày

        // Update context
        setToken(data.token);
        setUser({ username, role: data.role });

        toast.success('Đăng nhập thành công!');
        router.push('/products');
      } else {
        toast.error(data.message || 'Đăng nhập thất bại');
      }
    } catch (error) {
      toast.error('Lỗi kết nối đến server');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      {/* Left side - Illustration */}
      <div className="hidden md:flex md:w-1/2 bg-blue-600 text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800 opacity-90"></div>
        <div className="relative z-10 max-w-md text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/10 p-4 rounded-full">
              <LogIn size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-6">SyncHub</h1>
          <p className="text-xl mb-8">Hệ thống quản lý và đồng bộ dữ liệu giữa Shopify và Nhanh.vn</p>
          <div className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 p-2 rounded-full">
                <ArrowRight size={20} />
              </div>
              <p className="text-left">Đồng bộ dữ liệu sản phẩm tự động</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 p-2 rounded-full">
                <ArrowRight size={20} />
              </div>
              <p className="text-left">Quản lý đơn hàng hiệu quả</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 p-2 rounded-full">
                <ArrowRight size={20} />
              </div>
              <p className="text-left">Báo cáo chi tiết và trực quan</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-blue-500 rounded-full opacity-20"></div>
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-500 rounded-full opacity-20"></div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-10">
            <div className="text-center mb-10">
              <h1 className="flex justify-center text-3xl font-bold text-slate-800 dark:text-white mb-2">
                <span className="text-blue-600 mr-1">Sync</span>
                <span>Hub</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400">Hệ thống đồng bộ Shopify - Nhanh.vn</p>
            </div>
            
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-white mb-8">
              Đăng nhập
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-blue-500" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                    placeholder="Tên đăng nhập của bạn"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-blue-500" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                    placeholder="Mật khẩu của bạn"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <LogIn className="w-5 h-5 mr-2" />
                      Đăng nhập
                    </span>
                  )}
                </button>
              </div>
            </form>
            
            <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                © 2024 SyncHub. Mọi quyền được bảo lưu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 