'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { useAppContext } from '@/context/AppContext';
import { 
  CheckCircle, AlertCircle, Search, RefreshCw, Loader, 
  Filter, Download, Upload, Trash2, Info, EyeIcon, Clock,
  ArrowUpDown, ChevronDown, ChevronRight, Settings, BarChart, Package, DollarSign, Trash
} from 'lucide-react';
import Image from 'next/image';

// Định nghĩa kiểu dữ liệu
interface ShopifyProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  inventory?: number;
  inventory_item_id?: string;
  image?: string | null;
  variants?: {
    title: string;
    inventory_quantity?: number;
  }[];
}

interface NhanhProduct {
  idNhanh: string;
  name: string;
  code: string;
  inventory?: number;
}

interface MappedProduct {
  shopifyId: string;
  nhanhId: string;
  name: string;
}

interface SyncLog {
  shopifyId: string;
  nhanhId: string;
  timestamp: string;
  status: 'success' | 'error';
  message: string;
}

interface PaginationInfo {
  show_all: boolean;
  total_products: number;
}

interface InventoryDetail {
  totalRemain: number;
  locations: {
    name: string;
    remain: number;
    availableToSell: number;
  }[];
  history: {
    date: string;
    action: string;
    quantity: number;
    note: string;
  }[];
}

