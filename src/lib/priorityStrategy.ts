import prisma from './prisma';

// Interface cho sản phẩm với điểm ưu tiên
interface PrioritizedProduct {
  product: any;
  priorityScore: number;
}

/**
 * Tính toán điểm ưu tiên dựa trên nhiều yếu tố
 */
export function calculatePriorityScore(product: any): number {
  let score = 0;
  
  // Trạng thái lỗi có điểm ưu tiên cao nhất
  if (product.status === 'error') {
    score += 100;
  }
  
  // Thời gian cập nhật gần đây
  const lastUpdated = new Date(product.updatedAt || product.createdAt);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate < 1) {
    // Cập nhật trong vòng 1 giờ qua
    score += 50;
  } else if (hoursSinceUpdate < 3) {
    // Cập nhật trong vòng 3 giờ qua
    score += 40;
  } else if (hoursSinceUpdate < 24) {
    // Cập nhật trong vòng 24 giờ qua
    score += 30;
  }
  
  // Sản phẩm mới tạo
  const daysSinceCreation = (now.getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 1) {
    score += 30;
  }
  
  // Phân tích dữ liệu Nhanh.vn nếu có
  try {
    let nhanhData = null;
    if (product.nhanhData) {
      nhanhData = typeof product.nhanhData === 'string' 
        ? JSON.parse(product.nhanhData) 
        : product.nhanhData;
      
      // Sản phẩm có tồn kho thấp (dưới 5)
      if (nhanhData.inventory !== undefined && nhanhData.inventory < 5) {
        score += 20;
      }
      
      // Sản phẩm đắt tiền
      if (nhanhData.price !== undefined && nhanhData.price > 1000000) {
        score += 10;
      }
    }
  } catch (error) {
    // Lỗi khi phân tích dữ liệu sẽ không ảnh hưởng đến điểm
  }
  
  return score;
}

/**
 * Lấy danh sách sản phẩm đã được ưu tiên
 */
export async function getPrioritizedProducts(
  products: any[], 
  limit: number = 0
): Promise<any[]> {
  if (!products || products.length === 0) return [];
  
  // Tính điểm ưu tiên cho mỗi sản phẩm
  const prioritizedProducts: PrioritizedProduct[] = products.map(product => ({
    product,
    priorityScore: calculatePriorityScore(product)
  }));
  
  // Sắp xếp theo điểm ưu tiên giảm dần
  prioritizedProducts.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Ghi log về chiến lược ưu tiên
  console.log('[Priority] Đã sắp xếp ' + products.length + ' sản phẩm theo ưu tiên');
  console.log('[Priority] Top 5 sản phẩm có điểm cao nhất:');
  prioritizedProducts.slice(0, 5).forEach((item, index) => {
    console.log(`[Priority] #${index + 1}: ID ${item.product.id}, Điểm: ${item.priorityScore}`);
  });
  
  // Chỉ trả về số lượng giới hạn nếu có yêu cầu
  const result = prioritizedProducts.map(item => item.product);
  if (limit > 0 && limit < result.length) {
    return result.slice(0, limit);
  }
  
  return result;
}

/**
 * Tìm và lấy các sản phẩm cần ưu tiên dựa trên nhiều tiêu chí
 */
export async function findPriorityProducts(
  syncType: 'inventory' | 'price' | 'all' = 'all',
  limit: number = 50
): Promise<any[]> {
  try {
    // Lấy các sản phẩm lỗi
    const errorProducts = await prisma.productMapping.findMany({
      where: {
        status: 'error'
      },
      take: limit
    });
    
    if (errorProducts.length >= limit) {
      return getPrioritizedProducts(errorProducts, limit);
    }
    
    // Lấy sản phẩm mới cập nhật trong 24h qua
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const recentProducts = await prisma.productMapping.findMany({
      where: {
        updatedAt: {
          gte: oneDayAgo
        },
        status: {
          not: 'error' // Loại bỏ sản phẩm lỗi đã lấy ở trên
        }
      },
      take: limit - errorProducts.length
    });
    
    const combinedProducts = [...errorProducts, ...recentProducts];
    
    if (combinedProducts.length >= limit) {
      return getPrioritizedProducts(combinedProducts, limit);
    }
    
    // Lấy thêm sản phẩm bình thường nếu chưa đủ
    const normalProducts = await prisma.productMapping.findMany({
      where: {
        id: {
          notIn: combinedProducts.map(p => p.id)
        }
      },
      take: limit - combinedProducts.length
    });
    
    return getPrioritizedProducts([...combinedProducts, ...normalProducts], limit);
  } catch (error) {
    console.error('[Priority] Lỗi khi tìm sản phẩm ưu tiên:', error);
    return [];
  }
} 