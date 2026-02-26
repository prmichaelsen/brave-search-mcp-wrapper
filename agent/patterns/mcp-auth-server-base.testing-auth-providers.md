# Testing Auth Providers Pattern

**Pattern**: mcp-auth-server-base.testing-auth-providers
**Category**: Testing
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines comprehensive testing strategies for MCP auth provider implementations, covering unit tests, integration tests, mocking strategies, and error scenario testing. It ensures authentication logic is thoroughly tested and reliable.

**Key Principles**:
- Test all authentication paths
- Mock external dependencies
- Test error scenarios
- Verify caching behavior
- Test token validation
- Ensure security properties

---

## Core Concepts

### Auth Provider Testing Layers

1. **Unit Tests**: Test provider logic in isolation
2. **Integration Tests**: Test provider with real dependencies
3. **Mock Tests**: Test with mocked external services
4. **Error Tests**: Test failure scenarios
5. **Security Tests**: Test security properties

### Test Coverage Goals

- Token verification: 100%
- Error handling: 100%
- Caching logic: 100%
- Edge cases: 100%
- Integration points: 80%+

---

## Implementation

### 1. JWT Provider Tests

```typescript
// src/auth/jwt-provider.spec.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { JWTProvider } from './jwt-provider.js';
import { AuthenticationError } from '../errors/types.js';

describe('JWTProvider', () => {
  let provider: JWTProvider;
  const secret = 'test-secret-key-for-testing-only';
  const issuer = 'test-issuer';
  const audience = 'test-audience';

  beforeEach(() => {
    provider = new JWTProvider({
      secret,
      issuer,
      audience
    });
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com'
      };

      const token = jwt.sign(payload, secret, {
        issuer,
        audience,
        expiresIn: '1h'
      });

      const result = await provider.verifyToken(token);

      expect(result.userId).toBe('user123');
      expect(result.email).toBe('test@example.com');
    });

    it('should reject expired token', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer, audience, expiresIn: '-1h' }  // Expired
      );

      await expect(provider.verifyToken(token)).rejects.toThrow(AuthenticationError);
      await expect(provider.verifyToken(token)).rejects.toThrow('Token has expired');
    });

    it('should reject token with wrong secret', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        'wrong-secret',
        { issuer, audience }
      );

      await expect(provider.verifyToken(token)).rejects.toThrow(AuthenticationError);
    });

    it('should reject token with wrong issuer', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer: 'wrong-issuer', audience }
      );

      await expect(provider.verifyToken(token)).rejects.toThrow(AuthenticationError);
    });

    it('should reject token with wrong audience', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer, audience: 'wrong-audience' }
      );

      await expect(provider.verifyToken(token)).rejects.toThrow(AuthenticationError);
    });

    it('should reject malformed token', async () => {
      await expect(provider.verifyToken('not-a-valid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should reject empty token', async () => {
      await expect(provider.verifyToken('')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('caching', () => {
    it('should cache verified tokens', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer, audience, expiresIn: '1h' }
      );

      // Spy on jwt.verify
      const verifySpy = jest.spyOn(jwt, 'verify');

      // First call - should verify
      await provider.verifyToken(token);
      expect(verifySpy).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await provider.verifyToken(token);
      expect(verifySpy).toHaveBeenCalledTimes(1);  // Still 1

      verifySpy.mockRestore();
    });

    it('should expire cache after TTL', async () => {
      const shortTTLProvider = new JWTProvider({
        secret,
        issuer,
        audience,
        cacheTTL: 100  // 100ms
      });

      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer, audience, expiresIn: '1h' }
      );

      const verifySpy = jest.spyOn(jwt, 'verify');

      // First call
      await shortTTLProvider.verifyToken(token);
      expect(verifySpy).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call - cache expired, should verify again
      await shortTTLProvider.verifyToken(token);
      expect(verifySpy).toHaveBeenCalledTimes(2);

      verifySpy.mockRestore();
    });

    it('should not cache invalid tokens', async () => {
      const invalidToken = 'invalid-token';

      await expect(provider.verifyToken(invalidToken)).rejects.toThrow();
      await expect(provider.verifyToken(invalidToken)).rejects.toThrow();

      // Should attempt verification both times (no caching of errors)
    });
  });

  describe('token forwarding', () => {
    it('should extract and forward token', async () => {
      const token = jwt.sign(
        { userId: 'user123' },
        secret,
        { issuer, audience, expiresIn: '1h' }
      );

      const result = await provider.verifyToken(token);

      expect(result.token).toBe(token);
    });
  });
});
```

