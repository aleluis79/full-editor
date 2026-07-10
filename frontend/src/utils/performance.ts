/**
 * Performance Monitoring Utilities
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  /**
   * Start a timer
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End a timer and record the metric
   */
  endTimer(name: string, unit: string = 'ms'): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer "${name}" was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.record({
      name,
      value: duration,
      unit,
      timestamp: Date.now(),
    });

    return duration;
  }

  /**
   * Record a metric
   */
  record(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  /**
   * Get average value for a metric
   */
  getAverage(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): Record<string, { count: number; average: number; min: number; max: number }> {
    const summary: Record<string, { count: number; average: number; min: number; max: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          average: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.min = Math.min(s.min, metric.value);
      s.max = Math.max(s.max, metric.value);
      s.average = (s.average * (s.count - 1) + metric.value) / s.count;
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Log summary to console
   */
  logSummary(): void {
    const summary = this.getSummary();
    console.table(summary);
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Measure execution time of a function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  perfMonitor.startTimer(name);
  try {
    const result = await fn();
    return result;
  } finally {
    perfMonitor.endTimer(name);
  }
}

/**
 * Measure execution time of a sync function
 */
export function measureSync<T>(
  name: string,
  fn: () => T
): T {
  perfMonitor.startTimer(name);
  try {
    return fn();
  } finally {
    perfMonitor.endTimer(name);
  }
}
