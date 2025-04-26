declare module 'winston' {
  export interface LoggerOptions {
    level?: string;
    format?: any;
    defaultMeta?: any;
    transports?: any[];
  }

  export class Logger {
    constructor(options?: LoggerOptions);
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    http(message: string, meta?: any): void;
  }

  export function createLogger(options: LoggerOptions): Logger;
  export function addColors(colors: Record<string, string>): void;

  export namespace format {
    export function combine(...formats: any[]): any;
    export function timestamp(opts?: { format?: string }): any;
    export function errors(opts?: { stack?: boolean }): any;
    export function splat(): any;
    export function json(): any;
    export function colorize(opts?: { all?: boolean }): any;
    export function printf(fn: (info: any) => string): any;
  }

  export namespace transports {
    export class Console {
      constructor(options?: any);
    }
    export class File {
      constructor(options: any);
    }
  }
} 