const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Kiểm tra cảnh báo hệ thống
 */
async function checkAlerts() {
  try {
    console.log('\n===== KIỂM TRA CẢNH BÁO HỆ THỐNG =====');
    
    // Lấy cảnh báo lỗi gần nhất
    const lastErrorAlert = await prisma.setting.findUnique({
      where: { key: 'last_sync_error_alert' }
    });
    
    // Lấy thông tin hiệu suất gần nhất
    const lastSyncPerformance = await prisma.setting.findUnique({
      where: { key: 'last_sync_performance' }
    });
    
    // Lấy trạng thái worker
    const workerStatus = await prisma.setting.findUnique({
      where: { key: 'worker_status' }
    });
    
    // Hiển thị cảnh báo lỗi
    if (lastErrorAlert && lastErrorAlert.value) {
      try {
        const alertData = JSON.parse(lastErrorAlert.value);
        const alertTime = new Date(alertData.timestamp);
        const now = new Date();
        const minutesAgo = Math.floor((now - alertTime) / (1000 * 60));
        
        console.log('\n=== CẢNH BÁO GẦN NHẤT ===');
        console.log(`Thời gian: ${alertTime.toLocaleString()} (cách đây ${minutesAgo} phút)`);
        console.log(`Nội dung: ${alertData.message}`);
        console.log(`Số lỗi: ${alertData.errorCount}`);
        
        // Kiểm tra cảnh báo có quá cũ không (> 1 giờ)
        if (minutesAgo > 60) {
          console.log('\n✅ Không có cảnh báo mới trong vòng 1 giờ qua.');
        } else {
          console.log('\n⚠️ Có cảnh báo trong vòng 1 giờ qua. Cần kiểm tra hệ thống!');
        }
      } catch (e) {
        console.error(`Lỗi khi phân tích dữ liệu cảnh báo: ${e.message}`);
      }
    } else {
      console.log('\n✅ Chưa có cảnh báo nào được ghi nhận.');
    }
    
    // Hiển thị hiệu suất gần nhất
    if (lastSyncPerformance && lastSyncPerformance.value) {
      try {
        const perfData = JSON.parse(lastSyncPerformance.value);
        
        console.log('\n=== HIỆU SUẤT GẦN NHẤT ===');
        if (perfData.totalTime) {
          console.log(`Tổng thời gian: ${perfData.totalTime}ms`);
        }
        if (perfData.totalItems) {
          console.log(`Số lượng sản phẩm: ${perfData.totalItems}`);
        }
        if (perfData.avgBatchTime) {
          console.log(`Thời gian trung bình/batch: ${perfData.avgBatchTime}ms`);
        }
        
        // Phân tích hiệu suất
        if (perfData.totalTime && perfData.totalItems) {
          const avgItemTime = perfData.totalTime / perfData.totalItems;
          console.log(`Thời gian trung bình/sản phẩm: ${avgItemTime.toFixed(2)}ms`);
          
          if (avgItemTime > 1500) {
            console.log('⚠️ Hiệu suất xử lý sản phẩm thấp. Có thể cần tối ưu hóa.');
          } else {
            console.log('✅ Hiệu suất xử lý sản phẩm ổn định.');
          }
        }
      } catch (e) {
        console.error(`Lỗi khi phân tích dữ liệu hiệu suất: ${e.message}`);
      }
    }
    
    // Hiển thị trạng thái worker
    if (workerStatus && workerStatus.value) {
      try {
        const status = JSON.parse(workerStatus.value);
        
        console.log('\n=== TRẠNG THÁI WORKER ===');
        console.log(`Trạng thái: ${status.isRunning ? '🟢 Đang chạy' : '🔴 Đã dừng'}`);
        
        if (status.lastCheckTime) {
          const lastCheck = new Date(status.lastCheckTime);
          const now = new Date();
          const minutesAgo = Math.floor((now - lastCheck) / (1000 * 60));
          
          console.log(`Kiểm tra cuối: ${lastCheck.toLocaleString()} (cách đây ${minutesAgo} phút)`);
          
          if (minutesAgo > 10) {
            console.log('⚠️ Worker không hoạt động trong 10 phút qua. Có thể cần khởi động lại.');
          } else {
            console.log('✅ Worker đang hoạt động bình thường.');
          }
        }
        
        if (status.pendingJobs !== undefined) {
          console.log(`Tác vụ đang chờ: ${status.pendingJobs}`);
        }
        if (status.activeJobs !== undefined) {
          console.log(`Tác vụ đang xử lý: ${status.activeJobs}`);
        }
      } catch (e) {
        console.error(`Lỗi khi phân tích dữ liệu trạng thái worker: ${e.message}`);
      }
    }
    
    // Lấy thống kê tác vụ
    const taskCount = await prisma.syncLog.count();
    const pendingTaskCount = await prisma.syncLog.count({
      where: {
        status: 'pending'
      }
    });
    const processingTaskCount = await prisma.syncLog.count({
      where: {
        status: 'processing'
      }
    });
    const errorTaskCount = await prisma.syncLog.count({
      where: {
        status: 'error'
      }
    });
    
    console.log('\n=== THỐNG KÊ TÁC VỤ ===');
    console.log(`Tổng số tác vụ: ${taskCount}`);
    console.log(`Đang chờ: ${pendingTaskCount}`);
    console.log(`Đang xử lý: ${processingTaskCount}`);
    console.log(`Lỗi: ${errorTaskCount}`);
    
    if (processingTaskCount > 0) {
      // Kiểm tra xem có tác vụ bị treo không
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      
      const stuckTasks = await prisma.syncLog.findMany({
        where: {
          status: 'processing',
          createdAt: {
            lt: fiveMinutesAgo
          }
        },
        take: 5
      });
      
      if (stuckTasks.length > 0) {
        console.log('\n⚠️ Phát hiện tác vụ có thể bị treo (đang xử lý > 5 phút):');
        stuckTasks.forEach(task => {
          console.log(`- ID: ${task.id}, ${task.action}, Tạo lúc: ${task.createdAt.toLocaleString()}`);
        });
      }
    }
    
    console.log('\n===== KẾT THÚC KIỂM TRA =====');
  } catch (error) {
    console.error('Lỗi khi kiểm tra cảnh báo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi
checkAlerts();