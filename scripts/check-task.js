const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Lấy thông tin và trạng thái của task
 * @param {number|string} taskId - ID của task cần kiểm tra
 * @returns {Promise<object>} - Kết quả kiểm tra
 */
async function getTaskStatus(taskId) {
  try {
    // Chuyển đổi taskId sang số nguyên nếu cần
    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) {
      throw new Error('Task ID phải là một số nguyên');
    }

    console.log(`Đang kiểm tra task với ID: ${numericTaskId}`);

    // Truy vấn thông tin task từ CSDL
    const task = await prisma.syncLog.findUnique({
      where: {
        id: numericTaskId
      }
    });

    if (!task) {
      throw new Error(`Không tìm thấy task với ID: ${numericTaskId}`);
    }

    // In thông tin task
    console.log('\n=== THÔNG TIN TASK ===');
    console.log(`ID: ${task.id}`);
    console.log(`Hành động: ${task.action}`);
    console.log(`Trạng thái: ${task.status || 'Chưa có trạng thái'}`);
    console.log(`Thông báo: ${task.message || 'N/A'}`);
    console.log(`Tạo bởi: ${task.createdBy || 'N/A'}`);
    console.log(`Thời gian tạo: ${task.createdAt}`);
    
    // Phân tích details nếu có
    if (task.details) {
      try {
        const details = JSON.parse(task.details);
        console.log('\n=== CHI TIẾT TASK ===');
        console.log(JSON.stringify(details, null, 2));
      } catch (e) {
        console.log('\n=== CHI TIẾT TASK (raw) ===');
        console.log(task.details);
      }
    }

    await printTaskSummary();
    return { task };
  } catch (error) {
    console.error(`Lỗi: ${error.message}`);
    throw error;
  }
}

/**
 * Hiển thị tóm tắt các task
 */
async function printTaskSummary() {
  try {
    // Lấy số lượng task theo trạng thái
    const taskCounts = await prisma.syncLog.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Tạo bản tóm tắt
    const summary = {
      total: 0,
      completed: 0,
      processing: 0,
      pending: 0,
      failed: 0,
      skipped: 0
    };

    taskCounts.forEach(item => {
      const count = item._count.status;
      summary.total += count;
      
      switch(item.status) {
        case 'completed':
          summary.completed = count;
          break;
        case 'processing':
          summary.processing = count;
          break;
        case 'pending':
          summary.pending = count;
          break;
        case 'failed':
          summary.failed = count;
          break;
        case 'skipped':
          summary.skipped = count;
          break;
      }
    });

    // In bản tóm tắt
    console.log('\n=== TÓM TẮT TASK ===');
    console.log(`Tổng số: ${summary.total}`);
    console.log(`Hoàn thành: ${summary.completed}`);
    console.log(`Đang xử lý: ${summary.processing}`);
    console.log(`Đang chờ: ${summary.pending}`);
    console.log(`Thất bại: ${summary.failed}`);
    console.log(`Bỏ qua: ${summary.skipped}`);

    return summary;
  } catch (error) {
    console.error(`Lỗi khi lấy tóm tắt task: ${error.message}`);
    return null;
  }
}

/**
 * Liệt kê các task mới nhất
 * @param {number} limit - Số lượng task cần liệt kê
 */
async function listLatestTasks(limit = 10) {
  try {
    const tasks = await prisma.syncLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    console.log(`\n=== ${limit} TASK MỚI NHẤT ===`);
    
    if (tasks.length === 0) {
      console.log('Không tìm thấy task nào');
      return;
    }

    tasks.forEach(task => {
      const statusEmoji = getStatusEmoji(task.status);
      console.log(`${statusEmoji} ID: ${task.id} | ${task.action} | ${task.status || 'N/A'} | ${task.message || 'N/A'} | ${formatDate(task.createdAt)}`);
    });
    
    console.log(`\nĐể xem chi tiết một task, sử dụng: node check-task.js <task_id>`);
  } catch (error) {
    console.error(`Lỗi khi liệt kê task: ${error.message}`);
  }
}

/**
 * Lấy emoji tương ứng với trạng thái
 */
function getStatusEmoji(status) {
  switch(status) {
    case 'completed': return '✅';
    case 'processing': return '🔄';
    case 'pending': return '⏳';
    case 'failed': return '❌';
    case 'skipped': return '⏭️';
    default: return '❓';
  }
}

/**
 * Format date để hiển thị
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString();
}

/**
 * Hàm chính
 */
async function main() {
  try {
    const taskId = process.argv[2];
    const limit = process.argv[3] || 10;
    
    if (!taskId) {
      console.log('Không có ID task được cung cấp. Hiển thị các task mới nhất...');
      await printTaskSummary();
      await listLatestTasks(parseInt(limit, 10));
    } else {
      await getTaskStatus(taskId);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Lỗi khi thực thi: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Thực thi hàm chính
main(); 