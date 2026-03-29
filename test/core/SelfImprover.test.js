import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SelfImprover } from '../../src/core/SelfImprover.js';

// Minimal bus mock
function createMockBus() {
  const subs = new Map();
  return {
    subscribe(event, cb) { subs.set(event, cb); return () => subs.delete(event); },
    publish(event, data) { const cb = subs.get(event); if (cb) cb(data); },
    _subs: subs,
  };
}

describe('SelfImprover', () => {
  it('creates without bus', () => {
    const si = new SelfImprover(null);
    assert.ok(si);
  });

  it('tracks tool failures via bus events', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    // Simulate 3 webFetch failures
    for (let i = 0; i < 3; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'webFetch', success: false, args: {} });
    }

    const diag = si.getDiagnostics('a1');
    assert.equal(diag.errorStats.totalErrors, 3);
  });

  it('detects repeated tool failure pattern', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    for (let i = 0; i < 4; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'webFetch', success: false });
    }

    const actions = si.onCycleComplete('a1');
    assert.ok(actions.length > 0);
    assert.equal(actions[0].type, 'tool-disabled');
    assert.equal(actions[0].tool, 'webFetch');
  });

  it('generates prompt injection after adaptation', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    for (let i = 0; i < 4; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'webFetch', success: false });
    }
    si.onCycleComplete('a1');

    const injection = si.getPromptInjection('a1');
    assert.ok(injection.includes('webFetch'));
    assert.ok(injection.includes('GELERNTE LEKTIONEN'));
  });

  it('tracks successes too', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    bus.publish('tool:executed', { agentId: 'a1', toolName: 'writeFile', success: true });
    bus.publish('tool:executed', { agentId: 'a1', toolName: 'writeFile', success: true });

    const diag = si.getDiagnostics('a1');
    assert.equal(diag.errorStats.totalSuccesses, 2);
  });

  it('reports disabled tools', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    for (let i = 0; i < 4; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'glob', success: false });
    }
    si.onCycleComplete('a1');

    assert.ok(si.isToolDisabled('a1', 'glob'));
    assert.ok(!si.isToolDisabled('a1', 'writeFile'));
  });

  it('records task completion for meta-learner', () => {
    const si = new SelfImprover(null);

    si.onTaskComplete({
      agentId: 'a1', agentName: 'Dev', task: 'Build MVP',
      quality: 0.8, filesCreated: 3, success: true,
    });

    const report = si.getSystemReport();
    assert.equal(report.productivity.total, 1);
    assert.equal(report.productivity.successRate, 100);
  });

  it('respects strategy cooldown', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    for (let i = 0; i < 4; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'webFetch', success: false });
    }

    const first = si.onCycleComplete('a1');
    assert.ok(first.length > 0);

    // Second call within cooldown should return empty
    const second = si.onCycleComplete('a1');
    assert.equal(second.length, 0);
  });

  it('publishes self-improvement events on bus', () => {
    const bus = createMockBus();
    const si = new SelfImprover(bus);

    let published = null;
    bus.subscribe('agent:self-improvement', (data) => { published = data; });

    for (let i = 0; i < 4; i++) {
      bus.publish('tool:executed', { agentId: 'a1', toolName: 'webFetch', success: false });
    }
    si.onCycleComplete('a1');

    assert.ok(published);
    assert.equal(published.agentId, 'a1');
    assert.ok(published.actions.length > 0);
  });
});
