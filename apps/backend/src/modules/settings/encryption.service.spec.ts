import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  describe('with ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      service = new EncryptionService('my-secret-32-byte-key-here-ok');
    });

    it('should encrypt and decrypt a plaintext string', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // format: iv:ciphertext:authTag
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'sk-test-key';
      const enc1 = service.encrypt(plaintext);
      const enc2 = service.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
      expect(service.decrypt(enc1)).toBe(plaintext);
      expect(service.decrypt(enc2)).toBe(plaintext);
    });

    it('should throw when decrypting with wrong key', () => {
      const encrypted = service.encrypt('test');
      const otherService = new EncryptionService('different-32-byte-key-here!!');
      expect(() => otherService.decrypt(encrypted)).toThrow();
    });

    it('should throw when decrypting invalid format', () => {
      expect(() => service.decrypt('not-valid-encrypted')).toThrow();
    });
  });

  describe('with empty ENCRYPTION_KEY (dev mode)', () => {
    beforeEach(() => {
      service = new EncryptionService('');
    });

    it('should return plaintext as-is on encrypt (no-op)', () => {
      const plaintext = 'sk-test';
      const result = service.encrypt(plaintext);
      expect(result).toBe(plaintext);
    });

    it('should return ciphertext as-is on decrypt (no-op)', () => {
      const result = service.decrypt('sk-test');
      expect(result).toBe('sk-test');
    });
  });
});
