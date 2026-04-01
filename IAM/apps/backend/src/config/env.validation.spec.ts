import 'reflect-metadata';
import { validate } from './env.validation';

describe('Environment Validation', () => {
  // ============================================================
  // HAPPY PATH
  // ============================================================

  describe('Happy Path', () => {
    it('should pass with all required variables', () => {
      const config = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        JWT_SECRET: 'test-jwt-secret',
        PORT: '3000',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should use default PORT when not provided', () => {
      const config = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        JWT_SECRET: 'test-jwt-secret',
      };

      const result = validate(config);
      expect(result.PORT).toBe(3000);
    });
  });

  // ============================================================
  // ERROR FORZADO
  // ============================================================

  describe('Error Forzado', () => {
    it('should throw when SUPABASE_URL is missing', () => {
      const config = {
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        JWT_SECRET: 'test-jwt-secret',
      };

      expect(() => validate(config)).toThrow('Environment validation failed');
    });

    it('should throw when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      const config = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        JWT_SECRET: 'test-jwt-secret',
      };

      expect(() => validate(config)).toThrow('Environment validation failed');
    });

    it('should throw when SUPABASE_ANON_KEY is missing', () => {
      const config = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        JWT_SECRET: 'test-jwt-secret',
      };

      expect(() => validate(config)).toThrow('Environment validation failed');
    });

    it('should throw when SUPABASE_URL is empty string', () => {
      const config = {
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        JWT_SECRET: 'test-jwt-secret',
      };

      expect(() => validate(config)).toThrow('Environment validation failed');
    });

    it('should throw when all variables are missing', () => {
      expect(() => validate({})).toThrow('Environment validation failed');
    });
  });
});
