const { PrismaClient } = require('@prisma/client');

// Khởi tạo Prisma Client
const prisma = new PrismaClient();

// Đối tượng đo hiệu suất đồng bộ
const syncMetrics = {
  startTime: null,
  batchCount: 0,
  totalItems: 0,
  
  start: function() {
    this.startTime = Date.now();
    this.batchCount = 0;
    this.totalItems = 0;
    console.log('[Metrics] Bắt đầu đo hiệu suất đồng bộ');
    return this;
  },
  
  recordBatch: function(itemCount) {
    this.batchCount++;
    this.totalItems += itemCount;
    return this;
  },
  
  end: function() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    const avgBatchTime = this.batchCount > 0 ? totalTime / this.batchCount : 0;
    
    // Không hiển thị kết quả tại đây, chỉ trả về dữ liệu để worker hiển thị
    return {
      startTime: this.startTime,
      endTime,
      totalTime,
      avgBatchTime,
      totalItems: this.totalItems,
      batchCount: this.batchCount
    };
  }
};

/**
 * Hàm sleep - tạm dừng thực thi trong một khoảng thời gian
 * @param {number} ms - Thời gian tạm dừng tính bằng millisecond
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hàm lấy dữ liệu từ Nhanh.vn
 */
async function getNhanhData(nhanhId, settings) {
  const NHANH_APP_ID = settings.nhanh_app_id;
  const NHANH_BUSINESS_ID = settings.nhanh_business_id;
  const NHANH_API_KEY = settings.nhanh_api_key;

  const response = await fetch('https://open.nhanh.vn/api/product/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'version': '2.0',
      'appId': NHANH_APP_ID || '',
      'businessId': NHANH_BUSINESS_ID || '',
      'accessToken': NHANH_API_KEY || '',
      'data': JSON.stringify({ 'id': nhanhId })
    })
  });

  if (!response.ok) {
    throw new Error(`Lỗi kết nối đến Nhanh.vn: ${response.status}`);
  }

  return await response.json();
}

/**
 * Lấy số lượng tồn kho từ dữ liệu Nhanh.vn với xử lý nhất quán
 * @param {Object} nhanhData - Dữ liệu từ Nhanh.vn 
 * @param {string} warehouseId - Mã kho cần lấy tồn kho (mặc định: 175080)
 * @param {string} productId - ID sản phẩm, chỉ dùng cho việc log
 * @returns {number} - Số lượng tồn kho (luôn là số nguyên không âm)
 */
function getInventoryQuantity(nhanhData, warehouseId = '175080', productId = 'unknown') {
  console.log(`[INVENTORY] Bắt đầu lấy tồn kho cho sản phẩm ${productId}, warehouseId: ${warehouseId}`);
  
  // Khởi tạo số lượng mặc định là 0
  let inventoryQuantity = 0;

  try {
    // Kiểm tra cấu trúc dữ liệu  
    if (!nhanhData) {
      console.log(`[INVENTORY] Dữ liệu Nhanh.vn không tồn tại cho sản phẩm ${productId}`);
      return 0;
    }

    // Lấy dữ liệu inventory từ nhanhData
    const inventory = nhanhData.inventory;
    
    // Nếu không có dữ liệu inventory
    if (!inventory) {
      console.log(`[INVENTORY] Không có dữ liệu tồn kho cho sản phẩm ${productId}`);
      return 0;
    }
    
    // TRƯỜNG HỢP 1: Nếu inventory là số, sử dụng trực tiếp
    if (typeof inventory === 'number') {
      inventoryQuantity = inventory;
      console.log(`[INVENTORY] Lấy tồn kho trực tiếp (số): ${inventoryQuantity}`);
    }
    // TRƯỜNG HỢP 2: Nếu inventory có trường remain
    else if (typeof inventory === 'object' && inventory !== null && 'remain' in inventory) {
      inventoryQuantity = Number(inventory.remain);
      console.log(`[INVENTORY] Lấy tồn kho từ trường remain: ${inventoryQuantity}`);
    }
    // TRƯỜNG HỢP 3: Nếu inventory có depots (nhiều kho)
    else if (typeof inventory === 'object' && inventory !== null && inventory.depots) {
      if (warehouseId === 'all') {
        // Nếu yêu cầu tất cả kho, tính tổng
        let total = 0;
        Object.entries(inventory.depots).forEach(([depotId, depot]) => {
          if (depot && typeof depot === 'object' && 'available' in depot) {
            const depotValue = Number(depot.available || 0);
            if (!isNaN(depotValue)) {
              total += depotValue;
            }
          }
        });
        inventoryQuantity = total;
        console.log(`[INVENTORY] Lấy tổng tồn kho từ tất cả kho: ${inventoryQuantity}`);
      } 
      // Nếu tìm thấy kho cụ thể theo warehouseId
      else if (inventory.depots[warehouseId] && 'available' in inventory.depots[warehouseId]) {
        inventoryQuantity = Number(inventory.depots[warehouseId].available || 0);
        console.log(`[INVENTORY] Lấy tồn kho từ kho ${warehouseId}: ${inventoryQuantity}`);
      }
      // Fallback về kho mặc định 175080 nếu không tìm thấy kho yêu cầu
      else if (inventory.depots['175080'] && 'available' in inventory.depots['175080']) {
        inventoryQuantity = Number(inventory.depots['175080'].available || 0);
        console.log(`[INVENTORY] Không tìm thấy kho ${warehouseId}, fallback về kho mặc định 175080: ${inventoryQuantity}`);
      }
      // Nếu không có cả kho cụ thể và kho mặc định, tính tổng tất cả kho
      else {
        let total = 0;
        Object.entries(inventory.depots).forEach(([depotId, depot]) => {
          if (depot && typeof depot === 'object' && 'available' in depot) {
            const depotValue = Number(depot.available || 0);
            if (!isNaN(depotValue)) {
              total += depotValue;
            }
          }
        });
        inventoryQuantity = total;
        console.log(`[INVENTORY] Không tìm thấy kho ${warehouseId} hoặc kho mặc định, lấy tổng từ tất cả kho: ${inventoryQuantity}`);
      }
    }
    // TRƯỜNG HỢP 4: Nếu inventory là string hoặc cấu trúc khác, chuyển đổi thành số
    else {
      inventoryQuantity = Number(inventory);
      console.log(`[INVENTORY] Chuyển đổi tồn kho từ ${typeof inventory}: ${inventoryQuantity}`);
    }
    
    // Đảm bảo inventoryQuantity là số hợp lệ
    if (isNaN(inventoryQuantity)) {
      console.log(`[INVENTORY] Tồn kho không hợp lệ (NaN) cho sản phẩm ${productId}, đặt về 0`);
      inventoryQuantity = 0;
    }
    
    // Đảm bảo inventoryQuantity là số nguyên không âm
    inventoryQuantity = Math.max(0, Math.floor(inventoryQuantity));
    console.log(`[INVENTORY] Giá trị tồn kho cuối cùng cho sản phẩm ${productId}: ${inventoryQuantity}`);
    
    return inventoryQuantity;
  } catch (error) {
    console.error(`[INVENTORY] Lỗi khi xử lý tồn kho cho sản phẩm ${productId}:`, error);
    return 0; // Trả về 0 nếu có lỗi
  }
}

