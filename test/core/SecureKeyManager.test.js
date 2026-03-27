// test/core/SecureKeyManager.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SecureKeyManager } from '../../src/core/SecureKeyManager.js';

describe('SecureKeyManager', () => {
  const skm = new SecureKeyManager();

  it('encrypts an API key', () => {
    const encrypted = skm.encrypt('sk-test-12345');
    assert.ok(encrypted.startsWith('enc:'));
    assert.notEqual(encrypted, 'enc:sk-test-12345');
  });

  it('decrypts back to original', () => {
    const original = 'sk-or-v1-abc123xyz';
    const encrypted = skm.encrypt(original);
    const decrypted = skm.decrypt(encrypted);
    assert.equal(decrypted, original);
  });

  it('detects encrypted values', () => {
    assert.equal(skm.isEncrypted('enc:abc123'), true);
    assert.equal(skm.isEncrypted('sk-plain-key'), false);
  });

  it('returns plain text if not encrypted on decrypt', () => {
    const plain = 'sk-plain-key';
    assert.equal(skm.decrypt(plain), plain);
  });
});
