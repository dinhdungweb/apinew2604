const { exec } = require('child_process');
const path = require('path');

console.log('Đang khởi động lại worker...');

// Tìm process đang chạy worker.js
const findWorkerProcess = 'powershell -Command "Get-Process | Where-Object {$_.CommandLine -like \'*worker.js*\'} | Select-Object Id"';

exec(findWorkerProcess, (error, stdout, stderr) => {
  if (error) {
    console.error(`Lỗi khi tìm process worker: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Lỗi stderr: ${stderr}`);
    return;
  }
  
  // Phân tích kết quả để tìm PID
  const lines = stdout.trim().split('\n');
  let pid = null;
  
  // Bỏ qua dòng header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+$/.test(line)) {
      pid = line;
      break;
    }
  }
  
  if (pid) {
    console.log(`Đã tìm thấy worker đang chạy với PID: ${pid}`);
    
    // Kết thúc process cũ
    const killCommand = `powershell -Command "Stop-Process -Id ${pid} -Force"`;
    
    exec(killCommand, (killError) => {
      if (killError) {
        console.error(`Lỗi khi kết thúc process: ${killError.message}`);
        return;
      }
      
      console.log(`Đã kết thúc worker process với PID: ${pid}`);
      console.log('Đang khởi động lại worker...');
      
      // Khởi động lại worker
      const workerPath = path.join(__dirname, 'worker.js');
      const startWorker = `powershell -WindowStyle Hidden -Command "Start-Process node -ArgumentList '${workerPath}' -WindowStyle Hidden"`;
      
      exec(startWorker, (startError) => {
        if (startError) {
          console.error(`Lỗi khi khởi động lại worker: ${startError.message}`);
          return;
        }
        
        console.log('Đã khởi động lại worker thành công!');
      });
    });
  } else {
    console.log('Không tìm thấy worker đang chạy, đang khởi động mới...');
    
    // Khởi động worker mới
    const workerPath = path.join(__dirname, 'worker.js');
    const startWorker = `powershell -WindowStyle Hidden -Command "Start-Process node -ArgumentList '${workerPath}' -WindowStyle Hidden"`;
    
    exec(startWorker, (startError) => {
      if (startError) {
        console.error(`Lỗi khi khởi động worker: ${startError.message}`);
        return;
      }
      
      console.log('Đã khởi động worker thành công!');
    });
  }
}); 