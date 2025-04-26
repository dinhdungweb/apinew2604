// Script giám sát tác vụ đồng bộ
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function monitorAndProcessTasks() {
  try {
    console.log('===== GIÁM SÁT TÁC VỤ ĐỒNG BỘ =====');
    console.log('Thời gian hiện tại:', new Date().toLocaleString());
    
    // 1. Kiểm tra tất cả tác vụ đồng bộ
    const allTasks = await prisma.syncLog.findMany({
      orderBy: {
        id: 'desc'
      },
      take: 10
    });
    
    console.log(`\nCó ${allTasks.length} tác vụ gần đây nhất:`);
    console.table(allTasks.map(task => ({
      ID: task.id,
      Action: task.action,
      Status: task.status,
      Message: task.message,
      Created: task.createdAt
    })));
    
    // 2. Kiểm tra tác vụ pending
    const pendingTasks = await prisma.syncLog.findMany({
      where: {
        status: 'pending'
      }
    });
    
    console.log(`\nCó ${pendingTasks.length} tác vụ đang có trạng thái 'pending':`);
    
    if (pendingTasks.length > 0) {
      console.table(pendingTasks.map(task => ({
        ID: task.id,
        Action: task.action,
        Status: task.status,
        Created: task.createdAt
      })));
      
      // 3. Xử lý tác vụ đầu tiên trong danh sách pending
      const taskToProcess = pendingTasks[0];
      console.log(`\nĐang xử lý tác vụ ID: ${taskToProcess.id}, Action: ${taskToProcess.action}...`);
      
      // Cập nhật trạng thái thành processing
      const updatedTask = await prisma.syncLog.update({
        where: {
          id: taskToProcess.id
        },
        data: {
          status: 'processing',
          message: `Đang xử lý ${taskToProcess.action.replace('sync_', '')}`,
          details: JSON.stringify({
            processing_started: new Date().toISOString()
          })
        }
      });
      
      console.log(`Đã cập nhật trạng thái tác vụ ID: ${updatedTask.id} thành 'processing'`);
      
      // Mô phỏng việc xử lý (đợi 2 giây)
      console.log('Đang xử lý...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Cập nhật trạng thái thành completed
      const completedTask = await prisma.syncLog.update({
        where: {
          id: taskToProcess.id
        },
        data: {
          status: 'completed',
          message: `Đã hoàn thành ${taskToProcess.action.replace('sync_', '')}`,
          details: JSON.stringify({
            processing_started: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
        }
      });
      
      console.log(`Đã hoàn thành tác vụ ID: ${completedTask.id}`);
    } else {
      console.log('Không có tác vụ pending nào cần xử lý.');
      
      // Tạo một tác vụ mới nếu không có tác vụ pending
      console.log('\nTạo một tác vụ mới với trạng thái pending...');
      
      const newTask = await prisma.syncLog.create({
        data: {
          action: 'sync_inventory',
          status: 'pending',
          message: 'Chờ đồng bộ tồn kho',
          createdBy: 'monitor_script',
          details: JSON.stringify({
            created_at: new Date().toISOString()
          })
        }
      });
      
      console.log(`Đã tạo tác vụ mới ID: ${newTask.id}`);
    }
    
    // 4. Thống kê cuối cùng
    const stats = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count 
      FROM \`syncLog\` 
      GROUP BY status
    `;
    
    console.log('\nThống kê trạng thái:');
    console.table(stats);
    
    // Đóng kết nối
    await prisma.$disconnect();
    
    console.log('\n===== KẾT THÚC GIÁM SÁT =====');
  } catch (error) {
    console.error('Lỗi khi giám sát tác vụ:', error);
    await prisma.$disconnect();
  }
}

// Chạy hàm
monitorAndProcessTasks(); 