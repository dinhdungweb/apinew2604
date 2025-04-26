declare module 'prom-client' {
  export class Registry {
    registerMetric(metric: any): void;
    metrics(): Promise<string>;
    getMetricsAsJSON(): Promise<any>;
  }

  export class Counter<T extends string = string> {
    constructor(configuration: {
      name: string;
      help: string;
      labelNames?: readonly T[];
    });
    inc(labels?: Record<T, string | number>, value?: number): void;
    set(labels: Record<T, string | number>, value: number): void;
  }

  export class Gauge<T extends string = string> {
    constructor(configuration: {
      name: string;
      help: string;
      labelNames?: readonly T[];
    });
    set(value: number): void;
    set(labels: Record<T, string | number>, value: number): void;
  }

  export class Histogram<T extends string = string> {
    constructor(configuration: {
      name: string;
      help: string;
      labelNames?: readonly T[];
      buckets?: number[];
    });
    observe(value: number): void;
    observe(labels: Record<T, string | number>, value: number): void;
    startTimer(labels?: Record<T, string | number>): () => number;
  }

  export function collectDefaultMetrics(options?: { register?: Registry }): void;
} 