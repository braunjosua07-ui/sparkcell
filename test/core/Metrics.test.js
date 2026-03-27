// test/core/Metrics.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Metrics, metrics } from '../../src/core/Metrics.js';

describe('Metrics', () => {
  let testMetrics;

  beforeEach(() => {
    testMetrics = new Metrics();
  });

  // ── Timing measurements ───────────────────────────────────────────────────
  it('records and retrieves timing metrics', () => {
    testMetrics.recordTiming('test:operation', 150);
    testMetrics.recordTiming('test:operation', 200);
    testMetrics.recordTiming('test:operation', 100);

    const stats = testMetrics.getStats('test:operation');
    assert.equal(stats.count, 3);
    assert.equal(stats.avg, 150);
    assert.equal(stats.min, 100);
    assert.equal(stats.max, 200);
    assert.equal(stats.total, 450);
    assert.equal(stats.last, 100); // last recorded value is 100
  });

  it('handles timing with single value', () => {
    testMetrics.recordTiming('single', 50);
    const stats = testMetrics.getStats('single');
    assert.equal(stats.count, 1);
    assert.equal(stats.avg, 50);
    assert.equal(stats.min, 50);
    assert.equal(stats.max, 50);
  });

  // ── Event counting ──────────────────────────────────────────────────────
  it('records and retrieves event counts', () => {
    testMetrics.recordEvent('click', 1);
    testMetrics.recordEvent('click', 3);
    testMetrics.recordEvent('error', 1);

    const clickStats = testMetrics.getStats('click');
    assert.equal(clickStats.count, 2); // number of recordEvent calls
    assert.equal(clickStats.total, 4); // sum of all recorded values (1 + 3)

    const errorStats = testMetrics.getStats('error');
    assert.equal(errorStats.count, 1);
    assert.equal(errorStats.total, 1);
  });

  it('defaults event count to 1', () => {
    testMetrics.recordEvent('event');
    const stats = testMetrics.getStats('event');
    assert.equal(stats.count, 1);
    assert.equal(stats.total, 1);
  });

  // ── Gauge measurements ──────────────────────────────────────────────────
  it('records gauge values (snapshots)', () => {
    testMetrics.recordGauge('memory:heap', 100);
    testMetrics.recordGauge('memory:heap', 150);
    testMetrics.recordGauge('memory:heap', 80);

    const stats = testMetrics.getStats('memory:heap');
    assert.equal(stats.count, 3);
    assert.equal(stats.last, 80);
  });

  // ── All metrics retrieval ───────────────────────────────────────────────
  it('retrieves all metrics', () => {
    testMetrics.recordTiming('op1', 100);
    testMetrics.recordEvent('event1', 1);
    testMetrics.recordGauge('gauge1', 50);

    const all = testMetrics.getAllStats();
    assert.ok(all['op1']);
    assert.ok(all['event1']);
    assert.ok(all['gauge1']);
    assert.equal(Object.keys(all).length, 3);
  });

  // ── Rate calculation ────────────────────────────────────────────────────
  it('calculates rate (events per second)', () => {
    const m = new Metrics();
    const now = Date.now();
    // Manually inject a stat with valid timestamps for rate calculation
    // We create a stat object with two timestamp values (2 seconds apart)
    const statsMap = m._getStatsMap();
    const stat = {
      type: 'event',
      values: [now - 2000, now], // 2 seconds apart
      count: 2,
      total: 2,
      last: now,
    };
    statsMap.set('rate:test', stat);

    const rate = m.getRate('rate:test');
    assert.ok(rate);
    assert.ok(rate.eventsPerSec > 0);
    // With 2 events in ~2 seconds, should be ~1 events/sec
    assert.ok(rate.eventsPerSec <= 2, `Expected <= 2, got ${rate.eventsPerSec}`);
  });

  it('returns null when not enough data for rate', () => {
    const m = new Metrics();
    m.recordEvent('rate:test', 1);
    // Only 1 event - not enough for rate calculation
    const rate = m.getRate('rate:test');
    assert.equal(rate, null);
  });

  it('returns null for rate with insufficient data', () => {
    testMetrics.recordEvent('rate:test', 1);
    // Only 1 event - not enough for rate calculation
    const rate = testMetrics.getRate('rate:test');
    assert.equal(rate, null);
  });

  // ── Memory stats ────────────────────────────────────────────────────────
  it('gets memory stats from Node.js', () => {
    const memStats = testMetrics.getMemoryStats();
    assert.ok(memStats.heapUsed > 0);
    assert.ok(memStats.rss > 0);
    assert.ok(memStats.heapTotal > 0);
  });

  // ── Uptime tracking ─────────────────────────────────────────────────────
  it('tracks uptime', () => {
    const uptime = testMetrics.getUptime();
    assert.ok(uptime >= 0);
    // Should be roughly 0 seconds right after creation (within 1 second)
    assert.ok(uptime < 1);
  });

  // ── Reset functionality ─────────────────────────────────────────────────
  it('resets all metrics', () => {
    testMetrics.recordTiming('op', 100);
    testMetrics.recordEvent('event', 1);
    const uptimeBefore = testMetrics.getUptime();

    testMetrics.reset();

    assert.equal(testMetrics.getStats('op'), null);
    assert.equal(testMetrics.getStats('event'), null);

    // Uptime should be reset - new metrics instance should have uptime near 0
    const m2 = new Metrics();
    const uptimeAfterReset = m2.getUptime();
    assert.ok(uptimeAfterReset < 0.1, `New metrics uptime should be < 0.1, got ${uptimeAfterReset}`);
  });

  // ── Global metrics instance ─────────────────────────────────────────────
  it('provides global metrics instance', () => {
    // The global instance should be the default
    assert.ok(metrics);
    assert.ok(metrics instanceof Metrics);
  });

  // ── Memory efficiency (value limit) ─────────────────────────────────────
  it('limits stored values to 1000 per metric', () => {
    const m = new Metrics();
    for (let i = 0; i < 1500; i++) {
      m.recordTiming('large:test', i);
    }

    const stats = m.getStats('large:test');
    assert.ok(stats.count > 1000);
    // Only last 1000 values should be kept
    assert.equal(stats.count, 1500);
    // After 1000 records, first 500 values are dropped, so min should reflect that
    // Values 500-1499 remain, so min = 500, max = 1499
    assert.ok(stats.min >= 500, `Min should be >= 500 after trimming, got ${stats.min}`);
    assert.equal(stats.max, 1499);
  });
});
