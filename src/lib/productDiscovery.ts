import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

/**
 * Interface cho dữ liệu sản phẩm từ Nhanh.vn
 */
interface NhanhProduct {
  idNhanh: string;
  code?: string;
  name: string;
  price?: number;
  inventory?: number;
  image?: string;
  updatedAt?: string;
}

/**
 * Lấy các sản phẩm mới nhất từ Nhanh.vn
 */
export async function fetchRecentProductsFromNhanh(settings: any): Promise<NhanhProduct[]> {
  try {
    const NHANH_APP_ID = settings.nhanh_app_id;
    const NHANH_BUSINESS_ID = settings.nhanh_business_id;
    const NHANH_API_KEY = settings.nhanh_api_key;
    
    // Kiểm tra cài đặt API
    if (!NHANH_APP_ID || !NHANH_BUSINESS_ID || !NHANH_API_KEY) {
      throw new Error('Thiếu cài đặt API Nhanh.vn');
    }
    
    console.log('[ProductDiscovery] Đang lấy sản phẩm mới từ Nhanh.vn...');
    
    // Tạo tham số tìm kiếm - lấy sản phẩm mới cập nhật trong 7 ngày qua
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const searchParams = {
      page: 1,
      limit: 100, // Số lượng tối đa sản phẩm mỗi lần gọi
      updatedFrom: sevenDaysAgo.toISOString().split('T')[0], // Định dạng: YYYY-MM-DD
    };
    
    // Gọi API Nhanh.vn
    const response = await axios.post(
      'https://open.nhanh.vn/api/product/search',
      new URLSearchParams({
        'version': '2.0',
        'appId': NHANH_APP_ID,
        'businessId': NHANH_BUSINESS_ID,
        'accessToken': NHANH_API_KEY,
        'data': JSON.stringify(searchParams)
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Kiểm tra kết quả
    if (response.data && response.data.code === 1 && response.data.data && response.data.data.products) {
      const products = response.data.data.products;
      console.log(`[ProductDiscovery] Tìm thấy ${products.length} sản phẩm từ Nhanh.vn`);
      return products;
    } else {
      console.error('[ProductDiscovery] Lỗi khi lấy dữ liệu từ Nhanh.vn:', response.data);
      return [];
    }
  } catch (error) {
    console.error('[ProductDiscovery] Lỗi khi gọi API Nhanh.vn:', error);
    return [];
  }
}

/**
 * Lấy danh sách ID sản phẩm đã tồn tại trong hệ thống
 */
export async function getExistingProductIds(): Promise<{ id: number; externalId: string | null }[]> {
  try {
    // Lấy tất cả ID sản phẩm đã mapping
    const products = await prisma.productMapping.findMany({
      select: {
        id: true,
        nhanhData: true,
      }
    });
    
    // Trích xuất externalId từ mỗi sản phẩm
    return products.map(product => {
      let externalId = null;
      
      try {
        if (product.nhanhData) {
          const nhanhData = typeof product.nhanhData === 'string'
            ? JSON.parse(product.nhanhData)
            : product.nhanhData;
          
          externalId = nhanhData.idNhanh || null;
        }
      } catch (error) {
        console.error(`[ProductDiscovery] Lỗi khi parse nhanhData cho sản phẩm ${product.id}:`, error);
      }
      
      return { id: product.id, externalId };
    });
  } catch (error) {
    console.error('[ProductDiscovery] Lỗi khi lấy danh sách sản phẩm đã tồn tại:', error);
    return [];
  }
}

/**
 * Tạo sản phẩm mới trên Shopify từ dữ liệu Nhanh.vn
 */
export async function createShopifyProduct(nhanhProduct: NhanhProduct, settings: any): Promise<any> {
  try {
    const SHOPIFY_STORE = settings.shopify_store;
    const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
    
    // Kiểm tra cài đặt API
    if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Thiếu cài đặt API Shopify');
    }
    
    console.log(`[ProductDiscovery] Đang tạo sản phẩm "${nhanhProduct.name}" trên Shopify...`);
    
    // Tạo dữ liệu sản phẩm
    const productData = {
      product: {
        title: nhanhProduct.name,
        body_html: `<p>Sản phẩm đồng bộ từ Nhanh.vn (ID: ${nhanhProduct.idNhanh})</p>`,
        vendor: 'Nhanh.vn',
        status: 'active',
        published: true,
        variants: [
          {
            price: nhanhProduct.price || 0,
            inventory_management: 'shopify',
            inventory_quantity: nhanhProduct.inventory || 0,
            sku: nhanhProduct.code || `NHANH-${nhanhProduct.idNhanh}`
          }
        ]
      }
    };
    
    // Gọi API Shopify để tạo sản phẩm
    const response = await axios.post(
      `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/products.json`,
      productData,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`[ProductDiscovery] Đã tạo sản phẩm thành công trên Shopify, ID: ${response.data.product.id}`);
    
    return response.data.product;
  } catch (error) {
    console.error('[ProductDiscovery] Lỗi khi tạo sản phẩm trên Shopify:', error);
    throw error;
  }
}

/**
 * Tạo mapping trong database cho sản phẩm mới
 */
export async function createProductMapping(shopifyProductId: string, nhanhProduct: NhanhProduct): Promise<any> {
  try {
    // Kiểm tra xem sản phẩm đã tồn tại chưa
    const existingMapping = await prisma.productMapping.findFirst({
      where: {
        nhanhData: {
          contains: nhanhProduct.idNhanh.toString()
        }
      }
    });
    
    if (existingMapping) {
      console.log(`[ProductDiscovery] Sản phẩm với ID Nhanh ${nhanhProduct.idNhanh} đã tồn tại trong hệ thống`);
      return existingMapping;
    }
    
    console.log(`[ProductDiscovery] Tạo mapping mới cho sản phẩm: ${nhanhProduct.name}`);
    
    // Tạo mapping mới
    const newMapping = await prisma.productMapping.create({
      data: {
        shopifyId: shopifyProductId,
        nhanhData: JSON.stringify(nhanhProduct),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`[ProductDiscovery] Đã tạo mapping thành công, ID: ${newMapping.id}`);
    
    // Tạo log đồng bộ
    await prisma.syncLog.create({
      data: {
        productMappingId: newMapping.id,
        action: 'discover_product',
        status: 'success',
        message: `Tìm thấy sản phẩm mới: ${nhanhProduct.name} (ID Nhanh: ${nhanhProduct.idNhanh})`,
        details: JSON.stringify({
          nhanhProduct,
          shopifyProductId,
          discoveredAt: new Date()
        }),
        createdBy: 'system'
      }
    });
    
    return newMapping;
  } catch (error) {
    console.error('[ProductDiscovery] Lỗi khi tạo mapping cho sản phẩm:', error);
    throw error;
  }
}

/**
 * Hàm chính để phát hiện sản phẩm mới
 */
export async function discoverNewProducts(settings: any): Promise<number> {
  try {
    console.log('[ProductDiscovery] Bắt đầu quá trình phát hiện sản phẩm mới...');
    
    // Lấy sản phẩm mới từ Nhanh.vn
    const nhanhProducts = await fetchRecentProductsFromNhanh(settings);
    
    if (nhanhProducts.length === 0) {
      console.log('[ProductDiscovery] Không tìm thấy sản phẩm nào từ Nhanh.vn');
      return 0;
    }
    
    // Lấy danh sách sản phẩm đã tồn tại
    const existingProducts = await getExistingProductIds();
    const existingIds = new Set(existingProducts.filter(p => p.externalId).map(p => p.externalId));
    
    // Lọc ra các sản phẩm mới
    const newProducts = nhanhProducts.filter(p => !existingIds.has(p.idNhanh));
    
    if (newProducts.length === 0) {
      console.log('[ProductDiscovery] Không có sản phẩm mới để thêm vào hệ thống');
      return 0;
    }
    
    console.log(`[ProductDiscovery] Tìm thấy ${newProducts.length} sản phẩm mới, bắt đầu tạo mapping...`);
    
    // Tạo mapping cho từng sản phẩm mới
    let successCount = 0;
    
    for (const product of newProducts) {
      try {
        // Tạo sản phẩm trên Shopify
        const shopifyProduct = await createShopifyProduct(product, settings);
        
        if (!shopifyProduct || !shopifyProduct.id) {
          console.error(`[ProductDiscovery] Không thể tạo sản phẩm "${product.name}" trên Shopify`);
          continue;
        }
        
        // Tạo mapping trong database
        await createProductMapping(shopifyProduct.id, product);
        
        successCount++;
      } catch (error) {
        console.error(`[ProductDiscovery] Lỗi khi xử lý sản phẩm "${product.name}":`, error);
      }
    }
    
    console.log(`[ProductDiscovery] Hoàn thành quá trình phát hiện sản phẩm, đã thêm ${successCount}/${newProducts.length} sản phẩm mới`);
    
    return successCount;
  } catch (error) {
    console.error('[ProductDiscovery] Lỗi khi phát hiện sản phẩm mới:', error);
    return 0;
  }
} 