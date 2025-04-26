import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import axios from 'axios';
import { getShopifyCache, setShopifyCache, isCacheExpired, CACHE_CONFIG } from '@/lib/shopifyCache';
import prisma from '@/lib/prisma';
import { getSettings } from '@/lib/queue';

// Sử dụng biến môi trường hoặc settings từ database thay vì hard-code
const ITEMS_PER_PAGE = 20; // Số lượng sản phẩm mỗi trang

// Định nghĩa các interface cần thiết
interface ShopifyProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  image?: string | null;
  inventory_item_id?: string | null;
  inventory: number;
}

interface ApiResponse {
  success: boolean;
  products: ShopifyProduct[];
  pagination: {
    show_all: boolean;
    total_products: number;
    current_page: number;
    total_pages: number;
    page_size: number;
  };
  filter_stats: {
    total: number;
    filtered: number;
    instock: number;
    outofstock: number;
    lowstock: number;
  };
  error?: string;
  stats?: {
    total: number;
    synced: number;
    unsynced: number;
    hasErrors: number;
  };
  mappings?: {
    mappings: Record<string, any>;
    syncStatus: Record<string, string | null>;
    syncErrors: Record<string, string | null>;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Xác thực token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const verifyResult = await verifyJwtToken(token);
    if (!verifyResult || !verifyResult.success) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    
    // Lấy tham số từ URL
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || String(ITEMS_PER_PAGE), 10);
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'name';
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';
    const includeStats = url.searchParams.get('includeStats') === 'true';
    
