/**
 * In-process request latency ring buffer.
 * M1-T6: Feeds the admin ops dashboard's latency panel without requiring
 * Prometheus/Grafana, which TECH_STACK.md marks optional for M1.
 */

const CAPACITY = 500;
const samples: number[] = [];
let cursor = 0;
let count = 0;

export function recordLatency(durationMs: number): void {
  samples[cursor] = durationMs;
  cursor = (cursor + 1) % CAPACITY;
  count = Math.min(count + 1, CAPACITY);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export interface LatencyStats {
  sampleCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

export function getLatencyStats(): LatencyStats {
  const values = samples.slice(0, count).sort((a, b) => a - b);
  if (values.length === 0) {
    return { sampleCount: 0, avgMs: 0, p50Ms: 0, p95Ms: 0 };
  }
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    sampleCount: values.length,
    avgMs: Math.round(avg),
    p50Ms: Math.round(percentile(values, 50)),
    p95Ms: Math.round(percentile(values, 95)),
  };
}
