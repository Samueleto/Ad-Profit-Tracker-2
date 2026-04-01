import Cryptr from "cryptr";

const encryptionKey = process.env.ENCRYPTION_KEY || "default_dev_key_32_chars_minimum";

// Create a single Cryptr instance
const cryptr = new Cryptr(encryptionKey);

/**
 * Encrypts a plaintext string
 */
export function encrypt(text: string): string {
  return cryptr.encrypt(text);
}

/**
 * Decrypts an encrypted string
 */
export function decrypt(encryptedText: string): string {
  return cryptr.decrypt(encryptedText);
}

export default cryptr;
