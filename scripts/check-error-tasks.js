const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeTaskPerformance() {
  try {
    // Tìm các task lỗi gần đây
    const errorTasks = await prisma.syncLog.findMany({
      where: {
        status: 'error'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n=== TASK LỖI GẦN ĐÂY (${errorTasks.length}) ===`);
    for (const task of errorTasks) {
      console.log(`ID: ${task.id} | ${task.action} | ${task.message} | ${task.createdAt}`);
    }

    // So sánh thời gian hoàn thành giữa các task
    console.log(`\n=== SO SÁNH THỜI GIAN HOÀN THÀNH ===`);
    
    // Lấy các task hoàn thành sắp xếp theo thời gian
    const completedTasks = await prisma.syncLog.findMany({
      where: {
        status: 'completed',
        action: 'sync_inventory'
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 20
    });

    let previousTime = 0;
    let showChanges = false;

    for (const task of completedTasks) {
      try {
        const details = JSON.parse(task.details || '{}');
        let completionTime = 0;
        
        if (details.performance?.totalTime) {
          completionTime = details.performance.totalTime;
        } else if (details.performance?.duration) {
          completionTime = details.performance.duration;
        }
        
        if (completionTime > 0) {
          const changePercent = previousTime > 0 
            ? ((completionTime - previousTime) / previousTime * 100).toFixed(2) 
            : 'N/A';
          
          const trend = previousTime > 0 
            ? (completionTime > previousTime ? '🔴 +' : '🟢 ') 
            : '';
          
          console.log(`ID: ${task.id} | ${new Date(task.createdAt).toLocaleString()} | ${completionTime}ms | ${trend}${changePercent}%`);
          
          previousTime = completionTime;
          showChanges = true;
        }
      } catch (e) {
        console.log(`ID: ${task.id} | Không thể phân tích metrics`);
      }
    }

    if (!showChanges) {
      console.log("Không đủ dữ liệu để so sánh thời gian hoàn thành");
    }

    // Kiểm tra task có totals để xem cải thiện về số lượng sản phẩm xử lý
    console.log(`\n=== HIỆU SUẤT XỬ LÝ SẢN PHẨM ===`);
    const batchTasks = await prisma.syncLog.findMany({
      where: {
        details: {
          contains: 'totalItems'
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 10
    });

    for (const task of batchTasks) {
      try {
        const details = JSON.parse(task.details || '{}');
        if (details.performance && details.performance.totalItems) {
          const totalItems = details.performance.totalItems;
          const totalTime = details.performance.totalTime || details.performance.duration || 0;
          const itemsPerSecond = totalTime > 0 ? (totalItems / (totalTime / 1000)).toFixed(2) : 'N/A';
          
          console.log(`ID: ${task.id} | ${task.action} | ${new Date(task.createdAt).toLocaleString()}`);
          console.log(`   Sản phẩm: ${totalItems} | Thời gian: ${totalTime}ms | Tốc độ: ${itemsPerSecond} sản phẩm/giây`);
        }
      } catch (e) {
        // Bỏ qua task không có dữ liệu phù hợp
      }
    }

  } catch (error) {
    console.error(`Lỗi: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeTaskPerformance(); 