/**
 * Kiểm tra xem tồn kho có thay đổi không
 * @param {Object} product - Thông tin sản phẩm
 * @param {Object} nhanhData - Dữ liệu Nhanh.vn hiện tại
 * @param {Object} settings - Cài đặt API
 * @returns {Promise<Object>} - Kết quả kiểm tra với changed = true/false
 */
async function checkInventoryChange(product, nhanhData, settings) {
  try {
    console.log(`[INVENTORY_CHECK] Kiểm tra thay đổi tồn kho cho sản phẩm ${product.id}`);
    
    if (!nhanhData || !nhanhData.idNhanh) {
      console.log(`[INVENTORY_CHECK] Thiếu dữ liệu Nhanh.vn hoặc ID Nhanh cho sản phẩm ${product.id}`);
      return { changed: true, reason: 'missing_data' };
    }
    
    // Lấy số lượng tồn kho hiện tại từ Shopify
    let currentInventory = 0;
    try {
      // Kiểm tra xem có shopifyId không
      if (!product.shopifyId) {
        console.log(`[INVENTORY_CHECK] Thiếu Shopify ID cho sản phẩm ${product.id}`);
        return { changed: true, reason: 'missing_shopify_id' };
      }
      
      // Lấy thông tin biến thể Shopify
      const shopifyVariant = await getShopifyProduct(product.shopifyId, settings);
      
      if (!shopifyVariant || !shopifyVariant.inventory_item_id) {
        console.log(`[INVENTORY_CHECK] Không tìm thấy biến thể Shopify hoặc inventory_item_id cho sản phẩm ${product.id}`);
        return { changed: true, reason: 'missing_inventory_item' };
      }
      
      // Cấu hình Shopify từ settings
      const SHOPIFY_STORE = settings.shopify_store;
      const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
      const SHOPIFY_LOCATION_ID = settings.shopify_location_id;
      
      // Lấy thông tin inventory hiện tại từ Shopify
      const inventoryResponse = await callShopifyAPI(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${shopifyVariant.inventory_item_id}`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!inventoryResponse.ok) {
        console.log(`[INVENTORY_CHECK] Lỗi khi lấy thông tin tồn kho từ Shopify: ${inventoryResponse.status}`);
        return { changed: true, reason: 'shopify_api_error' };
      }
      
      const inventoryData = await inventoryResponse.json();
      if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
        currentInventory = parseInt(inventoryData.inventory_levels[0].available, 10);
        console.log(`[INVENTORY_CHECK] Tồn kho hiện tại từ Shopify: ${currentInventory}`);
      } else {
        console.log(`[INVENTORY_CHECK] Không tìm thấy thông tin tồn kho từ Shopify, giả định là 0`);
      }
    } catch (error) {
      console.error(`[INVENTORY_CHECK] Lỗi khi lấy tồn kho hiện tại:`, error);
      return { changed: true, reason: 'error_fetching_current' };
    }
    
    // Lấy thông tin mới nhất từ Nhanh.vn
    let nhanhResponse;
    try {
      nhanhResponse = await getNhanhData(nhanhData.idNhanh, settings);
      
      if (nhanhResponse.code !== 1) {
        console.log(`[INVENTORY_CHECK] API Nhanh.vn trả về mã lỗi: ${nhanhResponse.code}`);
        return { changed: true, reason: 'nhanh_api_error' };
      }
    } catch (error) {
      console.error(`[INVENTORY_CHECK] Lỗi khi lấy dữ liệu từ Nhanh.vn:`, error);
      return { changed: true, reason: 'error_fetching_nhanh' };
    }
    
    // Tìm sản phẩm từ dữ liệu trả về
    let productData = null;
    if (nhanhResponse.data && nhanhResponse.data.products) {
      const products = nhanhResponse.data.products;
      
      // Tìm sản phẩm theo ID
      if (products[nhanhData.idNhanh]) {
        productData = products[nhanhData.idNhanh];
      } else {
        // Nếu không tìm thấy theo ID chính xác, kiểm tra tất cả sản phẩm
        for (const prodId in products) {
          if (products[prodId] && String(products[prodId].idNhanh) === nhanhData.idNhanh) {
            productData = products[prodId];
            break;
          }
        }
      }
    }
    
    if (!productData) {
      console.log(`[INVENTORY_CHECK] Không tìm thấy sản phẩm từ dữ liệu Nhanh.vn`);
      return { changed: true, reason: 'product_not_found' };
    }
    
    // Sử dụng hàm getInventoryQuantity để lấy số lượng từ productData
    const newInventory = getInventoryQuantity(productData, '175080', product.id);
    
    // So sánh giá trị mới và cũ
    const hasChanged = currentInventory !== newInventory;
    
    console.log(`[INVENTORY_CHECK] So sánh tồn kho: hiện tại=${currentInventory}, mới=${newInventory}, thay đổi=${hasChanged}`);
    
    return {
      changed: hasChanged,
      reason: hasChanged ? 'inventory_changed' : 'no_change',
      oldQuantity: currentInventory,
      newQuantity: newInventory
    };
  } catch (error) {
    console.error(`[INVENTORY_CHECK] Lỗi khi kiểm tra thay đổi tồn kho:`, error);
    return { changed: true, reason: 'check_error' };
  }
}

/**
 * Kiểm tra xem sản phẩm có cần đồng bộ tồn kho hay không
 * @param {Object} product - Thông tin sản phẩm
 * @param {Object} nhanhData - Dữ liệu từ Nhanh.vn
 * @returns {Object} - Kết quả kiểm tra với needsSync = true/false và lý do
 */
async function checkSyncNeeded(product, nhanhData, settings) {
  try {
    // Nếu sản phẩm có trạng thái lỗi, luôn cần đồng bộ lại
    if (product.status === 'error') {
      return { needsSync: true, reason: 'error_status' };
    }
    
    // Kiểm tra thời gian cập nhật gần đây
    const lastUpdated = new Date(product.updatedAt || product.createdAt);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
    
    // Sản phẩm mới cập nhật (< 24h) luôn được ưu tiên đồng bộ
    if (hoursSinceUpdate < 24) {
      return { needsSync: true, reason: 'recent_update' };
    }
    
    // Kiểm tra sự thay đổi về tồn kho trước khi quyết định đồng bộ
    const inventoryChangeResult = await checkInventoryChange(product, nhanhData, settings);
    if (inventoryChangeResult.changed) {
      return { needsSync: true, reason: 'inventory_changed' };
    }
    
    // Sản phẩm không cần đồng bộ ngay
    return { 
      needsSync: false, 
      reason: 'no_change',
      oldQuantity: inventoryChangeResult.oldQuantity,
      newQuantity: inventoryChangeResult.newQuantity
    };
    
  } catch (error) {
    console.error(`[Sync] Lỗi khi kiểm tra cần đồng bộ:`, error);
    // Nếu có lỗi, ưu tiên đồng bộ để đảm bảo dữ liệu
    return { needsSync: true, reason: 'check_error' };
  }
}

/**
 * Hàm đồng bộ tồn kho
 * @param {Object} product - Thông tin sản phẩm
 * @param {Object} nhanhData - Dữ liệu từ Nhanh.vn
 * @param {Object} settings - Cấu hình API
 * @param {string} username - Người thực hiện đồng bộ
 * @param {string} warehouseId - ID kho cần đồng bộ, mặc định là '175080'
 * @returns {Promise<Object>} - Kết quả đồng bộ
 */
async function syncInventory(product, nhanhData, settings, username = 'system', warehouseId = '175080') {
  // Debug logging
  console.log(`[SYNC DEBUG] syncInventory called for product ID: ${product?.id || 'undefined'}, variantId: ${product?.shopifyId || 'undefined'}, warehouseId: ${warehouseId}`);

  // Kiểm tra đầu vào
  if (!product || !product.id) {
    console.error('[ERROR] Sản phẩm không hợp lệ hoặc thiếu ID');
    throw new Error('Sản phẩm không hợp lệ hoặc thiếu ID');
  }

  // Kiểm tra settings
  if (!settings || !settings.shopify_store || !settings.shopify_access_token) {
    console.error(`[ERROR] Thiếu cấu hình Shopify cho sản phẩm ID: ${product.id}`);
    throw new Error('Thiếu thông tin cấu hình Shopify (store hoặc access token)');
  }

  try {
    // Kiểm tra xem sản phẩm có cần đồng bộ không
    const syncCheckResult = await checkSyncNeeded(product, nhanhData, settings);
    
    // Nếu không cần đồng bộ, trả về kết quả skipped
    if (!syncCheckResult.needsSync) {
      console.log(`[Sync] Bỏ qua đồng bộ sản phẩm ${product.id}, lý do: ${syncCheckResult.reason}`);
      return {
        skipped: true,
        reason: syncCheckResult.reason,
        oldQuantity: syncCheckResult.oldQuantity,
        newQuantity: syncCheckResult.newQuantity
      };
    }
    
    console.log(`[Sync] Sản phẩm ${product.id} cần đồng bộ, lý do: ${syncCheckResult.reason}`);

    // Parse dữ liệu Nhanh.vn nếu chưa parse
    if (!nhanhData && product.nhanhData) {
      try {
        nhanhData = typeof product.nhanhData === 'string' 
          ? JSON.parse(product.nhanhData) 
          : product.nhanhData;
      } catch (parseError) {
        console.error(`[ERROR] Lỗi parse nhanhData cho sản phẩm ${product.id}:`, parseError.message);
        nhanhData = { idNhanh: product.externalId || product.id };
      }
    }
    
    // Kiểm tra shopifyId
    if (!product.shopifyId) {
      throw new Error(`Sản phẩm ${product.id} thiếu shopifyId`);
    }
    
    console.log(`[API] Đang lấy thông tin biến thể Shopify cho sản phẩm ${product.id}, variant ID: ${product.shopifyId}`);
    
    try {
      // Lấy thông tin biến thể Shopify
      const shopifyVariant = await getShopifyProduct(product.shopifyId, settings);
      
      if (!shopifyVariant) {
        throw new Error(`Không tìm thấy biến thể Shopify với ID: ${product.shopifyId}`);
      }
      
      // Kiểm tra inventory_item_id
      if (!shopifyVariant.inventory_item_id) {
        throw new Error(`Biến thể ${product.shopifyId} không có inventory_item_id`);
      }
      
      const inventoryItemId = shopifyVariant.inventory_item_id;
      
      // Lấy số lượng tồn kho từ Nhanh.vn sử dụng hàm getInventoryQuantity
      const inventoryQuantity = getInventoryQuantity(nhanhData, warehouseId, product.id);
      console.log(`[API] Đồng bộ tồn kho cho biến thể ${product.shopifyId}: ${inventoryQuantity}`);
      
      // Cấu hình Shopify từ settings
      const SHOPIFY_STORE = settings.shopify_store;
      const SHOPIFY_ACCESS_TOKEN = settings.shopify_access_token;
      const SHOPIFY_LOCATION_ID = settings.shopify_location_id;
      
      // Lấy thông tin inventory hiện tại từ Shopify sử dụng callShopifyAPI
      const inventoryResponse = await callShopifyAPI(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        throw new Error(`Lỗi khi lấy thông tin tồn kho: ${inventoryResponse.status} - ${errorText}`);
      }
      
      const inventoryData = await inventoryResponse.json();
      const inventory = inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0 
        ? inventoryData.inventory_levels[0] 
        : null;
      
      // Nếu chưa có dữ liệu tồn kho, cần thiết lập lần đầu
      if (!inventory) {
        // Kiểm tra location_id từ settings
        if (!SHOPIFY_LOCATION_ID) {
          throw new Error('Không tìm thấy location_id cho việc thiết lập tồn kho');
        }
        
        // Tạo inventory levels mới
        const createResponse = await callShopifyAPI(
          `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              inventory_item_id: inventoryItemId,
              location_id: SHOPIFY_LOCATION_ID,
              available: inventoryQuantity
            })
          }
        );
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Lỗi khi thiết lập tồn kho ban đầu: ${createResponse.status} - ${errorText}`);
        }
        
        // Log thành công
        await prisma.syncLog.create({
          data: {
            productMappingId: product.id,
            action: 'sync_inventory',
            status: 'completed',
            message: `Đã thiết lập tồn kho ban đầu: ${inventoryQuantity}`,
            details: JSON.stringify({
              inventoryQuantity,
              inventoryItemId,
              locationId: SHOPIFY_LOCATION_ID
            }),
            createdBy: username
          }
        });
        
        // Cập nhật trạng thái sản phẩm về thành công
        await prisma.productMapping.update({
          where: { id: product.id },
          data: {
            status: 'success',
            errorMsg: null,
            updatedAt: new Date()
          }
        });
        
        return { success: true, inventoryQuantity, created: true };
      }
      
      // Nếu số lượng giống nhau, không cần cập nhật
      if (parseInt(inventory.available, 10) === inventoryQuantity) {
        console.log(`[API] Bỏ qua đồng bộ tồn kho cho ${product.shopifyId}: không thay đổi (${inventoryQuantity})`);
        
        // Tạo log bỏ qua
        await prisma.syncLog.create({
          data: {
            productMappingId: product.id,
            action: 'sync_inventory',
            status: 'skipped',
            message: `Bỏ qua đồng bộ tồn kho (không thay đổi)`,
            details: JSON.stringify({
              inventoryQuantity,
              shopifyInventory: inventory.available
            }),
            createdBy: username
          }
        });
        
        // Cập nhật trạng thái sản phẩm về thành công
        await prisma.productMapping.update({
          where: { id: product.id },
          data: {
            status: 'success',
            errorMsg: null,
            updatedAt: new Date()
          }
        });
        
        return { success: true, inventoryQuantity, skipped: true };
      }
      
      // Cập nhật tồn kho trên Shopify
      const updateResponse = await callShopifyAPI(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/inventory_levels/set.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inventory_item_id: inventoryItemId,
            location_id: inventory.location_id,
            available: inventoryQuantity
          })
        }
      );
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Lỗi khi cập nhật tồn kho: ${updateResponse.status} - ${errorText}`);
      }
      
      // Tạo log thành công
      await prisma.syncLog.create({
        data: {
          productMappingId: product.id,
          action: 'sync_inventory',
          status: 'completed',
          message: `Đã cập nhật tồn kho thành công: ${inventoryQuantity}`,
          details: JSON.stringify({
            inventoryQuantity,
            previousQuantity: inventory.available,
            inventoryItemId,
            locationId: inventory.location_id
          }),
          createdBy: username
        }
      });
      
      console.log(`[API] Đã cập nhật tồn kho thành công cho biến thể ${product.shopifyId}: ${inventoryQuantity}`);
      
      // Cập nhật trạng thái sản phẩm về thành công
      await prisma.productMapping.update({
        where: { id: product.id },
        data: {
          status: 'success',
          errorMsg: null,
          updatedAt: new Date()
        }
      });
      
      return { success: true, inventoryQuantity };
      
    } catch (variantError) {
      console.error(`[ERROR] Lỗi khi xử lý biến thể: ${variantError.message}`);
      throw variantError;
    }

  } catch (error) {
    // Xử lý lỗi và log
    console.error(`[ERROR] Lỗi đồng bộ tồn kho:`, error);
    
    // Cập nhật trạng thái lỗi cho sản phẩm
    if (product && product.id) {
      try {
        await prisma.productMapping.update({
          where: { id: product.id },
          data: {
            status: 'error',
            errorMsg: error.message || 'Lỗi không xác định'
          }
        });
      } catch (dbError) {
        console.error("Không thể cập nhật trạng thái sản phẩm:", dbError.message);
      }
    }
    
    // Tạo log lỗi
    try {
      await prisma.syncLog.create({
        data: {
          productMappingId: product?.id,
          action: 'sync_inventory',
          status: 'error',
          message: error.message || 'Lỗi không xác định',
          details: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
          createdBy: username
        }
      });
    } catch (logError) {
      console.error("Không thể tạo log lỗi:", logError.message);
    }
    
    throw error;
  }
}

