// src/core/SecureKeyManager.js
import crypto from 'node:crypto';
import os from 'node:os';

export class SecureKeyManager {
  #key;

  constructor() {
    // Machine-derived key: hostname + username hash
    const seed = `${os.hostname()}-${os.userInfo().username}-sparkcell`;
    this.#key = crypto.createHash('sha256').update(seed).digest();
  }

  encrypt(apiKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.#key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${iv.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedKey) {
    if (!this.isEncrypted(encryptedKey)) return encryptedKey;
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.#key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  isEncrypted(value) {
    return typeof value === 'string' && value.startsWith('enc:');
  }
}
