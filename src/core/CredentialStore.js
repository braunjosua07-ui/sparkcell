/**
 * CredentialStore — Secure platform credential management.
 *
 * Stores credentials per platform (e.g., tiktok, twitter, instagram).
 * Each credential set is encrypted via SecureKeyManager and persisted
 * to a JSON file. Credentials are NEVER exposed in logs, chat, or feed.
 *
 * On macOS: attempts to use Keychain via `security` CLI for the master key.
 * Fallback: pbkdf2-derived key from a user-supplied password.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const KEYCHAIN_SERVICE = 'com.sparkcell.credentials';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha512';

export class CredentialStore {
  #key = null;
  #credentials = new Map(); // platform -> { username, password, ...extras }
  #filePath;
  #initialized = false;

  constructor(filePath) {
    this.#filePath = filePath;
  }

  /**
   * Initialize the store. Tries macOS Keychain first, then falls back.
   * @param {string} [password] - User password for pbkdf2 fallback
   */
  async initialize(password) {
    // If password is explicitly provided, use pbkdf2 (user chose password-based encryption)
    if (password) {
      const salt = await this.#getOrCreateSalt();
      this.#key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    }

    // No password — try macOS Keychain
    if (!this.#key) {
      this.#key = await this.#tryKeychainKey();
    }

    // Last resort: machine-derived key (same as old SecureKeyManager)
    if (!this.#key) {
      const os = await import('node:os');
      const seed = `${os.hostname()}-${os.userInfo().username}-sparkcell-credentials`;
      this.#key = crypto.createHash('sha256').update(seed).digest();
    }

    // Load existing credentials
    await this.#load();
    this.#initialized = true;
  }

  /**
   * Store credentials for a platform.
   */
  async set(platform, credentials) {
    this.#ensureInit();
    // Validate — never store empty
    if (!platform || typeof platform !== 'string') {
      throw new Error('Platform must be a non-empty string');
    }
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Credentials must be an object');
    }
    this.#credentials.set(platform.toLowerCase(), { ...credentials });
    await this.#save();
  }

  /**
   * Get decrypted credentials for a platform.
   * Returns null if not found.
   */
  get(platform) {
    this.#ensureInit();
    return this.#credentials.get(platform.toLowerCase()) || null;
  }

  /**
   * Remove credentials for a platform.
   */
  async revoke(platform) {
    this.#ensureInit();
    const deleted = this.#credentials.delete(platform.toLowerCase());
    if (deleted) await this.#save();
    return deleted;
  }

  /**
   * List stored platforms (never returns actual credentials).
   */
  listPlatforms() {
    this.#ensureInit();
    return [...this.#credentials.keys()].map(platform => ({
      platform,
      hasUsername: !!this.#credentials.get(platform)?.username,
      storedAt: this.#credentials.get(platform)?._storedAt || 'unknown',
    }));
  }

  /**
   * Check if credentials exist for a platform.
   */
  has(platform) {
    this.#ensureInit();
    return this.#credentials.has(platform.toLowerCase());
  }

  // --- Private ---

  #ensureInit() {
    if (!this.#initialized) throw new Error('CredentialStore not initialized. Call initialize() first.');
  }

  async #tryKeychainKey() {
    if (process.platform !== 'darwin') return null;
    try {
      // Try to read existing key from Keychain
      const result = execSync(
        `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w 2>/dev/null`,
        { encoding: 'utf8', timeout: 5000 },
      ).trim();
      if (result) return Buffer.from(result, 'hex');
    } catch {
      // Key doesn't exist yet — create one
      try {
        const newKey = crypto.randomBytes(32);
        const keyHex = newKey.toString('hex');
        execSync(
          `security add-generic-password -s "${KEYCHAIN_SERVICE}" -a "sparkcell" -w "${keyHex}" 2>/dev/null`,
          { timeout: 5000 },
        );
        return newKey;
      } catch {
        return null; // Keychain not accessible
      }
    }
    return null;
  }

  async #getOrCreateSalt() {
    const saltPath = this.#filePath + '.salt';
    try {
      return Buffer.from(await fs.readFile(saltPath, 'utf8'), 'hex');
    } catch {
      const salt = crypto.randomBytes(16);
      await fs.mkdir(path.dirname(saltPath), { recursive: true });
      await fs.writeFile(saltPath, salt.toString('hex'));
      return salt;
    }
  }

  #encrypt(data) {
    const json = JSON.stringify(data);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.#key, iv);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), data: encrypted };
  }

  #decrypt(payload) {
    const iv = Buffer.from(payload.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.#key, iv);
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  async #save() {
    const entries = {};
    for (const [platform, creds] of this.#credentials) {
      entries[platform] = this.#encrypt({ ...creds, _storedAt: new Date().toISOString() });
    }
    await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
    await fs.writeFile(this.#filePath, JSON.stringify(entries, null, 2));
  }

  async #load() {
    try {
      const raw = JSON.parse(await fs.readFile(this.#filePath, 'utf8'));
      for (const [platform, payload] of Object.entries(raw)) {
        try {
          this.#credentials.set(platform, this.#decrypt(payload));
        } catch {
          // Corrupted entry — skip silently
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // No saved credentials — start fresh
    }
  }
}