    try {
      // Kiểm tra cache trước
      let products: ShopifyProduct[] = [];
      let cacheIsValid = false;
      
      try {
        if (!await isCacheExpired()) {
          const cachedProducts = await getShopifyCache();
          if (cachedProducts && cachedProducts.length > 0) {
            console.log('[API products] Sử dụng dữ liệu từ cache với', cachedProducts.length, 'sản phẩm');
            products = cachedProducts;
            cacheIsValid = true;
          }
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
      
      // Nếu cache không hợp lệ, lấy dữ liệu mới từ Shopify
      if (!cacheIsValid) {
        console.log('[API products] Đang lấy dữ liệu sản phẩm từ Shopify...');
        products = await getAllShopifyProducts();
        console.log('[API products] Đã lấy tổng cộng', products.length, 'variants từ Shopify');
        
        // Kiểm tra số lượng sản phẩm gốc (product_ids riêng biệt)
        const uniqueProductIds = new Set();
        products.forEach(product => uniqueProductIds.add(product.product_id));
        console.log('[API products] Số lượng sản phẩm gốc riêng biệt:', uniqueProductIds.size);
        
        // Cập nhật cache
        console.log('[API products] Đang cập nhật cache với', products.length, 'variants');
        await setShopifyCache(products);
      }
      
      // Áp dụng bộ lọc
      let filteredProducts = products;
      
      // Áp dụng lọc theo trạng thái
      if (filter && filter !== 'all') {
        switch (filter) {
          case 'instock':
            filteredProducts = products.filter((product: ShopifyProduct) => (product.inventory || 0) > 0);
            break;
          case 'outofstock':
            filteredProducts = products.filter((product: ShopifyProduct) => !product.inventory || product.inventory <= 0);
            break;
          case 'lowstock':
            filteredProducts = products.filter((product: ShopifyProduct) => product.inventory && product.inventory > 0 && product.inventory <= 5);
            break;
          // Thêm các bộ lọc khác nếu cần
        }
      }
      
      // Áp dụng tìm kiếm
      if (search) {
        const searchLower = search.toLowerCase();
        filteredProducts = filteredProducts.filter((product: ShopifyProduct) => 
          product.name.toLowerCase().includes(searchLower) || 
          product.sku.toLowerCase().includes(searchLower) ||
          product.product_id.toString().includes(searchLower)
        );
      }
      
      // Sắp xếp sản phẩm
      filteredProducts.sort((a: ShopifyProduct, b: ShopifyProduct) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'price':
            comparison = (a.price || 0) - (b.price || 0);
            break;
          case 'inventory':
            comparison = (a.inventory || 0) - (b.inventory || 0);
            break;
          case 'sku':
            comparison = a.sku.localeCompare(b.sku);
            break;
          default:
            comparison = a.name.localeCompare(b.name);
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
      
      // Tính toán phân trang
      const totalProducts = filteredProducts.length;
      const totalPages = Math.ceil(totalProducts / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
      
      console.log(`[API products] Phân trang ${page}/${totalPages}, hiển thị ${paginatedProducts.length} trên tổng số ${totalProducts} variants`);
      
      // Tính toán filter stats - tính trước để tái sử dụng
      const filterStats = {
        total: products.length,
        filtered: filteredProducts.length,
        instock: products.filter((p: ShopifyProduct) => (p.inventory || 0) > 0).length,
        outofstock: products.filter((p: ShopifyProduct) => !p.inventory || p.inventory <= 0).length,
        lowstock: products.filter((p: ShopifyProduct) => p.inventory && p.inventory > 0 && p.inventory <= 5).length
      };
      
      // Chuẩn bị response
      const response: ApiResponse = {
        success: true,
        products: paginatedProducts,
        pagination: {
          show_all: false,
          total_products: totalProducts,
          current_page: page,
          total_pages: totalPages,
          page_size: pageSize
        },
        filter_stats: filterStats
      };
      
      // Nếu yêu cầu bao gồm stats, lấy thêm dữ liệu thống kê và mapping
      if (includeStats) {
        // Lấy stats về tình trạng đồng bộ
        const stats = await getProductStats(products, filterStats);
        response.stats = stats;
        
        // Lấy thông tin mapping
        const mappings = await getProductMappings();
        response.mappings = mappings;
      }
      
      return NextResponse.json(response);
    } catch (error: any) {
      console.error('Shopify API error:', error.response?.data || error.message);
      return mockProductsResponse(page, pageSize, includeStats);
    }
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}

// Hàm tạo dữ liệu mẫu khi không thể kết nối với Shopify API
function mockProductsResponse(page: number, pageSize: number, includeStats: boolean = false) {
  console.log('Trả về dữ liệu mẫu do không thể kết nối với Shopify API');
  const mockProducts = Array.from({ length: 20 }, (_, i) => ({
    id: `shopify_${i + 1}`,
    product_id: `shopify_product_${i + 1}`,
    name: `Sản phẩm mẫu ${i + 1}`,
    sku: `SKU-${i + 1}`,
    price: Math.floor(Math.random() * 1000000) + 100000,
    inventory: Math.floor(Math.random() * 100)
  }));
  
  const response: ApiResponse = {
    success: true,
    products: mockProducts,
    pagination: {
      show_all: false,
      total_products: 100, // Giả sử có 100 sản phẩm
      current_page: page,
      total_pages: 5,
      page_size: pageSize
    },
    filter_stats: {
      total: 100,
      filtered: 20,
      instock: 70,
      outofstock: 20,
      lowstock: 10
    },
    error: 'Không thể kết nối với Shopify API, đang hiển thị dữ liệu mẫu'
  };
  
  // Nếu yêu cầu bao gồm stats, thêm dữ liệu thống kê và mapping mẫu
  if (includeStats) {
    response.stats = {
      total: 100,
      synced: 45,
      unsynced: 55,
      hasErrors: 10
    };
    
    response.mappings = {
      mappings: {},
      syncStatus: {},
      syncErrors: {}
    };
  }
  
  return NextResponse.json(response);
}

// Hàm lấy tất cả sản phẩm từ Shopify (đơn giản như trong API_example)
async function getAllShopifyProducts(): Promise<ShopifyProduct[]> {
  console.log('Bắt đầu lấy dữ liệu sản phẩm từ Shopify');
  const products: ShopifyProduct[] = [];
  
  // Lấy cài đặt từ database
  const settings = await getSettings();
  const SHOPIFY_STORE = settings.shopify_store;
  const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
  
  let nextPageUrl = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/products.json?limit=250`;
  let totalBaseProducts = 0;
  let pageCount = 0;
  
  while (nextPageUrl) {
    pageCount++;
    console.log(`Đang gọi API Shopify trang ${pageCount}: ${nextPageUrl}`);
    const response = await axios.get(nextPageUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    });
    
    // Đếm số lượng sản phẩm gốc (không tính variants)
    totalBaseProducts += response.data.products.length;
    console.log(`Trang ${pageCount}: Số lượng sản phẩm gốc: ${response.data.products.length}, Tổng số hiện tại: ${totalBaseProducts}`);
    
    // Xử lý data từ trang hiện tại
    for (const product of response.data.products) {
      // Log thông tin chi tiết về sản phẩm và variants
      console.log(`Xử lý sản phẩm: ${product.id} - ${product.title}, Số variants: ${product.variants?.length || 0}`);
      
      // Nếu sản phẩm có variants, lấy thông tin từng variant
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          products.push({
            id: variant.id.toString(),
            product_id: product.id.toString(),
            name: product.title + (variant.title !== 'Default Title' ? ` - ${variant.title}` : ''),
            sku: variant.sku || '',
            price: parseFloat(variant.price || 0),
            image: product.images && product.images.length > 0 ? product.images[0].src : null,
            inventory_item_id: variant.inventory_item_id,
            inventory: variant.inventory_quantity || 0
          });
        }
      } else {
        // Sản phẩm không có variant
        products.push({
          id: product.id.toString(),
          product_id: product.id.toString(),
          name: product.title,
          sku: product.variants && product.variants[0] ? product.variants[0].sku : '',
          price: product.variants && product.variants[0] ? parseFloat(product.variants[0].price || 0) : 0,
          image: product.images && product.images.length > 0 ? product.images[0].src : null,
          inventory_item_id: product.variants && product.variants[0] ? product.variants[0].inventory_item_id : null,
          inventory: product.variants && product.variants[0] ? product.variants[0].inventory_quantity || 0 : 0
        });
      }
    }
    
    // Kiểm tra nếu có trang tiếp theo
    const linkHeader = response.headers.link || '';
    const nextPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextPageUrl = nextPageMatch ? nextPageMatch[1] : null;
    
    console.log(`Trang ${pageCount}: Đã lấy tổng ${products.length} variants từ Shopify`);
  }
  
  console.log(`Hoàn tất: Tổng số sản phẩm gốc: ${totalBaseProducts}, Tổng số variants: ${products.length}`);
  return products;
}

// Hàm lấy thống kê sản phẩm
async function getProductStats(products: ShopifyProduct[] = [], filterStats: any = null) {
  try {
    // Lấy tổng số sản phẩm từ bảng ProductMapping
    const totalMappings = await prisma.productMapping.count();
    
    // Lấy số lượng sản phẩm đã đồng bộ thành công
    const syncedCount = await prisma.productMapping.count({
      where: {
        status: 'done'
      }
    });
    
    // Lấy số lượng sản phẩm có lỗi
    const errorCount = await prisma.productMapping.count({
      where: {
        status: 'error'
      }
    });
    
    // Sử dụng tổng số sản phẩm đã tính toán nếu có
    const totalProducts = filterStats?.total || products.length || 0;
    
    return {
      total: totalProducts,
      synced: syncedCount,
      unsynced: Math.max(0, totalProducts - totalMappings),
      hasErrors: errorCount
    };
  } catch (error) {
    console.error('Error getting product stats:', error);
    return {
      total: products.length || 0,
      synced: 0,
      unsynced: products.length || 0,
      hasErrors: 0
    };
  }
}

// Hàm lấy thông tin mapping
async function getProductMappings() {
  try {
    // Lấy tất cả product mappings
    const mappings = await prisma.productMapping.findMany();
    
    // Chuyển đổi dữ liệu thành định dạng cần thiết
    const mappingsMap: Record<string, any> = {};
    const syncStatusMap: Record<string, string | null> = {};
    const syncErrorsMap: Record<string, string | null> = {};
    
    for (const mapping of mappings) {
      // Parse dữ liệu Nhanh từ trường nhanhData
      let nhanhData = {};
      try {
        nhanhData = JSON.parse(mapping.nhanhData);
      } catch (e) {
        console.error('Error parsing nhanhData for mapping:', mapping.id);
      }
      
      // Lấy thông tin về trạng thái đồng bộ và lỗi
      mappingsMap[mapping.shopifyId] = nhanhData;
      syncStatusMap[mapping.shopifyId] = mapping.status || null;
      syncErrorsMap[mapping.shopifyId] = mapping.errorMsg || null;
    }
    
    return {
      mappings: mappingsMap,
      syncStatus: syncStatusMap,
      syncErrors: syncErrorsMap
    };
  } catch (error) {
    console.error('Error getting product mappings:', error);
    return {
      mappings: {},
      syncStatus: {},
      syncErrors: {}
    };
  }
}

// API endpoint để tìm kiếm sản phẩm Nhanh.vn
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Không được phép truy cập' }, { status: 401 });
    }

    const payload = await verifyJwtToken(token);
    if (!payload) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    
    // Lấy cài đặt từ database
    const settings = await getSettings();
    const NHANH_APP_ID = settings.nhanh_app_id;
    const NHANH_BUSINESS_ID = settings.nhanh_business_id;
    const NHANH_API_KEY = settings.nhanh_api_key;
    
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }
    
    try {
      // Kết nối với Nhanh.vn API để tìm kiếm - sử dụng chính xác cách trong dự án cũ
      const nhanhUrl = "https://open.nhanh.vn/api/product/search";
      const nhanhPayload = {
        "version": "2.0",
        "appId": NHANH_APP_ID,
        "businessId": NHANH_BUSINESS_ID,
        "accessToken": NHANH_API_KEY,
        "data": JSON.stringify({
          "name": query, // Trong dự án cũ dùng "name" không phải "keyword"
          "page": 1,
          "icpp": 50
        })
      };
      
      console.log("Đang tìm kiếm sản phẩm Nhanh.vn với từ khóa:", query);
      
      const nhanhResponse = await axios.post(
        nhanhUrl, 
        new URLSearchParams(nhanhPayload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Xử lý dữ liệu từ Nhanh.vn
      const nhanhData = nhanhResponse.data;
      
      console.log("Kết quả từ Nhanh.vn:", nhanhData.code, nhanhData.data ? "Có dữ liệu" : "Không có dữ liệu");
      
      if (nhanhData.code === 1 && nhanhData.data && nhanhData.data.products) {
        const products = [];
        
        // Xử lý từng sản phẩm một cách an toàn
        for (const key in nhanhData.data.products) {
          if (Object.prototype.hasOwnProperty.call(nhanhData.data.products, key)) {
            const product = nhanhData.data.products[key];
            
            // Đảm bảo tất cả các trường đều được xử lý đúng, kể cả khi không tồn tại
            products.push({
              idNhanh: product.idNhanh?.toString() || product.id?.toString() || key.toString(),
              name: product.name || 'Không có tên',
              code: product.code || product.id || key,
              inventory: product.inventory?.remain || product.quantity || 0,
              price: product.price || 0
            });
          }
        }
        
        console.log(`Tìm thấy ${products.length} sản phẩm Nhanh.vn`);
        
        return NextResponse.json({
          success: true,
          products: products
        });
      } else {
        // Trả về mảng rỗng nếu không tìm thấy sản phẩm
        console.log("Không tìm thấy sản phẩm Nhanh.vn phù hợp");
        
        return NextResponse.json({
          success: true,
          products: []
        });
      }
    } catch (error: any) {
      console.error('Nhanh.vn API error:', error.response?.data || error.message);
      if (error.response) {
        console.error('Nhanh.vn API response:', error.response.status, error.response.statusText);
      }
      
      // Trả về dữ liệu giả lập nếu có lỗi kết nối với Nhanh.vn API
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        idNhanh: `nhanh_${i + 1}`,
        name: `Sản phẩm Nhanh ${query} - ${i + 1}`,
        code: `NH-${query}-${i + 1}`,
        inventory: Math.floor(Math.random() * 100)
      }));
      
      return NextResponse.json({
        success: true,
        products: mockResults,
        error: 'Không thể kết nối với Nhanh.vn API, đang hiển thị dữ liệu mẫu'
      });
    }
  } catch (error) {
    console.error('Search Nhanh product API error:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
} 