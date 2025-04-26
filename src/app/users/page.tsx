'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  User, UserPlus, Filter, Search, Mail, 
  Shield, UserX, Edit, Trash2, 
  MoreHorizontal, CheckCircle, XCircle, UserCog
} from 'lucide-react';
import { toast } from 'react-toastify';

// Mock data người dùng
const roles = ['admin', 'manager', 'editor', 'viewer'];
const statuses = ['active', 'inactive', 'pending'];

const mockUsers = Array(25).fill(null).map((_, index) => {
  const firstName = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi'][Math.floor(Math.random() * 10)];
  const lastName = ['An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Huy', 'Khoa', 'Long', 'Minh', 'Nam', 'Phong', 'Quân', 'Thắng', 'Tuấn', 'Việt'][Math.floor(Math.random() * 15)];
  const name = `${firstName} ${lastName}`;
  const email = `${lastName.toLowerCase()}.${firstName.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`;
  const role = roles[Math.floor(Math.random() * roles.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const lastActive = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
  
  return {
    id: `USR${10000 + index}`,
    name,
    email,
    role,
    status,
    lastActive,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000),
    permissions: {
      canManageUsers: role === 'admin',
      canManageSettings: role === 'admin' || role === 'manager',
      canEditContent: role === 'admin' || role === 'manager' || role === 'editor',
      canViewContent: true,
    }
  };
});

// Format date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export default function UsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    status: '',
  });

  // Load dữ liệu người dùng
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // Giả lập API call
        await new Promise(resolve => setTimeout(resolve, 600));
        setUsers(mockUsers);
        setFilteredUsers(mockUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Không thể tải dữ liệu người dùng');
    } finally {
      setLoading(false);
    }
  };

    fetchUsers();
  }, []);

  // Xử lý tìm kiếm và lọc
  useEffect(() => {
    const result = users.filter(user => {
      // Tìm kiếm
      const searchMatch = 
        searchTerm === '' || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Lọc theo vai trò
      const roleMatch = 
        filters.role === '' || 
        user.role === filters.role;
      
      // Lọc theo trạng thái
      const statusMatch = 
        filters.status === '' || 
        user.status === filters.status;
      
      return searchMatch && roleMatch && statusMatch;
    });
    
    setFilteredUsers(result);
    setCurrentPage(1); // Reset về trang đầu khi lọc
  }, [searchTerm, filters, users]);

  // Xử lý phân trang
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Điều hướng phân trang
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  // Xử lý xóa người dùng
  const handleDeleteUser = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) {
      toast.success(`Đã xóa người dùng ${id}`);
      setUsers(prev => prev.filter(user => user.id !== id));
    }
  };

  // Xử lý thay đổi trạng thái người dùng
  const handleToggleUserStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    toast.info(`Đã thay đổi trạng thái người dùng ${id} thành ${newStatus === 'active' ? 'Hoạt động' : 'Vô hiệu hóa'}`);
    
    setUsers(prev => prev.map(user => 
      user.id === id 
        ? { ...user, status: newStatus }
        : user
    ));
  };

  // Hiển thị trạng thái người dùng
  const renderUserStatus = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Hoạt động
          </span>
        );
      case 'inactive':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
            Vô hiệu hóa
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
            Chờ xác nhận
          </span>
        );
      default:
        return null;
    }
  };

  // Hiển thị vai trò người dùng
  const renderUserRole = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            <Shield className="w-3 h-3 mr-1" />
            Quản trị viên
          </span>
        );
      case 'manager':
        return (
          <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            <UserCog className="w-3 h-3 mr-1" />
            Quản lý
          </span>
        );
      case 'editor':
        return (
          <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
            <Edit className="w-3 h-3 mr-1" />
            Biên tập viên
          </span>
        );
      case 'viewer':
        return (
          <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
            <User className="w-3 h-3 mr-1" />
            Người xem
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Quản lý người dùng" 
          description="Quản lý và phân quyền người dùng hệ thống"
          actions={
            <div className="flex gap-3">
          <button
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => router.push('/users/add')}
          >
                <UserPlus className="w-4 h-4" />
            Thêm người dùng
          </button>
        </div>
          }
        />
        
        {/* Bộ lọc và tìm kiếm */}
        <Card className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4 p-4">
            <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg px-3 border border-gray-200 dark:border-gray-700">
              <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                placeholder="Tìm kiếm theo tên, email, ID..."
                className="py-2 px-3 bg-transparent w-full focus:outline-none text-gray-700 dark:text-gray-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex flex-wrap gap-4">
                <select
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">Tất cả vai trò</option>
                <option value="admin">Quản trị viên</option>
                <option value="manager">Quản lý</option>
                <option value="editor">Biên tập viên</option>
                <option value="viewer">Người xem</option>
              </select>
              
              <select
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Vô hiệu hóa</option>
                <option value="pending">Chờ xác nhận</option>
              </select>
              
              <select
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value="10">10 mỗi trang</option>
                <option value="20">20 mỗi trang</option>
                <option value="50">50 mỗi trang</option>
                </select>
              
              <button
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ role: '', status: '' });
                }}
              >
                <Filter className="w-4 h-4" />
                Đặt lại bộ lọc
              </button>
            </div>
          </div>
        </Card>
        
        {/* Bảng người dùng */}
        <Card loading={loading}>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Người dùng
                    </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Vai trò
                    </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ngày tạo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hoạt động gần nhất
                    </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  // Skeleton loading
                  Array(5).fill(null).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="ml-4">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : currentItems.length > 0 ? (
                  currentItems.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-medium">
                            {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.id}
                            </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Mail className="w-4 h-4 mr-2 opacity-70" />
                          {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        {renderUserRole(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderUserStatus(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(user.createdAt)}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(user.lastActive)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                            <button 
                            onClick={() => router.push(`/users/edit/${user.id}`)}
                            className="text-gray-600 hover:text-accent-600 dark:text-gray-400 dark:hover:text-accent-500"
                              title="Chỉnh sửa"
                            >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleUserStatus(user.id, user.status)}
                            className={`${
                              user.status === 'active'
                                ? 'text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500'
                                : 'text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-500'
                            }`}
                            title={user.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          >
                            {user.status === 'active' ? <UserX className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                            className="text-gray-600 hover:text-danger-600 dark:text-gray-400 dark:hover:text-danger-500"
                              title="Xóa"
                            >
                            <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <User className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-1">Không tìm thấy người dùng nào</p>
                        <p className="text-sm">Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác</p>
                      </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
      </div>

          {/* Phân trang */}
          {!loading && filteredUsers.length > 0 && (
            <div className="px-6 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Hiển thị {indexOfFirstItem + 1} đến {Math.min(indexOfLastItem, filteredUsers.length)} của {filteredUsers.length} người dùng
              </div>
                <div className="flex items-center space-x-2">
                <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === 1
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Trước
                </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                    // Hiển thị tối đa 5 nút phân trang
                    let pageNum;
                    if (totalPages <= 5) {
                      // Nếu có ít hơn 5 trang, hiển thị tất cả
                      pageNum = index + 1;
                    } else if (currentPage <= 3) {
                      // Nếu đang ở gần đầu
                      pageNum = index + 1;
                    } else if (currentPage >= totalPages - 2) {
                      // Nếu đang ở gần cuối
                      pageNum = totalPages - 4 + index;
                    } else {
                      // Ở giữa
                      pageNum = currentPage - 2 + index;
                    }
                    
                    return (
                <button
                        key={index}
                        onClick={() => paginate(pageNum)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNum}
                </button>
                    );
                  })}
                  
                <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === totalPages
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Tiếp
                </button>
              </div>
          </div>
        </div>
      )}
        </Card>
      </PageContainer>
    </Layout>
  );
} 