/**
 * Hàm getPaginatedData - tự động lấy dữ liệu phân trang từ API
 * @param {string} baseUrl - URL cơ sở của API
 * @param {object} options - Tùy chọn fetch API (headers, method, v.v.)
 * @param {string} dataPath - Đường dẫn tới mảng dữ liệu trong response JSON
 * @param {object} queryParams - Các tham số truy vấn cơ bản
 * @param {number} pageSize - Số lượng items trên mỗi trang
 * @param {number} maxItems - Số lượng items tối đa cần lấy, mặc định là null (lấy tất cả)
 * @param {string} pageParam - Tên tham số phân trang, mặc định là 'page'
 * @param {Function} processor - Hàm xử lý dữ liệu tùy chọn cho mỗi item
 * @returns {Promise<Array>} - Mảng dữ liệu đã được phân trang
 */
async function getPaginatedData(
  baseUrl, 
  options = {}, 
  dataPath = 'data', 
  queryParams = {}, 
  pageSize = 100, 
  maxItems = null, 
  pageParam = 'page',
  processor = null
) {
  console.log(`Bắt đầu lấy dữ liệu phân trang từ ${baseUrl}`);
  
  let allData = [];
  let currentPage = 1;
  let hasMore = true;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  // Thêm pageSize vào queryParams
  const params = {
    ...queryParams,
    [pageParam]: currentPage,
    limit: pageSize
  };

  while (hasMore) {
    try {
      // Cập nhật số trang hiện tại trong params
      params[pageParam] = currentPage;
      
      // Tạo URL với query params
      const url = new URL(baseUrl);
      Object.keys(params).forEach(key => 
        url.searchParams.append(key, params[key])
      );
      
      console.log(`Đang tải trang ${currentPage} từ ${url.toString()}`);
      
      // Gọi API
      const response = await fetch(url.toString(), options);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
      }
      
      const responseData = await response.json();
      
      // Trích xuất dữ liệu từ đường dẫn được chỉ định
      const items = dataPath.split('.').reduce((obj, path) => obj && obj[path], responseData) || [];
      
      if (Array.isArray(items) && items.length > 0) {
        // Xử lý dữ liệu nếu có hàm processor
        const processedItems = processor ? items.map(processor) : items;
        allData = [...allData, ...processedItems];
        
        console.log(`Đã tải ${items.length} items từ trang ${currentPage}, tổng số: ${allData.length}`);
        
        // Kiểm tra nếu đã đạt đến số lượng tối đa
        if (maxItems !== null && allData.length >= maxItems) {
          allData = allData.slice(0, maxItems);
          hasMore = false;
          console.log(`Đã đạt số lượng tối đa ${maxItems} items`);
        } else if (items.length < pageSize) {
          // Không còn dữ liệu nếu số lượng items nhỏ hơn pageSize
          hasMore = false;
          console.log('Đã tải tất cả dữ liệu phân trang');
        } else {
          // Chuyển sang trang tiếp theo
          currentPage++;
          // Tạm dừng để tránh rate limit
          await sleep(500);
        }
      } else {
        // Không còn dữ liệu
        hasMore = false;
        console.log('Không có dữ liệu hoặc đã tải xong');
      }
      
      // Đặt lại số lần thử lại khi thành công
      retryCount = 0;
      
    } catch (error) {
      console.error(`Lỗi khi tải trang ${currentPage}:`, error);
      
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} sau ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        console.error(`Đã thử lại ${MAX_RETRIES} lần, dừng phân trang`);
        hasMore = false;
      }
    }
  }
  
  console.log(`Hoàn thành lấy dữ liệu phân trang, tổng số items: ${allData.length}`);
  return allData;
}

