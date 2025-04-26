import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

// Đảm bảo thư mục logs tồn tại
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Tạo một store toàn cục cho correlation ID trong môi trường Node.js
const correlationIdStore: { id: string } = { id: '' };

// Format log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Định nghĩa các màu cho các level khác nhau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Thêm colors scheme cho winston
winston.addColors(colors);

// Tùy chỉnh định dạng output cho console
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf((info: any) => {
    const { timestamp, level, message, correlationId, module, ...meta } = info;
    
    const metaString = Object.keys(meta).length > 0 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
      
    const moduleInfo = module ? `[${module}]` : '';
    const corrId = correlationId ? `[${correlationId}]` : '';
    
    return `${timestamp} ${level} ${corrId}${moduleInfo}: ${message}${metaString}`;
  })
);

// Tạo logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'sync-service',
    get correlationId() { return correlationIdStore.id; }
  },
  transports: [
    // Ghi tất cả các log level
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    // Ghi các lỗi nghiêm trọng
    new winston.transports.File({ 
      filename: path.join(logDir, 'errors.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    // Ghi ra console khi không phải môi trường production
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
  ],
});

// Tạo một logger mới cho mỗi module
export function createLogger(module: string) {
  return {
    debug: (message: string, meta: Record<string, any> = {}) => {
      logger.debug(message, { module, ...meta });
    },
    info: (message: string, meta: Record<string, any> = {}) => {
      logger.info(message, { module, ...meta });
    },
    warn: (message: string, meta: Record<string, any> = {}) => {
      logger.warn(message, { module, ...meta });
    },
    error: (message: string, meta: Record<string, any> = {}) => {
      logger.error(message, { module, ...meta });
    },
    http: (message: string, meta: Record<string, any> = {}) => {
      logger.http(message, { module, ...meta });
    },
    metric: (metricName: string, value: number, meta: Record<string, any> = {}) => {
      logger.info(`METRIC: ${metricName}`, { 
        module,
        metricName, 
        metricValue: value,
        metricType: 'gauge',
        ...meta 
      });
    },
    startTimer: (label: string): (() => number) => {
      const start = process.hrtime();
      return () => {
        const diff = process.hrtime(start);
        const duration = (diff[0] * 1e9 + diff[1]) / 1e6; // chuyển sang milliseconds
        logger.debug(`TIMER: ${label}`, { module, duration, timerLabel: label });
        return duration;
      };
    }
  };
}

// Thiết lập và lấy correlation ID
export function initCorrelationId(): string {
  correlationIdStore.id = nanoid(8);
  return correlationIdStore.id;
}

export function getCorrelationId(): string {
  return correlationIdStore.id;
}

export function setCorrelationId(id: string): void {
  correlationIdStore.id = id;
}

// Root logger
export default {
  debug: (message: string, meta: Record<string, any> = {}) => {
    logger.debug(message, meta);
  },
  info: (message: string, meta: Record<string, any> = {}) => {
    logger.info(message, meta);
  },
  warn: (message: string, meta: Record<string, any> = {}) => {
    logger.warn(message, meta);
  },
  error: (message: string, meta: Record<string, any> = {}) => {
    logger.error(message, meta);
  },
  http: (message: string, meta: Record<string, any> = {}) => {
    logger.http(message, meta);
  },
  initCorrelationId,
  getCorrelationId,
  setCorrelationId,
  createLogger
}; 