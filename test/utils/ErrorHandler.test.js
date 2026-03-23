// test/utils/ErrorHandler.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorHandler } from '../../src/utils/ErrorHandler.js';

describe('ErrorHandler', () => {
  it('returns result on success', async () => {
    const eh = new ErrorHandler();
    const result = await eh.safeAsync(() => 42);
    assert.equal(result, 42);
  });

  it('returns fallback on error', async () => {
    const eh = new ErrorHandler();
    const result = await eh.safeAsync(() => { throw new Error('boom'); }, 'default', 'test');
    assert.equal(result, 'default');
  });

  it('calls fallback function with error', async () => {
    const eh = new ErrorHandler();
    const result = await eh.safeAsync(
      () => { throw new Error('oops'); },
      (err) => `caught: ${err.message}`,
      'test'
    );
    assert.equal(result, 'caught: oops');
  });
});