/**
 * Đồng bộ hóa sản phẩm từ API nguồn vào hệ thống
 * @param {object} settings - Cài đặt đồng bộ hóa
 * @param {object} logCallback - Callback để ghi log tiến trình
 * @param {function} updateProgress - Hàm cập nhật tiến độ
 * @returns {Promise<object>} - Kết quả đồng bộ hóa
 */
async function syncProducts(settings, logCallback = console.log, updateProgress = null) {
  try {
    const startTime = Date.now();
    logCallback(`Bắt đầu đồng bộ sản phẩm với cài đặt: ${JSON.stringify(settings, null, 2)}`);
    
    // Khởi tạo kết quả
    const result = {
      success: false,
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      time: 0
    };
    
    // Cập nhật tiến độ ban đầu
    if (updateProgress) {
      updateProgress({
        status: 'processing',
        progress: 0,
        message: 'Đang lấy dữ liệu sản phẩm từ API nguồn'
      });
    }
    
    // Lấy danh sách sản phẩm từ API nguồn
    const sourceProducts = await getPaginatedData(
      settings.sourceApiUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.sourceApiToken}`,
          'Content-Type': 'application/json'
        }
      },
      settings.sourceDataPath || 'data',
      settings.sourceQueryParams || {},
      settings.pageSize || 100,
      settings.maxItems || null
    );
    
    result.total = sourceProducts.length;
    logCallback(`Đã lấy ${result.total} sản phẩm từ API nguồn`);
    
    // Xử lý từng sản phẩm
    for (let i = 0; i < sourceProducts.length; i++) {
      const sourceProduct = sourceProducts[i];
      try {
        // Cập nhật tiến độ
        const progress = Math.round((i / result.total) * 100);
        if (updateProgress) {
          updateProgress({
            status: 'processing',
            progress: progress,
            message: `Đang xử lý sản phẩm ${i + 1}/${result.total}`
          });
        }
        
        // Kiểm tra sản phẩm đã tồn tại
        const productData = extractProductData(sourceProduct, settings.mappingRules);
        const productHash = createHash(productData);
        
        // Kiểm tra trong CSDL
        const existingProduct = await getExistingProduct(productData.externalId);
        
        if (existingProduct) {
          // Sản phẩm đã tồn tại, kiểm tra xem có cần cập nhật không
          if (existingProduct.hash !== productHash) {
            // Cập nhật sản phẩm
            await updateProduct(existingProduct.id, productData, productHash);
            logCallback(`Đã cập nhật sản phẩm: ${productData.name} (${productData.externalId})`);
            result.updated++;
          } else {
            // Sản phẩm không thay đổi
            logCallback(`Bỏ qua sản phẩm không thay đổi: ${productData.name} (${productData.externalId})`);
            result.skipped++;
          }
        } else {
          // Tạo sản phẩm mới
          await createProduct(productData, productHash);
          logCallback(`Đã tạo sản phẩm mới: ${productData.name} (${productData.externalId})`);
          result.created++;
        }
        
        result.processed++;
        
        // Chờ một khoảng thời gian nhỏ để tránh quá tải hệ thống
        if (i < sourceProducts.length - 1) {
          await sleep(settings.processingDelay || 100);
        }
      } catch (error) {
        result.failed++;
        const errorMsg = `Lỗi xử lý sản phẩm ${sourceProduct.id || i}: ${error.message}`;
        logCallback(errorMsg, 'error');
        result.errors.push(errorMsg);
      }
    }
    
    // Cập nhật tiến độ hoàn thành
    if (updateProgress) {
      updateProgress({
        status: 'completed',
        progress: 100,
        message: `Đã hoàn thành đồng bộ ${result.processed}/${result.total} sản phẩm`
      });
    }
    
    result.success = true;
    result.time = (Date.now() - startTime) / 1000;
    
    logCallback(`Hoàn thành đồng bộ sản phẩm sau ${result.time}s. Tổng cộng: ${result.total}, Đã xử lý: ${result.processed}, Tạo mới: ${result.created}, Cập nhật: ${result.updated}, Bỏ qua: ${result.skipped}, Lỗi: ${result.failed}`);
    
    return result;
  } catch (error) {
    logCallback(`Lỗi trong quá trình đồng bộ sản phẩm: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Lấy thông tin sản phẩm từ CSDL dựa trên ID bên ngoài
 * @param {string} externalId - ID sản phẩm từ hệ thống bên ngoài
 * @returns {Promise<object|null>} - Thông tin sản phẩm hoặc null nếu không tìm thấy
 */
async function getExistingProduct(externalId) {
  // Đoạn mã này sẽ được triển khai dựa trên cơ sở dữ liệu thực tế
  // Ví dụ với Prisma:
  try {
    // return await prisma.product.findUnique({
    //   where: { externalId }
    // });
    return null; // Chỉ để mô phỏng, bạn cần thay thế với mã thực tế
  } catch (error) {
    console.error(`Lỗi khi tìm sản phẩm ${externalId}:`, error);
    return null;
  }
}

/**
 * Tạo mới sản phẩm trong CSDL
 * @param {object} productData - Dữ liệu sản phẩm
 * @param {string} hash - Mã hash của dữ liệu sản phẩm
 * @returns {Promise<object>} - Sản phẩm đã tạo
 */
async function createProduct(productData, hash) {
  // Đoạn mã này sẽ được triển khai dựa trên cơ sở dữ liệu thực tế
  // Ví dụ với Prisma:
  try {
    // return await prisma.product.create({
    //   data: {
    //     ...productData,
    //     hash
    //   }
    // });
    return { id: 'new-product-id', ...productData, hash }; // Chỉ để mô phỏng
  } catch (error) {
    console.error(`Lỗi khi tạo sản phẩm:`, error);
    throw error;
  }
}

/**
 * Cập nhật sản phẩm trong CSDL
 * @param {string} id - ID của sản phẩm trong CSDL
 * @param {object} productData - Dữ liệu sản phẩm cập nhật
 * @param {string} hash - Mã hash mới của dữ liệu sản phẩm
 * @returns {Promise<object>} - Sản phẩm đã cập nhật
 */
async function updateProduct(id, productData, hash) {
  // Đoạn mã này sẽ được triển khai dựa trên cơ sở dữ liệu thực tế
  // Ví dụ với Prisma:
  try {
    // return await prisma.product.update({
    //   where: { id },
    //   data: {
    //     ...productData,
    //     hash
    //   }
    // });
    return { id, ...productData, hash }; // Chỉ để mô phỏng
  } catch (error) {
    console.error(`Lỗi khi cập nhật sản phẩm ${id}:`, error);
    throw error;
  }
}

/**
 * Đồng bộ hóa đơn hàng từ Shopify
 * @param {Object} settings - Cấu hình API Shopify
 * @param {Function} logCallback - Hàm ghi log
 * @param {Function} updateProgress - Hàm cập nhật tiến trình
 * @returns {Promise<Object>} Kết quả đồng bộ
 */
async function syncOrders(settings, logCallback = console.log, updateProgress = () => {}) {
  const result = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  try {
    logCallback('Bắt đầu đồng bộ đơn hàng từ Shopify');
    updateProgress(0);

    // Lấy danh sách đơn hàng từ Shopify
    const orders = await getPaginatedData({
      settings,
      endpoint: 'orders.json',
      params: 'status=any&limit=100',
      resultsKey: 'orders',
      pageSize: 100,
      logCallback,
      processor: (data) => {
        const processedOrders = data.map(order => ({
          id: order.id,
          shopifyId: order.id.toString(),
          orderId: order.name,
          orderNumber: order.order_number,
          email: order.email,
          totalPrice: parseFloat(order.total_price),
          subtotalPrice: parseFloat(order.subtotal_price),
          totalTax: parseFloat(order.total_tax),
          currency: order.currency,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          customer: order.customer ? {
            id: order.customer.id,
            email: order.customer.email,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
            phone: order.customer.phone
          } : null,
          lineItems: order.line_items ? order.line_items.map(item => ({
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.title,
            quantity: item.quantity,
            price: parseFloat(item.price),
            sku: item.sku || '',
            name: item.name || item.title
          })) : [],
          shippingAddress: order.shipping_address ? {
            firstName: order.shipping_address.first_name,
            lastName: order.shipping_address.last_name,
            address1: order.shipping_address.address1,
            address2: order.shipping_address.address2,
            city: order.shipping_address.city,
            province: order.shipping_address.province,
            country: order.shipping_address.country,
            zip: order.shipping_address.zip,
            phone: order.shipping_address.phone
          } : null
        }));
        return processedOrders;
      }
    });

    result.total = orders.length;
    logCallback(`Tìm thấy ${orders.length} đơn hàng từ Shopify`);

    // Lấy danh sách đơn hàng đã tồn tại trong hệ thống
    const existingOrders = await getExistingOrders(orders.map(order => order.shopifyId));
    const existingOrdersMap = new Map();
    existingOrders.forEach(order => existingOrdersMap.set(order.shopifyId, order));

    // Xử lý từng đơn hàng
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      try {
        const existingOrder = existingOrdersMap.get(order.shopifyId);

        if (existingOrder) {
          // Cập nhật đơn hàng nếu đã tồn tại
          await updateOrder(existingOrder.id, order);
          result.updated++;
          logCallback(`Cập nhật đơn hàng: ${order.orderId}`);
        } else {
          // Tạo đơn hàng mới nếu chưa tồn tại
          await createOrder(order);
          result.created++;
          logCallback(`Tạo mới đơn hàng: ${order.orderId}`);
        }

        // Cập nhật tiến trình
        updateProgress(Math.floor(((i + 1) / orders.length) * 100));
        
        // Nghỉ một chút để tránh quá tải hệ thống
        if (i % 10 === 0) {
          await sleep(1000);
        }
      } catch (error) {
        result.errors++;
        result.errorDetails.push({
          orderId: order.orderId,
          error: error.message
        });
        logCallback(`Lỗi khi xử lý đơn hàng ${order.orderId}: ${error.message}`);
      }
    }

    logCallback(`Hoàn thành đồng bộ đơn hàng. Tạo mới: ${result.created}, Cập nhật: ${result.updated}, Lỗi: ${result.errors}`);
    return result;
  } catch (error) {
    logCallback(`Lỗi khi đồng bộ đơn hàng: ${error.message}`);
    throw error;
  }
}

/**
 * Lấy danh sách đơn hàng đã tồn tại trong hệ thống
 * @param {Array<string>} shopifyIds - Danh sách ID đơn hàng trên Shopify
 * @returns {Promise<Array>} Danh sách đơn hàng
 */
async function getExistingOrders(shopifyIds) {
  try {
    const { prisma } = getPrismaClient();
    const orders = await prisma.orders.findMany({
      where: {
        shopifyId: {
          in: shopifyIds
        }
      }
    });
    return orders;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error);
    return [];
  }
}

