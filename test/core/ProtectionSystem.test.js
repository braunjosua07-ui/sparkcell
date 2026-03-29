// test/core/ProtectionSystem.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ProtectionSystem } from '../../src/core/ProtectionSystem.js';
import { ProtectionStorage } from '../../src/core/ProtectionStorage.js';

describe('ProtectionSystem', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-protection-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  // ── Loop guard ──────────────────────────────────────────────────────────
  it('detects loop guard violations', () => {
    const ps = new ProtectionSystem();
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
    assert.equal(ps.check('agent-1').length, 0);
  });

  // ── Skill inflation guard ──────────────────────────────────────────────
  it('detects skill inflation (jump > 20 levels)', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', {
      skillLevels: new Map([['coding', 80]]),
      prevSkillLevels: new Map([['coding', 50]]),
    });
    assert.ok(violations.some(v => v.guard === 'skillInflation'));
    assert.ok(violations[0].message.includes('coding'));
  });

  it('passes normal skill growth', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', {
      skillLevels: new Map([['coding', 55]]),
      prevSkillLevels: new Map([['coding', 50]]),
    });
    assert.ok(!violations.some(v => v.guard === 'skillInflation'));
  });

  // ── Commitment overload guard ──────────────────────────────────────────
  it('detects commitment overload (> 10)', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { commitments: 15 });
    assert.ok(violations.some(v => v.guard === 'commitmentOverload'));
  });

  it('passes when commitments within limit', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { commitments: 5 });
    assert.ok(!violations.some(v => v.guard === 'commitmentOverload'));
  });

  // ── Isolation guard ────────────────────────────────────────────────────
  it('detects isolation (no comm events in window)', () => {
    const ps = new ProtectionSystem();
    for (let i = 0; i < 50; i++) {
      ps.recordAction('agent-1', 'write', `file${i}.md`);
    }
    const violations = ps.check('agent-1');
    assert.ok(violations.some(v => v.guard === 'isolation'));
  });

  it('passes when agent has recent communication', () => {
    const ps = new ProtectionSystem();
    for (let i = 0; i < 10; i++) {
      ps.recordAction('agent-1', 'write', `file${i}.md`);
    }
    ps.recordAction('agent-1', 'comm:slack', 'team-channel');
    for (let i = 0; i < 4; i++) {
      ps.recordAction('agent-1', 'write', `extra${i}.md`);
    }
    const violations = ps.check('agent-1');
    assert.ok(!violations.some(v => v.guard === 'isolation'));
  });

  // ── Energy exploit guard ───────────────────────────────────────────────
  it('detects energy exploit (boost > 3)', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { boostCount: 5 });
    assert.ok(violations.some(v => v.guard === 'energyExploit'));
  });

  it('passes normal energy boost usage', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { boostCount: 2 });
    assert.ok(!violations.some(v => v.guard === 'energyExploit'));
  });

  // ── Memory overflow guard ──────────────────────────────────────────────
  it('detects memory overflow (> 1000 entries)', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { memorySize: 1500 });
    assert.ok(violations.some(v => v.guard === 'memoryOverflow'));
  });

  it('passes when memory within limit', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', { memorySize: 200 });
    assert.ok(!violations.some(v => v.guard === 'memoryOverflow'));
  });

  // ── Deadlock guard ─────────────────────────────────────────────────────
  it('detects deadlock (blocked without help request)', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', {
      agentState: 'blocked',
      blockedActions: 8,
      helpRequested: false,
    });
    assert.ok(violations.some(v => v.guard === 'deadlock'));
  });

  it('passes when blocked but help was requested', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', {
      agentState: 'blocked',
      blockedActions: 8,
      helpRequested: true,
    });
    assert.ok(!violations.some(v => v.guard === 'deadlock'));
  });

  it('passes when not blocked', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1', {
      agentState: 'working',
      blockedActions: 0,
      helpRequested: false,
    });
    assert.ok(!violations.some(v => v.guard === 'deadlock'));
  });

  // ── No context = guards skip gracefully ────────────────────────────────
  it('guards skip gracefully when context is missing', () => {
    const ps = new ProtectionSystem();
    const violations = ps.check('agent-1');
    assert.equal(violations.length, 0);
  });

  // ── Storage persistence integration ─────────────────────────────────────
  it('persists actions to storage and loads them back', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir, maxActions: 10 });
    const ps = new ProtectionSystem({ storage });

    ps.recordAction('agent-1', 'write', 'file1.md');
    ps.recordAction('agent-1', 'read', 'file2.md');

    await ps.saveToStorage('agent-1');

    const loaded = await ps.loadFromStorage('agent-1');
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].actionType, 'write');
  });

  it('persists via storage directly when storage option provided', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir });
    const ps = new ProtectionSystem({ storage });

    ps.recordAction('agent-2', 'test', 'target');

    // Save using storage directly
    await storage.saveBuffer('agent-2');

    const filePath = path.join(tmpDir, 'agent-2.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const loaded = JSON.parse(raw);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].actionType, 'test');
  });
});