### 2. OAuth Provider Tests

```typescript
// src/auth/oauth-provider.spec.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OAuthProvider } from './oauth-provider.js';
import { AuthenticationError } from '../errors/types.js';

// Mock fetch
global.fetch = jest.fn();

describe('OAuthProvider', () => {
  let provider: OAuthProvider;

  beforeEach(() => {
    provider = new OAuthProvider({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenEndpoint: 'https://oauth.example.com/token',
      userInfoEndpoint: 'https://oauth.example.com/userinfo'
    });
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should verify token with OAuth provider', async () => {
      const mockUserInfo = {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserInfo
      });

      const result = await provider.verifyToken('access-token');

      expect(result.userId).toBe('user123');
      expect(result.email).toBe('test@example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth.example.com/userinfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer access-token'
          })
        })
      );
    });

    it('should handle OAuth provider errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(provider.verifyToken('invalid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(provider.verifyToken('token')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh expired token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse
      });

      const result = await provider.refreshToken('old-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );
    });

    it('should handle refresh failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400
      });

      await expect(provider.refreshToken('invalid-refresh-token')).rejects.toThrow();
    });
  });
});
```

### 3. API Key Provider Tests

```typescript
// src/auth/apikey-provider.spec.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { APIKeyProvider } from './apikey-provider.js';
import { AuthenticationError } from '../errors/types.js';
import crypto from 'crypto';

describe('APIKeyProvider', () => {
  let provider: APIKeyProvider;
  const mockDb = {
    apiKeys: {
      findOne: jest.fn()
    }
  };

  beforeEach(() => {
    provider = new APIKeyProvider(mockDb as any);
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should verify valid API key', async () => {
      const apiKey = 'test-api-key-123';
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      mockDb.apiKeys.findOne.mockResolvedValue({
        id: 'key1',
        userId: 'user123',
        hashedKey,
        active: true,
        expiresAt: new Date(Date.now() + 86400000)  // Tomorrow
      });

      const result = await provider.verifyToken(apiKey);

      expect(result.userId).toBe('user123');
      expect(mockDb.apiKeys.findOne).toHaveBeenCalledWith({
        hashedKey
      });
    });

    it('should reject invalid API key', async () => {
      mockDb.apiKeys.findOne.mockResolvedValue(null);

      await expect(provider.verifyToken('invalid-key')).rejects.toThrow(AuthenticationError);
    });

    it('should reject expired API key', async () => {
      const apiKey = 'test-api-key-123';
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      mockDb.apiKeys.findOne.mockResolvedValue({
        id: 'key1',
        userId: 'user123',
        hashedKey,
        active: true,
        expiresAt: new Date(Date.now() - 86400000)  // Yesterday
      });

      await expect(provider.verifyToken(apiKey)).rejects.toThrow('API key has expired');
    });

    it('should reject inactive API key', async () => {
      const apiKey = 'test-api-key-123';
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      mockDb.apiKeys.findOne.mockResolvedValue({
        id: 'key1',
        userId: 'user123',
        hashedKey,
        active: false,
        expiresAt: new Date(Date.now() + 86400000)
      });

      await expect(provider.verifyToken(apiKey)).rejects.toThrow('API key is inactive');
    });
  });

  describe('generateAPIKey', () => {
    it('should generate secure API key', () => {
      const key1 = provider.generateAPIKey();
      const key2 = provider.generateAPIKey();

      expect(key1).toHaveLength(64);  // 32 bytes = 64 hex chars
      expect(key2).toHaveLength(64);
      expect(key1).not.toBe(key2);  // Should be unique
    });
  });
});
```