/**
 * Tạo đơn hàng mới trong hệ thống
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @returns {Promise<Object>} Đơn hàng đã tạo
 */
async function createOrder(orderData) {
  try {
    const { prisma } = getPrismaClient();
    
    // Tạo đơn hàng
    const order = await prisma.orders.create({
      data: {
        shopifyId: orderData.shopifyId,
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        email: orderData.email,
        totalPrice: orderData.totalPrice,
        subtotalPrice: orderData.subtotalPrice,
        totalTax: orderData.totalTax,
        currency: orderData.currency,
        financialStatus: orderData.financialStatus,
        fulfillmentStatus: orderData.fulfillmentStatus,
        customerDetails: orderData.customer ? JSON.stringify(orderData.customer) : null,
        shippingDetails: orderData.shippingAddress ? JSON.stringify(orderData.shippingAddress) : null,
        lineItems: JSON.stringify(orderData.lineItems),
        createdAt: orderData.createdAt,
        updatedAt: orderData.updatedAt
      }
    });
    
    return order;
  } catch (error) {
    console.error('Lỗi khi tạo đơn hàng:', error);
    throw error;
  }
}

/**
 * Cập nhật đơn hàng trong hệ thống
 * @param {number} id - ID đơn hàng trong hệ thống
 * @param {Object} orderData - Dữ liệu đơn hàng mới
 * @returns {Promise<Object>} Đơn hàng đã cập nhật
 */
