// Secure Credential Management for Root Operations
// Provides credential caching and secure storage for privileged operations

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Credential Manager - Secure storage for root operation credentials
 */
export class CredentialManager {
  constructor() {
    this.credentialsPath = path.join(os.homedir(), '.clay', 'credentials');
    this.keyPath = path.join(os.homedir(), '.clay', '.key');
    this.credentials = new Map();
    this.masterKey = null;
    this.initialized = false;
  }

  /**
   * Initialize credential manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure .clay directory exists
      const clayDir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(clayDir)) {
        fs.mkdirSync(clayDir, { mode: 0o700 });
      }

      // Load or generate master key
      if (fs.existsSync(this.keyPath)) {
        this.masterKey = fs.readFileSync(this.keyPath, 'utf8').trim();
      } else {
        // Generate new master key
        this.masterKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(this.keyPath, this.masterKey, { mode: 0o600 });
      }

      // Load cached credentials
      if (fs.existsSync(this.credentialsPath)) {
        const encrypted = fs.readFileSync(this.credentialsPath, 'utf8');
        const decrypted = this.decrypt(encrypted);
        const data = JSON.parse(decrypted);
        this.credentials = new Map(Object.entries(data));
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize credential manager:', error);
      // Continue without credential caching
    }
  }

  /**
   * Encrypt data
   */
  encrypt(text) {
    if (!this.masterKey) return text;
    
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.createHash('sha256').update(this.masterKey).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      return text;
    }
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedText) {
    if (!this.masterKey) return encryptedText;
    
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.createHash('sha256').update(this.masterKey).digest();
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText;
    }
  }

  /**
   * Store credential for a specific operation
   */
  async storeCredential(operationId, credential) {
    await this.initialize();
    
    this.credentials.set(operationId, {
      credential,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });

    await this.save();
  }

  /**
   * Get credential for operation
   */
  async getCredential(operationId) {
    await this.initialize();
    
    const entry = this.credentials.get(operationId);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.credentials.delete(operationId);
      await this.save();
      return null;
    }

    return entry.credential;
  }

  /**
   * Clear credential
   */
  async clearCredential(operationId) {
    await this.initialize();
    this.credentials.delete(operationId);
    await this.save();
  }

  /**
   * Clear all credentials
   */
  async clearAll() {
    await this.initialize();
    this.credentials.clear();
    await this.save();
  }

  /**
   * Save credentials to disk
   */
  async save() {
    try {
      const data = Object.fromEntries(this.credentials);
      const encrypted = this.encrypt(JSON.stringify(data));
      fs.writeFileSync(this.credentialsPath, encrypted, { mode: 0o600 });
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }

  /**
   * Generate secure token for operation
   */
  generateToken(operation) {
    return crypto
      .createHash('sha256')
      .update(`${operation}-${Date.now()}-${Math.random()}`)
      .digest('hex');
  }

  /**
   * Validate token
   */
  validateToken(token, operation) {
    // Simple validation - in production, use more secure methods
    return token && token.length === 64;
  }
}

// Export singleton instance
export const credentialManager = new CredentialManager();