// Định nghĩa interface cho props của ProductTable
interface ProductTableProps {
  products: ShopifyProduct[];
  loading: boolean;
  mappedProducts: Record<string, NhanhProduct>;
  syncStatus: Record<string, string>;
  syncErrors: Record<string, string>;
  viewMode?: 'table' | 'grid' | 'card';
  searchTerm?: string;
  filterStatus?: string;
  onSort?: (field: string) => void;
  currentSort?: {
    field: string;
    order: string;
  };
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

const ProductTable: React.FC<ProductTableProps> = ({ 
  products: initialProducts, 
  loading, 
  mappedProducts: initialMappedProducts, 
  syncStatus: initialSyncStatus, 
  syncErrors: initialSyncErrors,
  viewMode = 'table',
  searchTerm: externalSearchTerm,
  filterStatus: externalFilterStatus = 'all',
  onSort,
  currentSort,
  pagination: externalPagination
}) => {
  const { token, user, logout } = useAppContext();
  const router = useRouter();
  
  // State
  const [products, setProducts] = useState<ShopifyProduct[]>(initialProducts || []);
  const [mappedProducts, setMappedProducts] = useState<Record<string, NhanhProduct>>(initialMappedProducts || {});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [nhanhProducts, setNhanhProducts] = useState<Record<string, NhanhProduct[]>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>(initialSyncStatus || {});
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>(initialSyncErrors || {});
  const [filterStatus, setFilterStatus] = useState<string>(externalFilterStatus);
  const [isLoading, setIsLoading] = useState<boolean>(loading);
  const [pagination, setPagination] = useState<PaginationInfo & {
    current_page?: number;
    total_pages?: number;
    page_size?: number;
  }>({
    show_all: false, 
    total_products: 0,
    current_page: 1,
    total_pages: 1,
    page_size: 20
  });
  const [inventoryDetail, setInventoryDetail] = useState<InventoryDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [currentNhanhId, setCurrentNhanhId] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [searchingIds, setSearchingIds] = useState<string[]>([]);
  const [noResultsIds, setNoResultsIds] = useState<string[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const [visibleSearchResults, setVisibleSearchResults] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Refs for search components
  const searchContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Thêm hàm để lưu ref cho container tìm kiếm
  const setSearchContainerRef = (shopifyId: string, el: HTMLDivElement | null) => {
    searchContainerRefs.current[shopifyId] = el;
  };
  
  // Update state when props change
  useEffect(() => {
    setProducts(initialProducts || []);
    setFilteredProducts(initialProducts || []);
    setMappedProducts(initialMappedProducts || {});
    setSyncStatus(initialSyncStatus || {});
    setSyncErrors(initialSyncErrors || {});
    setIsLoading(loading);
  }, [initialProducts, loading, initialMappedProducts, initialSyncStatus, initialSyncErrors]);
  
  // Fetch data with pagination
  const fetchData = useCallback(async (page: number = 1) => {
    console.log('Bắt đầu fetchData với token =', !!token, 'trang =', page);
    if (!token) return;
    
    setIsLoading(true);
    try {
      // Lấy tất cả sản phẩm với phân trang
      const apiUrl = `/api/products?filter=${filterStatus}&page=${page}&pageSize=20`;
      
      console.log('Fetching data from:', apiUrl);
      
      // Lấy dữ liệu sản phẩm
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Phiên đăng nhập hết hạn');
          logout();
          router.push('/login');
          return;
        }
        throw new Error('Lỗi khi tải dữ liệu sản phẩm');
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      // Cập nhật state
      setProducts(data.products || []);
      setFilteredProducts(data.products || []);
      setPagination(data.pagination);
      setCurrentPage(data.pagination.current_page || 1);
      
      // Lấy dữ liệu mapping
      console.log('Bắt đầu lấy dữ liệu mapping');
      const mappingsResponse = await fetch('/api/products/mapping', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (mappingsResponse.ok) {
        const mappingsData = await mappingsResponse.json();
        console.log('Dữ liệu mapping nhận được:', mappingsData);
        
        // Chuyển đổi ID sang chuỗi để đảm bảo định dạng đồng nhất
        const formattedMappings: Record<string, any> = {};
        if (mappingsData.mappings) {
          Object.keys(mappingsData.mappings).forEach(key => {
            formattedMappings[String(key)] = mappingsData.mappings[key];
          });
        }
        
        setMappedProducts(formattedMappings);
        console.log('Đã cập nhật mappedProducts:', formattedMappings);
        
        // Cập nhật trạng thái
        if (mappingsData.status) {
          setSyncStatus(mappingsData.status);
        }
        
        // Cập nhật lỗi
        if (mappingsData.errors) {
          setSyncErrors(mappingsData.errors);
        }
      } else {
        console.error('Lỗi khi lấy dữ liệu mapping:', await mappingsResponse.text());
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Không thể tải dữ liệu sản phẩm');
    } finally {
      setIsLoading(false);
    }
  }, [token, filterStatus, logout, router]);
  
  useEffect(() => {
    fetchData(currentPage);
  }, [fetchData, currentPage]);

  // Tính năng lọc sản phẩm
  useEffect(() => {
    if (products.length === 0) return;
    
    // Lọc sản phẩm theo trạng thái
    let filtered = [...products];
    
    if (filterStatus === 'mapped') {
      filtered = filtered.filter(product => !!mappedProducts[product.id]);
    } else if (filterStatus === 'unmapped') {
      filtered = filtered.filter(product => !mappedProducts[product.id]);
    }
    
    setFilteredProducts(filtered);
  }, [products, mappedProducts, filterStatus]);
  
  // Tìm kiếm sản phẩm Nhanh.vn - Sử dụng debouncedSearch thay vì handleSearch
  const debouncedSearch = useCallback(
    debounce((shopifyId: string, query: string) => {
      // Nếu query quá ngắn thì không tìm kiếm
      if (!query.trim() || query.length < 2) {
        setNhanhProducts(prev => ({ ...prev, [shopifyId]: [] }));
        setNoResultsIds(prev => prev.filter(id => id !== shopifyId));
        setSearchingIds(prev => prev.filter(id => id !== shopifyId));
        return;
      }
      
      // Bắt đầu tìm kiếm, thiết lập trạng thái
      setSearchingIds(prev => [...prev.filter(id => id !== shopifyId), shopifyId]);
      setNoResultsIds(prev => prev.filter(id => id !== shopifyId));
      
      console.log('Đang tìm kiếm sản phẩm Nhanh với từ khóa:', query);
      
      fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query })
      })
        .then(res => res.json())
        .then(data => {
          console.log('Kết quả tìm kiếm Nhanh:', data);
          setSearchingIds(prev => prev.filter(id => id !== shopifyId));
          
          // Kiểm tra kết quả và cập nhật trạng thái
          if (!data.products || data.products.length === 0) {
            setNoResultsIds(prev => [...prev.filter(id => id !== shopifyId), shopifyId]);
            setNhanhProducts(prev => ({
              ...prev,
              [shopifyId]: []
            }));
          } else {
            setNoResultsIds(prev => prev.filter(id => id !== shopifyId));
            setNhanhProducts(prev => ({
              ...prev,
              [shopifyId]: data.products || []
            }));
            // Hiển thị kết quả tìm kiếm khi có dữ liệu
            setVisibleSearchResults(prev => ({...prev, [shopifyId]: true}));
          }
        })
        .catch(err => {
          console.error('Error searching products:', err);
          setSearchingIds(prev => prev.filter(id => id !== shopifyId));
          setNoResultsIds(prev => [...prev.filter(id => id !== shopifyId), shopifyId]);
        });
    }, 500),
    [token]
  );
  
  // Định nghĩa hàm handleSearch thiếu
  const handleSearch = (shopifyId: string) => {
    // Kiểm tra nếu sản phẩm đã đồng bộ thành công thì không cho tìm kiếm
    if (syncStatus[shopifyId] === 'success') {
      return;
    }
    
    const query = searchQueries[shopifyId] || '';
    debouncedSearch(shopifyId, query);
  };
  
  // Thêm lại hàm handleInputChange bị mất
  const handleInputChange = (shopifyId: string, value: string) => {
    // Kiểm tra nếu sản phẩm đã đồng bộ thành công thì không xử lý thay đổi input
    if (syncStatus[shopifyId] === 'success') {
      return;
    }
    
    setSearchQueries(prev => ({
      ...prev,
      [shopifyId]: value
    }));
    
    // Xóa các kết quả cũ khi người dùng thay đổi truy vấn
    if (value.trim().length < 2) {
      setNhanhProducts(prev => ({ ...prev, [shopifyId]: [] }));
      setNoResultsIds(prev => prev.filter(id => id !== shopifyId));
    } else {
      // Đảm bảo kết quả tìm kiếm hiển thị khi người dùng gõ
      setVisibleSearchResults(prev => ({...prev, [shopifyId]: true}));
    }
    
    debouncedSearch(shopifyId, value);
  };
  
  // Map product
  const handleSelectProduct = async (shopifyId: string, nhanhProduct: NhanhProduct) => {
    try {
      console.log('Bắt đầu quá trình mapping với:', { shopifyId, nhanhProduct });
      
      // Chuyển đổi shopifyId thành chuỗi để đảm bảo định dạng đồng nhất
      const stringShopifyId = String(shopifyId);
      console.log('stringShopifyId:', stringShopifyId);
      
      // Hiển thị toast thông báo đang xử lý
      toast.info("Đang xử lý mapping...");
      
      // Set loading state
      setLoadingIds(prev => [...prev, stringShopifyId]);
      
      const response = await fetch('/api/products/mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          shopifyId: stringShopifyId, 
          nhanhProduct,
          status: 'pending'
        })
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Phản hồi từ API mapping:', responseData);
        toast.success(`Đã map sản phẩm với ${nhanhProduct.name}`);
        
        // Cập nhật state mappedProducts với ID dạng chuỗi
        setMappedProducts(prev => {
          const newMappings = { ...prev };
          newMappings[stringShopifyId] = nhanhProduct;
          console.log('mappedProducts sau khi cập nhật:', newMappings);
          return newMappings;
        });
        
        // Cập nhật trạng thái sang pending (chưa đồng bộ)
        setSyncStatus(prev => ({
          ...prev,
          [stringShopifyId]: 'pending'
        }));
        
        setNhanhProducts(prev => ({
          ...prev,
          [stringShopifyId]: []
        }));
        
        setSearchQueries(prev => ({
          ...prev,
          [stringShopifyId]: ''
        }));
        
        // Tìm thông tin sản phẩm để đồng bộ tồn kho
        const product = products.find(p => p.id === stringShopifyId);
        console.log('Thông tin sản phẩm tìm thấy:', product);
        
        if (product) {
          // Tách riêng xử lý đồng bộ tồn kho sau khi mapping thành công
          setTimeout(() => {
            syncInventoryAfterMapping(stringShopifyId, nhanhProduct, product);
          }, 500); // Đợi một chút để đảm bảo mapping đã được lưu trong cơ sở dữ liệu
        } else {
          console.error('Không tìm thấy thông tin sản phẩm để đồng bộ');
          toast.warning("Đã map sản phẩm, nhưng không thể đồng bộ do thiếu thông tin");
        }
      } else {
        const errorData = await response.json();
        console.error('Lỗi khi tạo mapping:', errorData);
        toast.error(`Không thể tạo mapping: ${errorData.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Error mapping product:', error);
      toast.error('Lỗi khi tạo mapping');
    } finally {
      // Remove loading state
      setLoadingIds(prev => prev.filter(id => id !== shopifyId));
    }
  };
  
  // Hàm riêng để đồng bộ tồn kho sau khi mapping thành công
  const syncInventoryAfterMapping = async (shopifyId: string, nhanhProduct: NhanhProduct, product: ShopifyProduct) => {
    try {
      toast.info("Đang đồng bộ tồn kho...");
      
      // Tạo yêu cầu đồng bộ
      const inventoryItemId = product.inventory_item_id || '';
      const syncData = { 
        shopifyId: shopifyId, 
        nhanhId: nhanhProduct.idNhanh,
        inventoryItemId
      };
      
      console.log('Đang gửi yêu cầu đồng bộ với dữ liệu:', syncData);
      
      const inventoryResponse = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(syncData)
      });
      
      const inventoryData = await inventoryResponse.json();
      console.log('Kết quả đồng bộ tồn kho:', inventoryData);
      
      if (inventoryResponse.ok && inventoryData.success) {
        toast.success(`Đồng bộ tồn kho thành công: ${inventoryData.message || 'Thành công'}`);
        
        // Cập nhật trạng thái trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'success',
            errorMsg: null
          })
        });
        
        // Cập nhật state
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'success'
        }));
        
        // Cập nhật số lượng hiển thị nếu có
        if (inventoryData.inventory && inventoryData.inventory.quantity !== undefined) {
          console.log(`Cập nhật số lượng hiển thị thành: ${inventoryData.inventory.quantity}`);
          setInventoryCounts(prev => ({
            ...prev,
            [shopifyId]: inventoryData.inventory.quantity
          }));
        }
      } else {
        console.error('Lỗi đồng bộ tồn kho:', inventoryData);
        
        const errorMsg = inventoryData.message || 'Không xác định';
        
        // Cập nhật trạng thái lỗi trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: errorMsg
          })
        });
        
        toast.error(`Lỗi đồng bộ: ${errorMsg}`);
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'error'
        }));
        
        // Cập nhật thông báo lỗi nếu có
        if (inventoryData.message) {
          setSyncErrors(prev => ({
            ...prev,
            [shopifyId]: inventoryData.message
          }));
        }
      }
    } catch (syncError) {
      console.error("Lỗi đồng bộ tồn kho:", syncError);
      
      // Cập nhật trạng thái lỗi trong database
      try {
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: 'Lỗi xử lý đồng bộ tồn kho'
          })
        });
      } catch (e) {
        console.error('Không thể cập nhật trạng thái lỗi:', e);
      }
      
      toast.error("Đã map sản phẩm, nhưng đồng bộ tồn kho thất bại");
      // Mặc dù lỗi đồng bộ, vẫn giữ mapping
      setSyncStatus(prev => ({
        ...prev,
        [shopifyId]: 'error'
      }));
      
      // Cập nhật thông báo lỗi
      setSyncErrors(prev => ({
        ...prev,
        [shopifyId]: 'Lỗi xử lý đồng bộ tồn kho'
      }));
    }
  };
  
  // Unmap product
  const handleUnmapProduct = async (shopifyId: string) => {
    try {
      console.log(`Bắt đầu quá trình hủy mapping với shopifyId: ${shopifyId}`);
      
      const response = await fetch(`/api/products/mapping?shopifyId=${shopifyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const responseData = await response.json();
      console.log('Phản hồi từ API hủy mapping:', responseData);
      
      if (response.ok) {
        toast.info(`Đã hủy mapping cho sản phẩm ${shopifyId}`);
        setMappedProducts(prev => {
          const newMap = { ...prev };
          delete newMap[shopifyId];
          return newMap;
        });
        
        // Xóa trạng thái đồng bộ khi hủy mapping
        setSyncStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[shopifyId];
          return newStatus;
        });
        
        // Xóa thông báo lỗi nếu có
        setSyncErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[shopifyId];
          return newErrors;
        });
      } else {
        console.error('Lỗi khi hủy mapping:', responseData);
        toast.error(`Không thể xóa mapping: ${responseData.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Error unmapping product:', error);
      toast.error('Lỗi khi xóa mapping');
    }
  };
  
  // Sync inventory
  const handleSyncInventory = async (shopifyId: string) => {
    console.log('handleSyncInventory được gọi với shopifyId:', shopifyId);
    console.log('mappedProducts hiện tại:', mappedProducts);
    console.log('Kiểm tra xem shopifyId có trong mappedProducts:', shopifyId in mappedProducts);
    
    // Kiểm tra các key trong mappedProducts
    const keys = Object.keys(mappedProducts);
    console.log('Các key hiện có trong mappedProducts:', keys);
    
    // So sánh loại dữ liệu
    if (keys.length > 0) {
      console.log('Kiểu dữ liệu của key đầu tiên:', typeof keys[0]);
      console.log('Kiểu dữ liệu của shopifyId:', typeof shopifyId);
    }
    
    if (!mappedProducts[shopifyId]) {
      console.error(`Không thể đồng bộ: Không tìm thấy mapping cho sản phẩm ${shopifyId}`);
      
      // Kiểm tra xem có mapping nào phù hợp với gid format không
      const numericalShopifyId = shopifyId.replace(/\D/g, '');
      console.log('Thử tìm với ID số:', numericalShopifyId);
      
      if (mappedProducts[numericalShopifyId]) {
        console.log('Đã tìm thấy mapping với ID số, sử dụng ID này để đồng bộ');
        // Sử dụng ID số để đồng bộ
        return handleSyncInventory(numericalShopifyId);
      }
      
      toast.error("Không thể đồng bộ: Sản phẩm chưa được mapping");
      return;
    }
    
    console.log('Thông tin mapping từ mappedProducts:', mappedProducts[shopifyId]);
    console.log('idNhanh từ mapping:', mappedProducts[shopifyId].idNhanh);
    
    // Nếu đang loading, không thực hiện lại
    if (loadingIds.includes(shopifyId)) return;
    
    try {
      setLoadingIds(prev => [...prev, shopifyId]);
      
      const product = products.find(p => p.id === shopifyId);
      const inventoryItemId = product?.inventory_item_id || '';
      
      // Tạo yêu cầu đồng bộ
      const syncData = { 
        shopifyId, 
        nhanhId: mappedProducts[shopifyId].idNhanh,
        inventoryItemId
      };
      
      console.log('Đang gửi yêu cầu đồng bộ với dữ liệu:', syncData);
      
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(syncData)
      });
      
      const data = await response.json();
      console.log('Kết quả đồng bộ tồn kho:', data);
      
      if (response.ok && data.success) {
        toast.success(`Đã đồng bộ tồn kho: ${data.message || 'Thành công'}`);
        
        // Cập nhật trạng thái trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'success',
            errorMsg: null
          })
        });
        
        // Cập nhật state
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'success'
        }));
        
        // Cập nhật số lượng hiển thị nếu có
        if (data.inventory && data.inventory.quantity !== undefined) {
          console.log(`Cập nhật số lượng hiển thị thành: ${data.inventory.quantity}`);
          setInventoryCounts(prev => ({
            ...prev,
            [shopifyId]: data.inventory.quantity
          }));
        }
      } else {
        console.error('Lỗi đồng bộ tồn kho:', data);
        
        const errorMsg = data.message || 'Không xác định';
        
        // Cập nhật trạng thái lỗi trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: errorMsg
          })
        });
        
        toast.error(`Lỗi đồng bộ: ${errorMsg}`);
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'error'
        }));
        
        // Cập nhật thông báo lỗi nếu có
        if (data.message) {
          setSyncErrors(prev => ({
            ...prev,
            [shopifyId]: data.message
          }));
        }
      }
    } catch (error) {
      console.error('Error syncing inventory:', error);
      
      // Cập nhật trạng thái lỗi trong database
      try {
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: 'Lỗi xử lý đồng bộ tồn kho'
          })
        });
      } catch (e) {
        console.error('Không thể cập nhật trạng thái lỗi:', e);
      }
      
      toast.error('Lỗi đồng bộ tồn kho');
      setSyncStatus(prev => ({
        ...prev,
        [shopifyId]: 'error'
      }));
      
      // Cập nhật thông báo lỗi
      setSyncErrors(prev => ({
        ...prev,
        [shopifyId]: 'Lỗi xử lý đồng bộ tồn kho'
      }));
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== shopifyId));
    }
  };
  
  // Sync price
  const handleSyncPrice = async (shopifyId: string) => {
    console.log('handleSyncPrice được gọi với shopifyId:', shopifyId);
    
    if (!mappedProducts[shopifyId]) {
      console.error(`Không thể đồng bộ: Không tìm thấy mapping cho sản phẩm ${shopifyId}`);
      
      // Kiểm tra xem có mapping nào phù hợp với gid format không
      const numericalShopifyId = shopifyId.replace(/\D/g, '');
      console.log('Thử tìm với ID số:', numericalShopifyId);
      
      if (mappedProducts[numericalShopifyId]) {
        console.log('Đã tìm thấy mapping với ID số, sử dụng ID này để đồng bộ');
        // Sử dụng ID số để đồng bộ
        return handleSyncPrice(numericalShopifyId);
      }
      
      toast.error("Không thể đồng bộ: Sản phẩm chưa được mapping");
      return;
    }
    
    // Nếu đang loading, không thực hiện lại
    if (loadingIds.includes(shopifyId)) return;
    
    try {
      setLoadingIds(prev => [...prev, shopifyId]);
      
      const product = products.find(p => p.id === shopifyId);
      const variantId = product?.id || '';
      
      // Tạo yêu cầu đồng bộ
      const syncData = { 
        shopifyId, 
        nhanhId: mappedProducts[shopifyId].idNhanh,
        variantId
      };
      
      console.log('Đang gửi yêu cầu đồng bộ giá với dữ liệu:', syncData);
      
      const response = await fetch('/api/price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(syncData)
      });
      
      const data = await response.json();
      console.log('Kết quả đồng bộ giá:', data);
      
      if (response.ok && data.success) {
        toast.success(`Đã đồng bộ giá: ${data.message || 'Thành công'}`);
        
        // Cập nhật trạng thái trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'success',
            errorMsg: null
          })
        });
        
        // Cập nhật state
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'success'
        }));
      } else {
        console.error('Lỗi đồng bộ giá:', data);
        
        const errorMsg = data.message || 'Không xác định';
        
        // Cập nhật trạng thái lỗi trong database
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: errorMsg
          })
        });
        
        toast.error(`Lỗi đồng bộ: ${errorMsg}`);
        setSyncStatus(prev => ({
          ...prev,
          [shopifyId]: 'error'
        }));
        
        // Cập nhật thông báo lỗi nếu có
        if (data.message) {
          setSyncErrors(prev => ({
            ...prev,
            [shopifyId]: data.message
          }));
        }
      }
    } catch (error) {
      console.error('Error syncing price:', error);
      
      // Cập nhật trạng thái lỗi trong database
      try {
        await fetch('/api/products/mapping', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shopifyId: shopifyId,
            status: 'error',
            errorMsg: 'Lỗi xử lý đồng bộ giá'
          })
        });
      } catch (e) {
        console.error('Không thể cập nhật trạng thái lỗi:', e);
      }
      
      toast.error('Lỗi đồng bộ giá');
      setSyncStatus(prev => ({
        ...prev,
        [shopifyId]: 'error'
      }));
      
      // Cập nhật thông báo lỗi
      setSyncErrors(prev => ({
        ...prev,
        [shopifyId]: 'Lỗi xử lý đồng bộ giá'
      }));
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== shopifyId));
    }
  };
  
  // View inventory details
  const handleViewDetails = async (nhanhId: string) => {
    try {
      const response = await fetch(`/api/inventory/details?nhanhId=${nhanhId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInventoryDetail(data.inventory);
        setCurrentNhanhId(nhanhId);
        setShowDetailModal(true);
      } else {
        toast.error('Không thể lấy chi tiết tồn kho');
      }
    } catch (error) {
      console.error('Error fetching inventory details:', error);
      toast.error('Lỗi khi xem chi tiết tồn kho');
    }
  };
  
  // Filter
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value);
  };

  // Search by name or SKU
  const [searchTerm, setSearchTerm] = useState<string>(externalSearchTerm || '');
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  useEffect(() => {
    if (products.length === 0) return;
    
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      // Chỉ áp dụng bộ lọc nếu không có tìm kiếm
      let filtered = [...products];
      
      if (filterStatus === 'mapped') {
        filtered = filtered.filter(product => !!mappedProducts[product.id]);
      } else if (filterStatus === 'unmapped') {
        filtered = filtered.filter(product => !mappedProducts[product.id]);
      }
      
      setFilteredProducts(filtered);
      return;
    }
    
    // Lọc theo cả filter status và search term
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(term) || 
                           (product.sku && product.sku.toLowerCase().includes(term));
      
      if (filterStatus === 'all') return matchesSearch;
      else if (filterStatus === 'mapped') return matchesSearch && !!mappedProducts[product.id];
      else return matchesSearch && !mappedProducts[product.id];
    });
    
    setFilteredProducts(filtered);
  }, [products, mappedProducts, filterStatus, searchTerm]);
  
  // Thêm hàm để xử lý khi focus vào ô tìm kiếm
  const handleSearchFocus = (shopifyId: string) => {
    // Nếu sản phẩm đã đồng bộ thành công thì không hiển thị kết quả tìm kiếm
    if (syncStatus[shopifyId] === 'success') {
      return;
    }
    
    // Hiển thị kết quả tìm kiếm nếu có
    if (nhanhProducts[shopifyId] && nhanhProducts[shopifyId].length > 0) {
      setVisibleSearchResults(prev => ({...prev, [shopifyId]: true}));
    }
  };

  // Thêm hàm để xử lý khi click ra ngoài ô tìm kiếm
  const handleSearchBlur = (shopifyId: string) => {
    // Sử dụng setTimeout để tránh trường hợp khi click vào kết quả tìm kiếm
    // bị ẩn đi trước khi xử lý click
    setTimeout(() => {
      setVisibleSearchResults(prev => ({...prev, [shopifyId]: false}));
    }, 200);
  };
  
  // Xử lý thay đổi trang
  const handlePageChange = (newPage: number) => {
    window.scrollTo(0, 0); // Cuộn lên đầu trang
    setCurrentPage(newPage);
  };

  // Render sản phẩm (Desktop)
  const renderProducts = (view = 'desktop') => {
    if (view === 'desktop') {
      return filteredProducts.map(product => (
        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
          <td className="px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center">
              <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 bg-gray-50 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center mr-2 sm:mr-3">
                {product.image ? (
                  <Image 
                    src={product.image} 
                    alt={product.name}
                    width={40} 
                    height={40}
                    className="object-cover" 
                    loading="lazy"
                  />
                ) : (
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-0.5 sm:mb-1 line-clamp-1">{product.name}</div>
                <div className="flex flex-wrap gap-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">SKU: {product.sku || "—"}</span>
                  {product.inventory !== undefined && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Tồn: {product.inventory}</span>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="px-3 py-2 sm:px-4 sm:py-3">
            {mappedProducts[product.id] ? (
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-0.5 sm:mb-1 line-clamp-1">
                  {mappedProducts[product.id].name}
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">ID: {mappedProducts[product.id].idNhanh}</span>
                  {mappedProducts[product.id].code && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Mã: {mappedProducts[product.id].code}</span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">Chưa mapping</span>
            )}
          </td>
          <td className="px-3 py-2 sm:px-4 sm:py-3">
            {syncStatus[product.id] === 'success' && (
              <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 inline-flex text-[10px] sm:text-xs font-medium rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 items-center whitespace-nowrap">
                <CheckCircle size={12} className="mr-0.5 sm:mr-1" />
                <span className="hidden xs:inline">Đã đồng bộ</span>
                <span className="xs:hidden">OK</span>
              </span>
            )}
            {syncStatus[product.id] === 'error' && (
              <span 
                className="px-1.5 py-0.5 sm:px-2 sm:py-1 inline-flex text-[10px] sm:text-xs font-medium rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 items-center cursor-pointer whitespace-nowrap"
                onClick={() => {
                  if (syncErrors[product.id]) {
                    toast.error(`Lỗi: ${syncErrors[product.id]}`);
                  }
                }}
              >
                <AlertCircle size={12} className="mr-0.5 sm:mr-1" />
                <span className="hidden xs:inline">Lỗi đồng bộ</span>
                <span className="xs:hidden">Lỗi</span>
              </span>
            )}
            {(!syncStatus[product.id] || syncStatus[product.id] === 'pending') && (
              <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 inline-flex text-[10px] sm:text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 items-center whitespace-nowrap">
                <Clock size={12} className="mr-0.5 sm:mr-1" />
                <span className="hidden xs:inline">Chưa đồng bộ</span>
                <span className="xs:hidden">Chưa</span>
              </span>
            )}
          </td>
          <td className="px-3 py-2 sm:px-4 sm:py-3">
            <div 
              className="flex flex-col space-y-1 sm:space-y-2 relative"
              ref={(el) => setSearchContainerRef(product.id, el)}
            >
              <div className="flex space-x-1">
                <input
                  type="text"
                  className={`flex-1 px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-l text-xs sm:text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${syncStatus[product.id] === 'success' ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                  value={searchQueries[product.id] || ''}
                  onChange={(e) => handleInputChange(product.id, e.target.value)}
                  onFocus={() => handleSearchFocus(product.id)}
                  onBlur={() => handleSearchBlur(product.id)}
                  placeholder="Tên sản phẩm..."
                  disabled={syncStatus[product.id] === 'success'}
                />
                <button
                  className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-r flex items-center justify-center ${syncStatus[product.id] === 'success' ? 'bg-gray-400 dark:bg-gray-600 text-gray-100 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'} transition-colors duration-200`}
                  onClick={() => handleSearch(product.id)}
                  disabled={searchingIds.includes(product.id) || syncStatus[product.id] === 'success'}
                >
                  {searchingIds.includes(product.id) ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                </button>
              </div>
              
              {/* Danh sách kết quả tìm kiếm */}
              {nhanhProducts[product.id] && 
              nhanhProducts[product.id].length > 0 && 
              visibleSearchResults[product.id] && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 dark:border-gray-600 rounded max-h-40 sm:max-h-52 overflow-y-auto bg-white dark:bg-gray-800 z-50 shadow-md">
                  {nhanhProducts[product.id].map((nhanhProduct, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0 flex justify-between items-center transition-colors duration-150"
                      onClick={() => handleSelectProduct(product.id, nhanhProduct)}
                      onMouseDown={(e) => e.preventDefault()} // Ngăn onBlur kích hoạt trước khi click
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium dark:text-white">{nhanhProduct.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-1 mt-0.5 sm:mt-1">
                          <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">ID: {nhanhProduct.idNhanh}</span>
                          {nhanhProduct.code && <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Mã: {nhanhProduct.code}</span>}
                          {nhanhProduct.inventory !== undefined && <span className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Tồn: {nhanhProduct.inventory}</span>}
                        </div>
                      </div>
                      <div className="bg-primary-50 dark:bg-primary-900 p-1.5 sm:p-2 rounded-full ml-2 flex-shrink-0">
                        <CheckCircle size={14} className="text-primary-700 dark:text-primary-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Thông báo không có kết quả */}
              {noResultsIds.includes(product.id) && (
                <div className="mt-0.5 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <AlertCircle size={12} className="mr-0.5 sm:mr-1" />
                  <span className="hidden xs:inline">Không tìm thấy kết quả</span>
                  <span className="xs:hidden">Không tìm thấy</span>
                </div>
              )}
            </div>
          </td>
          <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-right text-xs sm:text-sm">
            <div className="flex justify-end gap-0.5 sm:gap-1">
              {mappedProducts[product.id] ? (
                <>
                  <button
                    onClick={() => handleSyncInventory(product.id)}
                    disabled={loadingIds.includes(product.id)}
                    className="p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Đồng bộ tồn kho"
                  >
                    {loadingIds.includes(product.id) ? (
                      <Loader size={12} className="sm:w-3.5 sm:h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw size={12} className="sm:w-3.5 sm:h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSyncPrice(product.id)}
                    disabled={loadingIds.includes(product.id)}
                    className="p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Đồng bộ giá"
                  >
                    {loadingIds.includes(product.id) ? (
                      <Loader size={12} className="sm:w-3.5 sm:h-3.5 animate-spin" />
                    ) : (
                      <DollarSign size={12} className="sm:w-3.5 sm:h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleViewDetails(mappedProducts[product.id].idNhanh)}
                    className="p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Xem chi tiết"
                  >
                    <EyeIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                  </button>
                  <button
                    onClick={() => handleUnmapProduct(product.id)}
                    className="p-1 sm:p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Hủy mapping"
                  >
                    <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (searchQueries[product.id] && searchQueries[product.id].length >= 2) {
                      handleSearch(product.id);
                    } else {
                      toast.info('Nhập tên sản phẩm để tìm kiếm');
                    }
                  }}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 p-1.5 sm:p-2 rounded transition-colors duration-200"
                  title="Tìm kiếm"
                >
                  <Search size={14} className="sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </td>
        </tr>
      ));
    }
    return null; // Trả về null nếu không phải desktop view
  };

  // Card view component - Enhanced with better styling
  const renderCardView = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
            <div className="relative pt-[75%] bg-gray-50">
              {product.image ? (
                <Image 
                  src={product.image} 
                  alt={product.name}
                  fill
                  className="object-contain p-4"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package size={42} className="text-gray-300" />
                </div>
              )}
              
              {/* Status badge */}
              <div className="absolute top-3 right-3">
                {syncStatus[product.id] === 'success' && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center">
                    <CheckCircle size={12} className="mr-1" />
                    Đã đồng bộ
                  </span>
                )}
                {syncStatus[product.id] === 'error' && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center">
                    <AlertCircle size={12} className="mr-1" />
                    Lỗi
                  </span>
                )}
                {(!syncStatus[product.id] || syncStatus[product.id] === 'pending') && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center">
                    <Clock size={12} className="mr-1" />
                    Chưa đồng bộ
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
                <div className="text-sm text-gray-500 mb-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    <span className="font-medium">SKU:</span>&nbsp;{product.sku || 'N/A'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    <span className="font-medium">Tồn:</span>&nbsp;{product.inventory !== undefined ? product.inventory : 'N/A'}
                  </span>
                </div>
              </div>
              
              {mappedProducts[product.id] ? (
                <div className="bg-gray-50 p-3 rounded-lg mb-3 border border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Đã mapping với:</div>
                  <div className="text-sm font-medium line-clamp-1">{mappedProducts[product.id].name}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                      ID: {mappedProducts[product.id].idNhanh}
                    </span>
                    {mappedProducts[product.id].code && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        Mã: {mappedProducts[product.id].code}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative mb-3">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={searchQueries[product.id] || ''}
                    onChange={(e) => handleInputChange(product.id, e.target.value)}
                    onFocus={() => handleSearchFocus(product.id)}
                    onBlur={() => handleSearchBlur(product.id)}
                    placeholder="Tìm sản phẩm Nhanh.vn..."
                  />
                </div>
              )}
              
              <div className="flex mt-auto space-x-2">
                {mappedProducts[product.id] ? (
                  <>
                    <button
                      onClick={() => handleSyncInventory(product.id)}
                      disabled={loadingIds.includes(product.id)}
                      className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
                    >
                      {loadingIds.includes(product.id) ? (
                        <Loader size={14} className="animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw size={14} className="mr-1.5" />
                      )}
                      Đồng bộ
                    </button>
                    <button
                      onClick={() => handleSyncPrice(product.id)}
                      disabled={loadingIds.includes(product.id)}
                      className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
                    >
                      {loadingIds.includes(product.id) ? (
                        <Loader size={14} className="animate-spin mr-1.5" />
                      ) : (
                        <DollarSign size={14} className="mr-1.5" />
                      )}
                      Đồng bộ giá
                    </button>
                    <button
                      onClick={() => handleViewDetails(mappedProducts[product.id].idNhanh)}
                      className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
                    >
                      <EyeIcon size={14} className="mr-1.5" />
                      Chi tiết
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (searchQueries[product.id] && searchQueries[product.id].length >= 2) {
                        handleSearch(product.id);
                      } else {
                        toast.info('Nhập tên sản phẩm để tìm kiếm');
                      }
                    }}
                    className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
                  >
                    {searchingIds.includes(product.id) ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Grid view component - Enhanced with better styling
  const renderGridView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200 flex">
            <div className="relative w-[100px] min-w-[100px] bg-gray-50">
              {product.image ? (
                <Image 
                  src={product.image} 
                  alt={product.name}
                  fill
                  className="object-contain p-2"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package size={28} className="text-gray-300" />
                </div>
              )}
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
              <div>
                <h3 className="font-medium text-gray-900 line-clamp-2 text-sm mb-1">{product.name}</h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    SKU: {product.sku || 'N/A'}
                  </span>
                  {product.inventory !== undefined && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      Tồn: {product.inventory}
                    </span>
                  )}
                </div>
              </div>
              
              {mappedProducts[product.id] && (
                <div className="text-xs text-gray-600 mb-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  <span className="font-medium">Đã map: </span>
                  <span className="line-clamp-1">{mappedProducts[product.id].name}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center">
                  {syncStatus[product.id] === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                      <CheckCircle size={12} />
                      <span className="hidden sm:inline">Đã đồng bộ</span>
                    </span>
                  ) : syncStatus[product.id] === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-red-700 text-xs">
                      <AlertCircle size={12} />
                      <span className="hidden sm:inline">Lỗi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                      <Clock size={12} />
                      <span className="hidden sm:inline">Chưa đồng bộ</span>
                    </span>
                  )}
                </div>
                
                {mappedProducts[product.id] ? (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleSyncInventory(product.id)}
                      disabled={loadingIds.includes(product.id)}
                      className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      title="Đồng bộ tồn kho"
                    >
                      {loadingIds.includes(product.id) ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSyncPrice(product.id)}
                      disabled={loadingIds.includes(product.id)}
                      className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      title="Đồng bộ giá"
                    >
                      {loadingIds.includes(product.id) ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <DollarSign size={14} className="mr-1.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewDetails(mappedProducts[product.id].idNhanh)}
                      className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      title="Xem chi tiết"
                    >
                      <EyeIcon size={14} className="mr-1.5" />
                    </button>
                    <button
                      onClick={() => handleUnmapProduct(product.id)}
                      className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      title="Hủy mapping"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (searchQueries[product.id] && searchQueries[product.id].length >= 2) {
                        handleSearch(product.id);
                      } else {
                        setVisibleSearchResults(prev => ({ ...prev, [product.id]: true }));
                        toast.info('Nhập tên sản phẩm để tìm kiếm');
                      }
                    }}
                    className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded text-xs"
                  >
                    <Search size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Table view component - Enhanced from the original
  const renderTableView = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {/* Bảng cho màn hình desktop */}
        <div className="hidden md:block">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full border-collapse divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sản phẩm Shopify
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sản phẩm Nhanh
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tìm kiếm
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {renderProducts()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hiển thị mobile cho chế độ danh sách */}
        <div className="md:hidden">
          <div className="flex flex-col space-y-4">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
                <div className="flex items-center mb-3">
                  <div className="h-12 w-12 flex-shrink-0 bg-gray-50 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center mr-3">
                    {product.image ? (
                      <Image 
                        src={product.image} 
                        alt={product.name}
                        width={48} 
                        height={48}
                        className="object-cover" 
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{product.name}</div>
                    <div className="flex flex-wrap gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">SKU: {product.sku || "—"}</span>
                      {product.inventory !== undefined && (
                        <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Tồn: {product.inventory}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Trạng thái mapping */}
                <div className="mb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sản phẩm Nhanh:</div>
                  {mappedProducts[product.id] ? (
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <div className="text-sm font-medium dark:text-white">{mappedProducts[product.id].name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-1">
                        <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">ID: {mappedProducts[product.id].idNhanh}</span>
                        {mappedProducts[product.id].code && (
                          <span className="bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">Mã: {mappedProducts[product.id].code}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">Chưa mapping</div>
                  )}
                </div>
                
                {/* Tìm kiếm (nếu chưa mapping) */}
                {!mappedProducts[product.id] && (
                  <div className="mb-3">
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        value={searchQueries[product.id] || ''}
                        onChange={(e) => handleInputChange(product.id, e.target.value)}
                        onFocus={() => handleSearchFocus(product.id)}
                        onBlur={() => handleSearchBlur(product.id)}
                        placeholder="Tìm sản phẩm Nhanh..."
                      />
                      <button
                        className="px-3 py-2 rounded-r flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        onClick={() => handleSearch(product.id)}
                        disabled={searchingIds.includes(product.id)}
                      >
                        {searchingIds.includes(product.id) ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <Search size={14} />
                        )}
                      </button>
                    </div>

                    {/* Danh sách kết quả tìm kiếm cho mobile */}
                    {nhanhProducts[product.id] && 
                    nhanhProducts[product.id].length > 0 && 
                    visibleSearchResults[product.id] && (
                      <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded max-h-60 overflow-y-auto bg-white dark:bg-gray-800 z-50 shadow-md">
                        {nhanhProducts[product.id].map((nhanhProduct, idx) => (
                          <div 
                            key={idx} 
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0 transition-colors duration-150"
                            onClick={() => handleSelectProduct(product.id, nhanhProduct)}
                            onMouseDown={(e) => e.preventDefault()} // Ngăn onBlur kích hoạt trước khi click
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium dark:text-white">{nhanhProduct.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-1 mt-1">
                                  <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">ID: {nhanhProduct.idNhanh}</span>
                                  {nhanhProduct.code && <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Mã: {nhanhProduct.code}</span>}
                                  {nhanhProduct.inventory !== undefined && <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Tồn: {nhanhProduct.inventory}</span>}
                                </div>
                              </div>
                              <div className="bg-primary-50 dark:bg-primary-900 p-2 rounded-full ml-2 flex-shrink-0">
                                <CheckCircle size={14} className="text-primary-700 dark:text-primary-400" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Thông báo không có kết quả cho mobile */}
                    {noResultsIds.includes(product.id) && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        <span>Không tìm thấy kết quả</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Thao tác */}
                <div className="flex gap-2 mt-2">
                  {mappedProducts[product.id] ? (
                    <>
                      <button
                        onClick={() => handleSyncInventory(product.id)}
                        disabled={loadingIds.includes(product.id)}
                        className="flex-1 p-2 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center justify-center"
                        title="Đồng bộ tồn kho"
                      >
                        {loadingIds.includes(product.id) ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleSyncPrice(product.id)}
                        disabled={loadingIds.includes(product.id)}
                        className="flex-1 p-2 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center justify-center"
                        title="Đồng bộ giá"
                      >
                        {loadingIds.includes(product.id) ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <DollarSign size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleViewDetails(mappedProducts[product.id].idNhanh)}
                        className="flex-1 p-2 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center justify-center"
                        title="Xem chi tiết"
                      >
                        <EyeIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleUnmapProduct(product.id)}
                        disabled={loadingIds.includes(product.id)}
                        className="flex-1 p-2 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center justify-center"
                        title="Hủy mapping"
                      >
                        <Trash size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        if (searchQueries[product.id] && searchQueries[product.id].length >= 2) {
                          handleSearch(product.id);
                        } else {
                          toast.info('Nhập tên sản phẩm để tìm kiếm');
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none flex items-center justify-center"
                    >
                      <Search size={14} className="mr-1.5" />
                      Tìm kiếm sản phẩm
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Cập nhật UI trang chính để bao gồm bộ lọc
  const renderFilters = () => {
    // Nếu đã có searchTerm và filterStatus từ bên ngoài, không hiển thị bộ lọc trong component
    if (externalSearchTerm !== undefined || externalFilterStatus !== undefined) {
      return null;
    }

    return (
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-grow flex-shrink flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, SKU..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full py-2 pl-10 pr-4 border border-gray-200 rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={handleFilterChange}
              className="w-full py-2 px-3 border border-gray-200 rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Tất cả sản phẩm</option>
              <option value="mapped">Đã mapping</option>
              <option value="unmapped">Chưa mapping</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center">
          <Loader className="w-12 h-12 text-primary-600 animate-spin mb-4" />
          <span className="text-lg text-gray-600">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={loading ? 'opacity-60' : ''}>
      {/* Main Content based on viewMode */}
      {filteredProducts.length > 0 ? (
        <>
          {viewMode === 'card' && renderCardView()}
          {viewMode === 'grid' && renderGridView()}
          {viewMode === 'table' && renderTableView()}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-8 flex flex-col items-center justify-center">
          <Info size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-600 mb-4 text-lg">Không có sản phẩm phù hợp với tìm kiếm</p>
          <button
            onClick={() => {
              if (externalSearchTerm === undefined) {
                setSearchTerm('');
              }
              if (externalFilterStatus === undefined) {
                setFilterStatus('all');
              }
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded transition-colors duration-200 flex items-center shadow-sm"
          >
            <Filter size={16} className="mr-2" />
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductTable; 