async function updateOrder(id, orderData) {
  try {
    const { prisma } = getPrismaClient();
    
    // Cập nhật đơn hàng
    const order = await prisma.orders.update({
      where: {
        id: id
      },
      data: {
        email: orderData.email,
        totalPrice: orderData.totalPrice,
        subtotalPrice: orderData.subtotalPrice,
        totalTax: orderData.totalTax,
        financialStatus: orderData.financialStatus,
        fulfillmentStatus: orderData.fulfillmentStatus,
        customerDetails: orderData.customer ? JSON.stringify(orderData.customer) : null,
        shippingDetails: orderData.shippingAddress ? JSON.stringify(orderData.shippingAddress) : null,
        lineItems: JSON.stringify(orderData.lineItems),
        updatedAt: orderData.updatedAt
      }
    });
    
    return order;
  } catch (error) {
    console.error('Lỗi khi cập nhật đơn hàng:', error);
    throw error;
  }
}

/**
 * Đồng bộ hóa hàng loạt sản phẩm
 * @param {Array} products - Danh sách sản phẩm cần đồng bộ
 * @param {Object} settings - Cấu hình API
 * @param {string} username - Người thực hiện đồng bộ
 * @param {string} warehouseId - ID kho cần đồng bộ, mặc định là '175080'
 * @returns {Promise<Object>} - Kết quả đồng bộ
 */
