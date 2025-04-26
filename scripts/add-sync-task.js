// Script thêm hoặc cập nhật tác vụ đồng bộ
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateExistingSyncTask() {
  try {
    console.log('Đang kiểm tra các tác vụ đồng bộ hiện có...');
    
    // Kiểm tra các tác vụ đồng bộ hiện có
    const existingSyncLogs = await prisma.syncLog.findMany({
      where: {
        action: {
          startsWith: 'sync_'
        }
      },
      orderBy: {
        id: 'desc'
      },
      take: 5
    });
    
    console.log('Các tác vụ đồng bộ hiện có:', existingSyncLogs.map(log => ({
      id: log.id,
      action: log.action,
      status: log.status
    })));
    
    // Nếu có tác vụ hiện có, cập nhật trạng thái của tác vụ đầu tiên thành pending
    if (existingSyncLogs.length > 0) {
      const updatedLog = await prisma.syncLog.update({
        where: {
          id: existingSyncLogs[0].id
        },
        data: {
          status: 'pending',
          message: 'Sẵn sàng đồng bộ lại',
          details: JSON.stringify({
            updated: new Date().toISOString()
          })
        }
      });
      
      console.log(`Đã cập nhật tác vụ đồng bộ với ID: ${updatedLog.id} thành trạng thái 'pending'`);
    } else {
      // Tạo một bản ghi mới nếu không có bản ghi nào
      const syncLog = await prisma.syncLog.create({
        data: {
          action: 'sync_all',
          status: 'pending',
          message: 'Đồng bộ tất cả dữ liệu',
          createdBy: 'system',
          details: JSON.stringify({
            created: new Date().toISOString()
          })
        }
      });
      
      console.log(`Đã thêm tác vụ đồng bộ mới với ID: ${syncLog.id}`);
    }
    
    // Kiểm tra lại sau khi thêm/cập nhật
    const pendingTasks = await prisma.syncLog.findMany({
      where: {
        status: 'pending'
      }
    });
    
    console.log(`Hiện có ${pendingTasks.length} tác vụ với trạng thái 'pending':`);
    console.log(pendingTasks.map(task => ({
      id: task.id,
      action: task.action,
      status: task.status
    })));
    
    // Đóng kết nối
    await prisma.$disconnect();
  } catch (error) {
    console.error('Lỗi khi cập nhật tác vụ đồng bộ:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Chạy hàm
updateExistingSyncTask(); 