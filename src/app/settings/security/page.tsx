'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Shield, Save, Key, RefreshCw, User, Lock, EyeOff, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import { FiUserCheck, FiSave, FiKey } from 'react-icons/fi';
import { updateUser } from '../../dashboard/sync-api';

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userAgent, setUserAgent] = useState('');

  // Lấy thông tin userAgent khi component được mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator) {
      setUserAgent(navigator.userAgent);
    }
  }, []);

  // Xử lý đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Kiểm tra mật khẩu
    if (!currentPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    
    if (!newPassword) {
      toast.error('Vui lòng nhập mật khẩu mới');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    
    try {
      setLoading(true);
      
      // Lấy thông tin người dùng từ cookie
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (!user.id) {
        toast.error('Không tìm thấy thông tin người dùng');
        return;
      }
      
      // Gọi API đổi mật khẩu
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: user.id,
          password: newPassword,
          oldPassword: currentPassword // Gửi mật khẩu hiện tại để xác thực
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Đổi mật khẩu thành công');
        // Xóa form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Không thể đổi mật khẩu');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Shield className="h-7 w-7 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-slate-800">Cài đặt bảo mật</h1>
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-lg font-medium text-slate-800 mb-4 flex items-center">
              <FiKey className="text-slate-600 mr-2" size={20} />
              Đổi mật khẩu
            </h2>
            
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      required
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu mới</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    required
                    minLength={6}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Xác nhận mật khẩu mới</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2" />
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-lg font-medium text-slate-800 mb-4 flex items-center">
              <FiUserCheck className="text-slate-600 mr-2" size={20} />
              Phiên đăng nhập
            </h2>
            
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-slate-700">Thiết bị hiện tại</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {userAgent || 'Đang tải thông tin thiết bị...'}
                  </p>
                </div>
                <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Hoạt động
                </div>
              </div>
            </div>
            
            <button 
              className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200 flex items-center justify-center"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
} 