async function batchSyncInventory(products, settings, username = 'system', warehouseId = '175080') {
  const batchId = `BatchSync_${Date.now()}`;
  console.time(batchId);
  
  const results = {
    total: products.length,
    success: 0,
    skipped: 0, 
    error: 0,
    details: []
  };
  
  // Triển khai xử lý song song với giới hạn đồng thời
  const CONCURRENT_LIMIT = 5; // Giảm số lượng xử lý đồng thời để tránh lỗi
  const queue = [...products]; // Danh sách sản phẩm chờ xử lý
  const executing = new Set(); // Các promises đang thực thi
  
  // Hàm tạo và thực thi promise cho một sản phẩm
  const enqueue = async (product) => {
    // Tạo promise xử lý sản phẩm
    const promise = (async () => {
      try {
        // Parse nhanhData trước
        let nhanhData = null;
        try {
          if (product.nhanhData) {
            nhanhData = typeof product.nhanhData === 'string' 
              ? JSON.parse(product.nhanhData) 
              : product.nhanhData;
          }
        } catch (e) {
          console.error(`[ERROR] Lỗi parse nhanhData cho sản phẩm ${product.id}:`, e.message);
        }
        
        const result = await syncInventory(product, nhanhData, settings, username, warehouseId);
        if (result.skipped) {
          results.skipped++;
        } else {
          results.success++;
        }
        return { id: product.id, success: true, skipped: !!result.skipped };
      } catch (error) {
        results.error++;
        return { id: product.id, success: false, error: error.message };
      } finally {
        // Xóa khỏi danh sách đang thực thi khi hoàn thành
        executing.delete(promise);
        // Tiếp tục xử lý sản phẩm tiếp theo nếu còn
        if (queue.length) {
          enqueue(queue.shift());
        }
      }
    })();
    
    // Thêm vào danh sách đang thực thi
    executing.add(promise);
    return promise;
  };
  
  // Bắt đầu xử lý song song với số lượng giới hạn
  const initialBatch = Math.min(CONCURRENT_LIMIT, queue.length);
  const initialPromises = [];
  
  for (let i = 0; i < initialBatch; i++) {
    if (queue.length) {
      initialPromises.push(enqueue(queue.shift()));
    }
  }
  
  // Chờ tất cả các promises hoàn thành
  await Promise.all(initialPromises);
  
  // Đảm bảo chờ tất cả các promises còn lại
  if (executing.size) {
    await Promise.all(executing);
  }
  
  console.timeEnd(batchId);
  return results;
}

module.exports = {
  getNhanhData,
  sleep,
  callShopifyAPI,
  getShopifyProduct,
  syncInventory,
  syncMetrics,
  createHash,
  hasInventoryChanged,
  getPaginatedData,
  syncProducts,
  syncOrders,
  getExistingOrders,
  createOrder,
  updateOrder,
  batchSyncInventory,
  apiCache,
  circuitBreaker
}; 