import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialStore } from '../../src/core/CredentialStore.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('CredentialStore', () => {
  let store;
  let tmpDir;
  let credPath;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-cred-test-'));
    credPath = path.join(tmpDir, 'credentials.enc.json');
    store = new CredentialStore(credPath);
    await store.initialize(); // Uses machine-derived key fallback
  });

  it('stores and retrieves credentials', async () => {
    await store.set('tiktok', { username: 'user1', password: 'pass123' });
    const creds = store.get('tiktok');
    assert.equal(creds.username, 'user1');
    assert.equal(creds.password, 'pass123');
  });

  it('is case-insensitive for platform names', async () => {
    await store.set('TikTok', { username: 'user1', password: 'pass' });
    assert.ok(store.has('tiktok'));
    assert.ok(store.has('TIKTOK'));
    const creds = store.get('TIKTOK');
    assert.equal(creds.username, 'user1');
  });

  it('returns null for unknown platform', () => {
    assert.equal(store.get('nonexistent'), null);
  });

  it('checks platform existence', async () => {
    assert.equal(store.has('twitter'), false);
    await store.set('twitter', { username: 'tw_user', password: 'tw_pass' });
    assert.equal(store.has('twitter'), true);
  });

  it('lists platforms without exposing credentials', async () => {
    await store.set('tiktok', { username: 'u1', password: 'p1' });
    await store.set('instagram', { username: 'u2', password: 'p2' });
    const list = store.listPlatforms();
    assert.equal(list.length, 2);
    assert.ok(list.some(p => p.platform === 'tiktok'));
    assert.ok(list.some(p => p.platform === 'instagram'));
    // Ensure no password leaked
    for (const entry of list) {
      assert.equal(entry.password, undefined);
      assert.ok(entry.hasUsername !== undefined);
    }
  });

  it('revokes credentials', async () => {
    await store.set('tiktok', { username: 'u1', password: 'p1' });
    assert.ok(store.has('tiktok'));
    const deleted = await store.revoke('tiktok');
    assert.equal(deleted, true);
    assert.equal(store.has('tiktok'), false);
  });

  it('revoke returns false for nonexistent platform', async () => {
    const deleted = await store.revoke('nonexistent');
    assert.equal(deleted, false);
  });

  it('persists and reloads credentials', async () => {
    await store.set('linkedin', { username: 'li_user', password: 'li_pass', extra: 'data' });

    // Create new store instance and reload
    const store2 = new CredentialStore(credPath);
    await store2.initialize();

    const creds = store2.get('linkedin');
    assert.equal(creds.username, 'li_user');
    assert.equal(creds.password, 'li_pass');
    assert.equal(creds.extra, 'data');
  });

  it('encrypts credentials on disk', async () => {
    await store.set('secret', { username: 'admin', password: 'super_secret_123' });
    const raw = await fs.readFile(credPath, 'utf8');
    // The raw file should NOT contain the plaintext password
    assert.ok(!raw.includes('super_secret_123'));
    assert.ok(!raw.includes('admin'));
    // But should be valid JSON
    const parsed = JSON.parse(raw);
    assert.ok(parsed.secret);
    assert.ok(parsed.secret.iv);
    assert.ok(parsed.secret.data);
  });

  it('rejects empty platform name', async () => {
    await assert.rejects(() => store.set('', { username: 'u' }), /non-empty/);
  });

  it('rejects non-object credentials', async () => {
    await assert.rejects(() => store.set('test', 'not-an-object'), /must be an object/);
  });

  it('throws when not initialized', () => {
    const uninit = new CredentialStore('/tmp/nope.json');
    assert.throws(() => uninit.get('x'), /not initialized/);
    assert.throws(() => uninit.has('x'), /not initialized/);
    assert.throws(() => uninit.listPlatforms(), /not initialized/);
  });
});

describe('CredentialStore — pbkdf2 fallback', () => {
  it('initializes with password-derived key', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-cred-pw-'));
    const credPath = path.join(tmpDir, 'creds.enc.json');
    const store = new CredentialStore(credPath);
    await store.initialize('my-secret-password');

    await store.set('test', { username: 'u', password: 'p' });
    const creds = store.get('test');
    assert.equal(creds.username, 'u');

    // Reload with same password — should decrypt
    const store2 = new CredentialStore(credPath);
    await store2.initialize('my-secret-password');
    assert.equal(store2.get('test').username, 'u');
  });

  it('fails to decrypt with wrong password', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-cred-pw2-'));
    const credPath = path.join(tmpDir, 'creds.enc.json');

    const store1 = new CredentialStore(credPath);
    await store1.initialize('correct-password');
    await store1.set('test', { username: 'u', password: 'p' });

    // Reload with wrong password — should not find the credential (silently skipped)
    const store2 = new CredentialStore(credPath);
    await store2.initialize('wrong-password');
    assert.equal(store2.get('test'), null);
  });
});