### 4. Token Resolver Tests

```typescript
// src/auth/token-resolver.spec.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PlatformTokenResolver } from './token-resolver.js';

global.fetch = jest.fn();

describe('PlatformTokenResolver', () => {
  let resolver: PlatformTokenResolver;

  beforeEach(() => {
    resolver = new PlatformTokenResolver({
      platformUrl: 'https://platform.example.com',
      serviceToken: 'service-token-123'
    });
    jest.clearAllMocks();
  });

  describe('resolveToken', () => {
    it('should fetch credentials from platform', async () => {
      const mockCredentials = {
        access_token: 'user-access-token',
        refresh_token: 'user-refresh-token',
        expires_at: Date.now() + 3600000
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCredentials
      });

      const result = await resolver.resolveToken('user123', 'github');

      expect(result).toEqual(mockCredentials);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://platform.example.com/api/credentials/user123/github',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer service-token-123'
          })
        })
      );
    });

    it('should cache credentials', async () => {
      const mockCredentials = {
        access_token: 'token',
        expires_at: Date.now() + 3600000
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCredentials
      });

      // First call
      await resolver.resolveToken('user123', 'github');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await resolver.resolveToken('user123', 'github');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle missing credentials gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await resolver.resolveToken('user123', 'github');

      expect(result).toBeNull();
    });

    it('should handle platform errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await resolver.resolveToken('user123', 'github');

      expect(result).toBeNull();
    });
  });
});
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Testing with Real Secrets

**Wrong**:
```typescript
const provider = new JWTProvider({
  secret: process.env.JWT_SECRET  // ❌ Real secret
});
```

**Correct**:
```typescript
const provider = new JWTProvider({
  secret: 'test-secret-for-testing-only'  // ✅ Test secret
});
```

### ❌ Anti-Pattern 2: Not Testing Error Cases

**Wrong**:
```typescript
it('should verify token', async () => {
  const result = await provider.verifyToken(validToken);
  expect(result).toBeDefined();
  // ❌ Only tests happy path
});
```

**Correct**:
```typescript
it('should verify valid token', async () => {
  const result = await provider.verifyToken(validToken);
  expect(result.userId).toBe('user123');
});

it('should reject expired token', async () => {
  await expect(provider.verifyToken(expiredToken)).rejects.toThrow();
});

it('should reject invalid token', async () => {
  await expect(provider.verifyToken('invalid')).rejects.toThrow();
});
```

### ❌ Anti-Pattern 3: Not Mocking External Services

**Wrong**:
```typescript
it('should fetch from OAuth provider', async () => {
  // ❌ Makes real HTTP request
  const result = await provider.verifyToken(token);
});
```

**Correct**:
```typescript
it('should fetch from OAuth provider', async () => {
  global.fetch = jest.fn().mockResolvedValue({  // ✅ Mocked
    ok: true,
    json: async () => ({ sub: 'user123' })
  });
  
  const result = await provider.verifyToken(token);
});
```

### ❌ Anti-Pattern 4: Not Testing Cache Behavior

**Wrong**:
```typescript
it('should verify token', async () => {
  await provider.verifyToken(token);
  // ❌ Doesn't test caching
});
```

**Correct**:
```typescript
it('should cache verified tokens', async () => {
  const verifySpy = jest.spyOn(jwt, 'verify');
  
  await provider.verifyToken(token);
  await provider.verifyToken(token);
  
  expect(verifySpy).toHaveBeenCalledTimes(1);  // ✅ Tests caching
});
```

---

## Integration Testing

### Full Auth Flow Test

```typescript
// src/auth/integration.spec.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app.js';
import jwt from 'jsonwebtoken';

