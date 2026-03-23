// test/core/ProtectionSystem.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProtectionSystem } from '../../src/core/ProtectionSystem.js';

describe('ProtectionSystem', () => {
  it('detects loop guard violations', () => {
    const ps = new ProtectionSystem();
    // Simulate repeated identical actions
    for (let i = 0; i < 10; i++) {
      ps.recordAction('agent-1', 'write', 'vision.md');
    }
    const violations = ps.check('agent-1');
    assert.ok(violations.some(v => v.guard === 'loop'));
  });

  it('passes when no violations', () => {
    const ps = new ProtectionSystem();
    ps.recordAction('agent-1', 'write', 'file1.md');
    ps.recordAction('agent-1', 'write', 'file2.md');
    const violations = ps.check('agent-1');
    assert.equal(violations.length, 0);
  });
});
