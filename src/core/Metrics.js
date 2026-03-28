// src/core/Metrics.js

/**
 * Metrics — Performance tracking and monitoring for SparkCell.
 *
 * Provides metrics collection for:
 * - Agent cycles per second
 * - Protection violations by type
 * - Tool execution latency
 * - Memory usage tracking
 */

export class Metrics {
  #stats = new Map();
  #startTime;

  constructor() {
    this.#startTime = Date.now();
  }

  /**
   * Record a timing measurement.
   * @param {string} name - Metric name
   * @param {number} duration - Duration in milliseconds
   */
  recordTiming(name, duration) {
    this.#recordMetric(name, 'timing', duration);
  }

  /**
   * Record an event count.
   * @param {string} name - Metric name
   * @param {number} [count=1] - Event count
   */
  recordEvent(name, count = 1) {
    this.#recordMetric(name, 'event', count);
  }

  /**
   * Record a gauge value (snapshot measurement).
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   */
  recordGauge(name, value) {
    this.#recordMetric(name, 'gauge', value);
  }

  #recordMetric(name, type, value) {
    if (!this.#stats.has(name)) {
      this.#stats.set(name, {
        type,
        values: [],
        count: 0,
        total: 0,
        last: null,
      });
    }

    const stat = this.#stats.get(name);
    stat.values.push(value);
    stat.count += 1;
    stat.total += value;
    stat.last = value;

    // Keep only last 1000 values for memory efficiency
    if (stat.values.length > 1000) {
      stat.values.shift();
    }
  }

  /**
   * Get stats for a metric.
   * @param {string} name - Metric name
   * @returns {object|null} Stats object or null if not found
   */
  getStats(name) {
    const stat = this.#stats.get(name);
    if (!stat) return null;

    const avg = stat.count > 0 ? stat.total / stat.count : 0;
    const min = stat.values.length > 0 ? Math.min(...stat.values) : 0;
    const max = stat.values.length > 0 ? Math.max(...stat.values) : 0;

    return {
      name: stat.type,
      count: stat.count,
      avg,
      min,
      max,
      last: stat.last,
      total: stat.total,
    };
  }

  /**
   * Get all metrics.
   * @returns {object} Object mapping metric names to stats
   */
  getAllStats() {
    const result = {};
    for (const [name, stat] of this.#stats) {
      result[name] = this.getStats(name);
    }
    return result;
  }

  /**
   * Get uptime in seconds.
   * @returns {number}
   */
  getUptime() {
    return (Date.now() - this.#startTime) / 1000;
  }

  /**
   * Get memory stats from Node.js process.
   * @returns {object}
   */
  getMemoryStats() {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers,
    };
  }

  /**
   * Get system metrics (CPU, memory, uptime).
   * @returns {object}
   */
  getSystemMetrics() {
    return {
      uptime: this.getUptime(),
      memory: this.getMemoryStats(),
      cpuUsage: process.cpuUsage?.() || { user: 0, system: 0 },
    };
  }

  /**
   * Get rate metrics (events per second, etc.).
   * NOTE: This method only works correctly for gauge metrics where values represent timestamps.
   * For timing/event metrics, use getStats() instead.
   * @param {string} name - Metric name
   * @returns {object|null} Rate stats or null
   */
  getRate(name) {
    const stat = this.#stats.get(name);
    if (!stat || stat.count < 2) return null;

    // Get the first value from values array (oldest timestamp)
    const firstTimestamp = stat.values[0];
    if (firstTimestamp == null || isNaN(firstTimestamp)) return null;

    const lastTimestamp = stat.last;
    if (lastTimestamp == null || isNaN(lastTimestamp)) return null;

    const timeSpan = (lastTimestamp - firstTimestamp) / 1000; // seconds
    if (timeSpan <= 0) return null;

    return {
      name,
      total: stat.count,
      durationSec: timeSpan,
      eventsPerSec: stat.count / timeSpan,
    };
  }

  /**
   * Get raw stats map (for testing only).
   * @returns {Map} Internal stats map
   */
  _getStatsMap() {
    return this.#stats;
  }

  /**
   * Reset all metrics (for testing or restart).
   */
  reset() {
    this.#stats.clear();
    this.#startTime = Date.now();
  }
}

/**
 * Global metrics instance for easy access.
 */
export const metrics = new Metrics();