describe('Authentication Integration', () => {
  const secret = process.env.JWT_SECRET!;
  let validToken: string;

  beforeAll(() => {
    validToken = jwt.sign(
      { userId: 'user123', email: 'test@example.com' },
      secret,
      { issuer: 'test', audience: 'mcp-server', expiresIn: '1h' }
    );
  });

  it('should reject requests without token', async () => {
    const response = await request(app).get('/mcp/tools');
    expect(response.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const response = await request(app)
      .get('/mcp/tools')
      .set('Authorization', 'Bearer invalid-token');
    
    expect(response.status).toBe(401);
  });

  it('should accept requests with valid token', async () => {
    const response = await request(app)
      .get('/mcp/tools')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(response.status).toBe(200);
  });

  it('should include userId in request context', async () => {
    const response = await request(app)
      .get('/mcp/tools')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(response.body).toHaveProperty('tools');
    // Verify userId was extracted and used
  });
});
```

---

## Best Practices

1. **Test All Paths**: Happy path, error path, edge cases
2. **Mock External Services**: Don't make real API calls
3. **Use Test Secrets**: Never use production secrets
4. **Test Caching**: Verify cache behavior
5. **Test Expiration**: Test token expiration handling
6. **Test Security**: Verify security properties
7. **Fast Tests**: Keep tests under 100ms
8. **Isolated Tests**: Each test should be independent
9. **Clear Assertions**: Use specific matchers
10. **Test Coverage**: Aim for 100% on auth code

---

## Security Testing

### Security Test Checklist

```typescript
describe('Security Tests', () => {
  it('should reject tokens with no signature', async () => {
    const unsignedToken = Buffer.from(JSON.stringify({
      userId: 'user123'
    })).toString('base64');
    
    await expect(provider.verifyToken(unsignedToken)).rejects.toThrow();
  });

  it('should reject tokens with modified payload', async () => {
    const token = jwt.sign({ userId: 'user123' }, secret);
    const [header, payload, signature] = token.split('.');
    
    // Modify payload
    const modifiedPayload = Buffer.from(JSON.stringify({
      userId: 'admin'
    })).toString('base64');
    
    const modifiedToken = `${header}.${modifiedPayload}.${signature}`;
    
    await expect(provider.verifyToken(modifiedToken)).rejects.toThrow();
  });

  it('should not leak timing information', async () => {
    // Test for timing attacks
    const validToken = jwt.sign({ userId: 'user123' }, secret);
    const invalidToken = 'invalid-token';
    
    const start1 = Date.now();
    await provider.verifyToken(validToken).catch(() => {});
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await provider.verifyToken(invalidToken).catch(() => {});
    const time2 = Date.now() - start2;
    
    // Times should be similar (within 50ms)
    expect(Math.abs(time1 - time2)).toBeLessThan(50);
  });
});
```

---

## Performance Testing

```typescript
describe('Performance Tests', () => {
  it('should verify token in under 10ms (cached)', async () => {
    const token = jwt.sign({ userId: 'user123' }, secret);
    
    // Prime cache
    await provider.verifyToken(token);
    
    // Measure cached verification
    const start = Date.now();
    await provider.verifyToken(token);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(10);
  });

  it('should handle concurrent verifications', async () => {
    const token = jwt.sign({ userId: 'user123' }, secret);
    
    // 100 concurrent verifications
    const promises = Array(100).fill(null).map(() => 
      provider.verifyToken(token)
    );
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(100);
    results.forEach(result => {
      expect(result.userId).toBe('user123');
    });
  });
});
```

---

## Related Patterns

- [Jest Configuration Pattern](mcp-auth-server-base.jest-configuration.md) - Test setup
- [JWT Auth Provider Pattern](mcp-auth-server-base.auth-provider-jwt.md) - JWT implementation
- [Error Handling Pattern](mcp-auth-server-base.error-handling.md) - Error testing

---

**Status**: Production Ready
**Based On**: Auth provider patterns and testing best practices
**Recommendation**: Achieve 100% test coverage for all authentication code
