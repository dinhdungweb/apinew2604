const { parentPort } = require('worker_threads');
const { PrismaClient } = require('@prisma/client');

// Khởi tạo kết nối Prisma riêng cho mỗi worker
const prisma = new PrismaClient();

// Thời gian ngẫu nhiên để tránh các worker đồng thời tạo các yêu cầu
function jitterDelay(baseMs) {
  const jitterFactor = 0.3; // 30% dao động
  const jitterRange = baseMs * jitterFactor;
  return baseMs + (Math.random() * jitterRange) - (jitterRange / 2);
}

// Hàm cơ bản để gọi API với retry và jitter backoff
async function callApiWithRetry(apiCall, maxRetries = 5) {
  let attempt = 0;
  let lastError;

  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt < maxRetries) {
        // Exponential backoff với jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const delay = jitterDelay(baseDelay);
        
        console.log(`[Worker] Lỗi API, thử lại sau ${delay}ms (lần ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Hàm đồng bộ tồn kho
async function syncInventory(product, nhanhData, settings, username) {
  try {
    // Lấy thông tin Nhanh ID
    const nhanhId = nhanhData.idNhanh || '';
    if (!nhanhId) {
      throw new Error('Không tìm thấy ID Nhanh.vn');
    }
    
    // Lấy thông tin biến thể Shopify
    if (!product.shopifyId) {
      throw new Error('Không tìm thấy shopifyId cho sản phẩm');
    }
    
    // Lấy inventory_item_id của Shopify
    const variantResponse = await callApiWithRetry(async () => {
      const response = await fetch(
        `https://${settings.shopify_store}.myshopify.com/admin/api/2024-01/variants/${product.shopifyId}.json`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': settings.shopify_access_token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi Shopify API: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    });
    
    if (!variantResponse || !variantResponse.variant || !variantResponse.variant.inventory_item_id) {
      throw new Error('Biến thể không có inventory_item_id');
    }
    
    const inventoryItemId = variantResponse.variant.inventory_item_id;
    
    // Lấy dữ liệu từ Nhanh.vn
    const nhanhResponse = await callApiWithRetry(async () => {
      const response = await fetch('https://open.nhanh.vn/api/product/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'version': '2.0',
          'appId': settings.nhanh_app_id || '',
          'businessId': settings.nhanh_business_id || '',
          'accessToken': settings.nhanh_api_key || '',
          'data': JSON.stringify({ 'id': nhanhId })
        })
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi kết nối đến Nhanh.vn: ${response.status}`);
      }
      
      return response.json();
    });
    
    if (nhanhResponse.code !== 1) {
      throw new Error(`Lỗi từ API Nhanh.vn: ${nhanhResponse.messages || 'Không xác định'}`);
    }
    
    // Xử lý dữ liệu tồn kho
    let inventoryQuantity = 0;
    let productData = null;
    
    if (nhanhResponse.data && nhanhResponse.data.products) {
      const products = nhanhResponse.data.products;
      
      // Tìm sản phẩm theo ID
      if (products[nhanhId]) {
        productData = products[nhanhId];
      } else {
        // Kiểm tra tất cả sản phẩm nếu không tìm thấy theo ID
        for (const prodId in products) {
          if (products[prodId] && String(products[prodId].idNhanh) === nhanhId) {
            productData = products[prodId];
            break;
          }
        }
      }
      
      if (productData) {
        const inventory = productData.inventory || {};
        inventoryQuantity = inventory.remain || 0;
      }
    }
    
    // Cập nhật tồn kho trên Shopify
    await callApiWithRetry(async () => {
      const response = await fetch(
        `https://${settings.shopify_store}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': settings.shopify_access_token
          },
          body: JSON.stringify({
            'location_id': settings.shopify_location_id,
            'inventory_item_id': inventoryItemId,
            'available': inventoryQuantity
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi cập nhật tồn kho: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    });
    
    // Ghi log thành công
    await prisma.syncLog.create({
      data: {
        productMappingId: product.id,
        action: 'sync_inventory',
        status: 'success',
        message: `Đã đồng bộ tồn kho: ${inventoryQuantity}`,
        details: JSON.stringify({
          shopify: {
            variant_id: product.shopifyId,
            inventory_item_id: inventoryItemId,
            inventory: inventoryQuantity
          },
          nhanh: {
            id: nhanhId,
            inventory: inventoryQuantity
          }
        }),
        createdBy: username
      }
    });
    
    // Cập nhật trạng thái sản phẩm
    await prisma.productMapping.update({
      where: { id: product.id },
      data: {
        status: 'success',
        errorMsg: null,
        nhanhData: JSON.stringify(productData || nhanhData)
      }
    });
    
    return { success: true, inventoryQuantity };
  } catch (error) {
    // Ghi log lỗi
    await prisma.syncLog.create({
      data: {
        productMappingId: product.id,
        action: 'sync_inventory',
        status: 'error',
        message: error.message || 'Lỗi không xác định',
        details: JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
        createdBy: username
      }
    });
    
    // Cập nhật trạng thái sản phẩm lỗi
    await prisma.productMapping.update({
      where: { id: product.id },
      data: {
        status: 'error',
        errorMsg: error.message || 'Lỗi không xác định'
      }
    });
    
    throw error;
  }
}

// Các tác vụ mà worker có thể xử lý
const tasks = {
  syncInventory
};

// Lắng nghe tin nhắn từ thread chính
parentPort.on('message', async (message) => {
  const { id, task, params } = message;
  
  try {
    if (!tasks[task]) {
      throw new Error(`Không tìm thấy tác vụ "${task}"`);
    }
    
    const result = await tasks[task](...params);
    
    // Kiểm tra kết quả có dấu hiệu bị bỏ qua do khóa phân tán
    if (result && result.skipped) {
      // Nếu bị bỏ qua do khóa, trả về thông tin đầy đủ
      parentPort.postMessage({ 
        id, 
        result: {
          skipped: true,
          reason: result.reason || 'Tác vụ bị bỏ qua do khóa phân tán',
          taskName: task
        }
      });
    } else {
      // Trả về kết quả thông thường nếu xử lý thành công
      parentPort.postMessage({ id, result });
    }
  } catch (error) {
    parentPort.postMessage({ 
      id, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    });
  }
}); 