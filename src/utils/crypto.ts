import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * AES-256-GCM encryption for private keys at rest.
 *
 * IMPORTANT (read before using this in anything real):
 * This protects the private key from someone who only gets a copy of the
 * database file. It does NOT protect against compromise of the server
 * itself, since the decryption key lives in the same process's env vars.
 * For real funds, replace this with a proper KMS/HSM (AWS KMS, GCP KMS,
 * Turnkey, Privy, etc.) so the raw private key is never materialized in
 * application memory at all.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

export interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

function getKey(): Buffer {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not set — required to use src/utils/crypto.ts.');
  }
  const key = Buffer.from(config.encryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars). Got ${key.length} bytes.`
    );
  }
  return key;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
