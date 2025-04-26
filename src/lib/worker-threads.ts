import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import EventEmitter from 'events';
import { withLock } from './locker';

// Xác định số lõi CPU
const NUM_CPUS = os.cpus().length;
// Sử dụng tối đa 75% số lõi CPU có sẵn nhưng ít nhất là 2 worker
const MIN_WORKERS = 2;
const MAX_WORKERS = Math.max(MIN_WORKERS, Math.floor(NUM_CPUS * 0.75));

// Cấu hình cho dynamic scaling
const SCALE_CHECK_INTERVAL = 5000; // Kiểm tra mỗi 5 giây
const SCALE_UP_THRESHOLD = 10; // Tăng worker khi có hơn 10 task đang chờ
const SCALE_DOWN_THRESHOLD = 3; // Giảm worker khi có ít hơn 3 task đang chờ
const WORKER_IDLE_TIMEOUT = 60000; // 1 phút không hoạt động thì giảm worker

interface WorkerTask {
  id: string;
  task: string;
  params: any[];
  priority: number;
  timestamp: number;
  timeout?: number;
}

interface WorkerResult {
  id: string;
  result?: any;
  error?: any;
}

interface WorkerMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  currentQueueSize: number;
  activeWorkers: number;
  totalWorkers: number;
}

export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeWorkers: Map<string, { worker: Worker, startTime: number }> = new Map();
  private resolvers: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason?: any) => void,
    timer?: NodeJS.Timeout 
  }> = new Map();
  private workerLastUsed: Map<Worker, number> = new Map();
  private scaleInterval: NodeJS.Timeout | null = null;
  private metrics: WorkerMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    currentQueueSize: 0,
    activeWorkers: 0,
    totalWorkers: 0
  };
  private executionTimes: number[] = [];

  constructor(
    private workerPath: string, 
    private minWorkers: number = MIN_WORKERS,
    private maxWorkers: number = MAX_WORKERS,
    private dynamicScaling: boolean = true
  ) {
    super();
    this.initialize();
    
    if (this.dynamicScaling) {
      this.scaleInterval = setInterval(() => this.adjustPoolSize(), SCALE_CHECK_INTERVAL);
    }
  }

  private initialize() {
    console.log(`[WorkerPool] Khởi tạo ${this.minWorkers} worker threads (min: ${this.minWorkers}, max: ${this.maxWorkers})`);
    
    for (let i = 0; i < this.minWorkers; i++) {
      this.createWorker(i);
    }
    
    this.updateMetrics();
  }

  private createWorker(id: number): Worker {
    try {
      const worker = new Worker(this.workerPath);
      
      worker.on('message', this.handleWorkerMessage.bind(this));
      
      worker.on('error', (error) => {
        console.error(`[WorkerPool] Worker ${id} gặp lỗi:`, error);
        // Loại bỏ worker bị lỗi
        this.workers = this.workers.filter(w => w !== worker);
        // Tạo worker mới thay thế
        this.createWorker(id);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[WorkerPool] Worker ${id} đã thoát với mã lỗi ${code}`);
          // Loại bỏ worker đã thoát
          this.workers = this.workers.filter(w => w !== worker);
          // Tạo worker mới thay thế nếu cần
          if (this.workers.length < this.minWorkers) {
            this.createWorker(id);
          }
        }
      });
      
      this.workers.push(worker);
      this.workerLastUsed.set(worker, Date.now());
      this.updateMetrics();
      this.processQueue();
      
      return worker;
    } catch (error) {
      console.error(`[WorkerPool] Lỗi khi tạo worker ${id}:`, error);
      // Thử lại sau 1 giây
      setTimeout(() => this.createWorker(id), 1000);
      throw error;
    }
  }

  private handleWorkerMessage(message: WorkerResult) {
    const resolver = this.resolvers.get(message.id);
    if (resolver) {
      // Xóa bộ hẹn giờ timeout nếu có
      if (resolver.timer) {
        clearTimeout(resolver.timer);
      }
      
      const activeWorkerInfo = this.activeWorkers.get(message.id);
      if (activeWorkerInfo) {
        const executionTime = Date.now() - activeWorkerInfo.startTime;
        this.executionTimes.push(executionTime);
        
        // Giữ tối đa 100 mẫu thời gian gần nhất
        if (this.executionTimes.length > 100) {
          this.executionTimes.shift();
        }
        
        // Cập nhật thời gian sử dụng gần nhất cho worker
        this.workerLastUsed.set(activeWorkerInfo.worker, Date.now());
      }
      
      if (message.error) {
        resolver.reject(message.error);
        this.metrics.failedTasks++;
      } else {
        resolver.resolve(message.result);
        this.metrics.completedTasks++;
      }
      
      this.resolvers.delete(message.id);
      this.activeWorkers.delete(message.id);
      
      // Xử lý tiếp hàng đợi
      this.processQueue();
      this.updateMetrics();
    }
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return;
    
    // Sắp xếp hàng đợi theo độ ưu tiên và thời gian
    this.taskQueue.sort((a, b) => {
      // Ưu tiên cao hơn trước
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Sau đó đến FIFO
      return a.timestamp - b.timestamp;
    });
    
    for (const worker of this.workers) {
      if (this.taskQueue.length === 0) break;
      
      // Kiểm tra worker có đang bận không
      let isWorkerBusy = false;
      for (const [_, activeWorker] of this.activeWorkers) {
        if (activeWorker.worker === worker) {
          isWorkerBusy = true;
          break;
        }
      }
      
      if (!isWorkerBusy) {
        const task = this.taskQueue.shift()!;
        this.activeWorkers.set(task.id, { 
          worker: worker, 
          startTime: Date.now() 
        });
        
        // Thiết lập timeout cho task nếu được chỉ định
        if (task.timeout && task.timeout > 0) {
          const resolver = this.resolvers.get(task.id);
          if (resolver) {
            resolver.timer = setTimeout(() => {
              // Xóa task khỏi hàng đợi và từ chối promise
              this.activeWorkers.delete(task.id);
              resolver.reject(new Error(`Task ${task.id} đã hết thời gian chờ sau ${task.timeout}ms`));
              this.resolvers.delete(task.id);
              this.metrics.failedTasks++;
              this.updateMetrics();
            }, task.timeout);
          }
        }
        
        worker.postMessage(task);
        this.workerLastUsed.set(worker, Date.now());
      }
    }
    
    this.updateMetrics();
  }

  private adjustPoolSize() {
    const currentTime = Date.now();
    const queueSize = this.taskQueue.length;
    const activeWorkerCount = this.activeWorkers.size;
    
    // Tăng số lượng worker nếu có quá nhiều task đang chờ và chưa đạt giới hạn
    if (queueSize > SCALE_UP_THRESHOLD && this.workers.length < this.maxWorkers) {
      const workersToAdd = Math.min(
        Math.ceil(queueSize / SCALE_UP_THRESHOLD),
        this.maxWorkers - this.workers.length
      );
      
      console.log(`[WorkerPool] Tăng ${workersToAdd} worker (hàng đợi: ${queueSize}, hiện tại: ${this.workers.length})`);
      
      for (let i = 0; i < workersToAdd; i++) {
        this.createWorker(this.workers.length);
      }
    }
    
    // Giảm số lượng worker nếu có quá ít task và vượt quá số lượng tối thiểu
    if (queueSize < SCALE_DOWN_THRESHOLD && 
        this.workers.length > this.minWorkers && 
        activeWorkerCount < this.workers.length) {
      
      // Tìm worker chưa sử dụng lâu nhất
      const idleWorkers = [];
      
      for (const worker of this.workers) {
        const lastUsed = this.workerLastUsed.get(worker) || 0;
        const idleTime = currentTime - lastUsed;
        
        // Nếu worker đã không sử dụng trong một khoảng thời gian
        if (idleTime > WORKER_IDLE_TIMEOUT) {
          // Kiểm tra xem worker có đang xử lý tác vụ không
          let isActive = false;
          for (const [_, info] of this.activeWorkers) {
            if (info.worker === worker) {
              isActive = true;
              break;
            }
          }
          
          if (!isActive) {
            idleWorkers.push(worker);
          }
        }
      }
      
      // Giữ lại ít nhất minWorkers
      const workersToRemove = Math.min(
        idleWorkers.length,
        this.workers.length - this.minWorkers
      );
      
      if (workersToRemove > 0) {
        console.log(`[WorkerPool] Giảm ${workersToRemove} worker không hoạt động (hàng đợi: ${queueSize}, hiện tại: ${this.workers.length})`);
        
        for (let i = 0; i < workersToRemove; i++) {
          const worker = idleWorkers[i];
          worker.terminate();
          this.workers = this.workers.filter(w => w !== worker);
          this.workerLastUsed.delete(worker);
        }
        
        this.updateMetrics();
      }
    }
  }

  private updateMetrics() {
    // Tính toán thời gian thực thi trung bình
    const avgTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
      : 0;
    
    this.metrics = {
      ...this.metrics,
      averageExecutionTime: avgTime,
      currentQueueSize: this.taskQueue.length,
      activeWorkers: this.activeWorkers.size,
      totalWorkers: this.workers.length
    };
    
    this.emit('metrics', this.getMetrics());
  }

  public runTask(task: string, params: any[], options: { priority?: number, timeout?: number, useDistributedLock?: boolean, lockTTL?: number, lockResourceId?: string } = {}): Promise<any> {
    const priority = options.priority || 0; // 0 là mức độ ưu tiên mặc định
    const timeout = options.timeout;
    const useDistributedLock = options.useDistributedLock || false;
    const lockTTL = options.lockTTL || 30; // Mặc định 30 giây
    
    // Nếu không sử dụng khóa phân tán, chạy tác vụ bình thường
    if (!useDistributedLock) {
      return new Promise((resolve, reject) => {
        const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const workerTask: WorkerTask = { 
          id, 
          task, 
          params, 
          priority,
          timestamp: Date.now(),
          timeout
        };
        
        this.resolvers.set(id, { resolve, reject });
        this.taskQueue.push(workerTask);
        this.metrics.totalTasks++;
        
        this.updateMetrics();
        this.processQueue();
      });
    }
    
    // Sử dụng khóa phân tán
    return new Promise(async (resolve, reject) => {
      const lockResourceId = options.lockResourceId || `task:${task}:${params.map(p => typeof p === 'object' ? JSON.stringify(p) : p).join(':')}`;
      
      // Sử dụng withLock để bảo vệ tác vụ
      const lockResult = await withLock(
        lockResourceId,
        async () => {
          // Tạo ID tác vụ và cấu trúc tác vụ
          const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const workerTask: WorkerTask = { 
            id, 
            task, 
            params, 
            priority,
            timestamp: Date.now(),
            timeout
          };
          
          // Tạo Promise mới bên trong khóa
          return new Promise((taskResolve, taskReject) => {
            this.resolvers.set(id, { 
              resolve: taskResolve, 
              reject: taskReject 
            });
            this.taskQueue.push(workerTask);
            this.metrics.totalTasks++;
            
            this.updateMetrics();
            this.processQueue();
          });
        },
        lockTTL,
        true // bỏ qua nếu đã bị khóa
      );
      
      // Xử lý kết quả từ withLock
      if (lockResult.skipped) {
        resolve({ 
          skipped: true, 
          reason: `Tác vụ đang được xử lý (đã bị khóa: ${lockResourceId})` 
        });
      } else if (lockResult.error) {
        reject(lockResult.error);
      } else {
        resolve(lockResult.result);
      }
    });
  }

  public async runTaskBatch(tasks: { task: string, params: any[], priority?: number, timeout?: number, useDistributedLock?: boolean, lockTTL?: number, lockResourceId?: string }[]): Promise<any[]> {
    return Promise.all(tasks.map(t => this.runTask(t.task, t.params, {
      priority: t.priority,
      timeout: t.timeout,
      useDistributedLock: t.useDistributedLock,
      lockTTL: t.lockTTL,
      lockResourceId: t.lockResourceId
    })));
  }

  public getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  public terminate() {
    if (this.scaleInterval) {
      clearInterval(this.scaleInterval);
      this.scaleInterval = null;
    }
    
    for (const worker of this.workers) {
      worker.terminate();
    }
    
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers.clear();
    this.resolvers.clear();
    this.workerLastUsed.clear();
    
    this.updateMetrics();
  }
}

let workerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    const workerPath = path.resolve(process.cwd(), 'src/lib/sync-worker-thread.js');
    workerPool = new WorkerPool(workerPath);
  }
  return workerPool;
}

export default getWorkerPool; 