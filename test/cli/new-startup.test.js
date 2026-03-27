import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateStartupName } from '../../src/cli/new-startup.js';

describe('validateStartupName', () => {
  it('accepts valid names', () => {
    assert.deepEqual(validateStartupName('My Startup'), { ok: true, slug: 'my-startup' });
    assert.deepEqual(validateStartupName('acme-inc'), { ok: true, slug: 'acme-inc' });
    assert.deepEqual(validateStartupName('SparkAI'), { ok: true, slug: 'sparkai' });
  });

  it('rejects names that are too short', () => {
    const result = validateStartupName('a');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('kurz'));
  });

  it('rejects names that are too long', () => {
    const result = validateStartupName('a'.repeat(100));
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('lang'));
  });

  it('rejects reserved names', () => {
    for (const reserved of ['config', 'admin', 'system', 'test', 'help']) {
      const result = validateStartupName(reserved);
      assert.equal(result.ok, false, `"${reserved}" should be rejected`);
      assert.ok(result.error.includes('reserviert'));
    }
  });

  it('rejects names starting with a number', () => {
    const result = validateStartupName('123startup');
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Zahl'));
  });

  it('strips special characters and normalizes', () => {
    const result = validateStartupName('  Hello World!!  ');
    assert.equal(result.ok, true);
    assert.equal(result.slug, 'hello-world');
  });
});
