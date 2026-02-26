# JWT Auth Provider Pattern

**Category**: Authentication
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth with JWT authentication
**Status**: Stable

---

## Overview

The JWT Auth Provider Pattern demonstrates how to implement JWT (JSON Web Token) based authentication for MCP servers. This pattern uses the `jsonwebtoken` library to verify bearer tokens, implements result caching for performance, and stores tokens for forwarding to external platforms. It's the most common authentication pattern for multi-tenant MCP servers.

This pattern addresses the challenge of securely authenticating users via JWT tokens while maintaining high performance through caching and providing token forwarding capabilities for platform integrations.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Your MCP server integrates with a platform that issues JWT tokens
- You need stateless authentication (no session storage)
- You want to cache authentication results for performance
- You need to forward JWTs to external APIs for credential fetching
- Your platform uses standard JWT claims (issuer, audience, userId)
- You want to support bearer token authentication

❌ **Don't use this pattern when:**
- You need OAuth flow with redirect-based authentication (use OAuth pattern)
- You're using API keys instead of JWTs (use API Key pattern)
- You need environment-based authentication for local development (use Env pattern)
- Your authentication doesn't use standard JWT format

---

## Core Principles

1. **Stateless Verification**: JWT tokens are verified using a shared secret or public key, no database lookup required.

2. **Result Caching**: Authentication results are cached with TTL to avoid repeated JWT verification overhead.

3. **Token Forwarding**: Original JWT tokens are stored for forwarding to platform APIs that require them.

4. **Fail-Safe Error Handling**: All authentication failures return structured error responses, never throw exceptions.

5. **Standard JWT Claims**: Uses standard claims (issuer, audience, userId) for interoperability.

6. **Lifecycle Management**: Implements initialize() and cleanup() for proper resource management.

---

## Implementation

### Structure

```
src/
├── auth/
│   └── jwt-provider.ts       # JWT auth provider implementation
├── config/
│   └── environment.ts        # JWT configuration
└── types/
    └── auth.ts               # Auth-related types
```

### Complete Implementation

```typescript
import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';

export interface JWTProviderConfig {
  /**
   * Secret key or public key for JWT verification
   * For HMAC algorithms (HS256, HS384, HS512): shared secret string
   * For RSA/ECDSA algorithms (RS256, ES256, etc.): public key string
   */
  secret: string;
  
  /**
   * Expected JWT issuer (iss claim)
   * Example: 'your-platform.com' or 'https://auth.your-platform.com'
   */
  issuer: string;
  
  /**
   * Expected JWT audience (aud claim)
   * Example: 'mcp-server' or 'https://api.your-platform.com'
   */
  audience: string;
  
  /**
   * Enable result caching for performance
   * Default: true
   */
  cacheResults?: boolean;
  
  /**
   * Cache TTL in milliseconds
   * Default: 60000 (60 seconds)
   */
  cacheTtl?: number;
  
  /**
   * JWT algorithm to use for verification
   * Default: 'HS256'
   */
  algorithm?: jwt.Algorithm;
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
}

export class JWTAuthProvider implements AuthProvider {
  private config: JWTProviderConfig;
  private authCache = new Map<string, CachedAuthResult>();
  private jwtTokenCache = new Map<string, string>();
  
  constructor(config: JWTProviderConfig) {
    this.config = {
      cacheResults: true,
      cacheTtl: 60000, // 60 seconds
      algorithm: 'HS256',
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    console.log('JWT auth provider initialized');
    console.log(`  Issuer: ${this.config.issuer}`);
    console.log(`  Audience: ${this.config.audience}`);
    console.log(`  Caching: ${this.config.cacheResults ? 'enabled' : 'disabled'}`);
  }
  
  async authenticate(context: RequestContext): Promise<AuthResult> {
    try {
      // Extract authorization header
      const authHeader = context.headers?.['authorization'];
      
      if (!authHeader || Array.isArray(authHeader)) {
        return { 
          authenticated: false, 
          error: 'No authorization header provided' 
        };
      }
      
      // Parse bearer token
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return { 
          authenticated: false, 
          error: 'Invalid authorization format. Expected: Bearer <token>' 
        };
      }
      
      const token = parts[1];
      
      // Check cache first
      if (this.config.cacheResults) {
        const cached = this.authCache.get(token);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result;
        }
      }
      
      // Verify JWT
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm!]
      }) as jwt.JwtPayload & { 
        userId: string; 
        email?: string;
        [key: string]: any;
      };
      
      // Validate required claims
      if (!decoded.userId) {
        return {
          authenticated: false,
          error: 'JWT missing required userId claim'
        };
      }
      
      // Store JWT for forwarding to platform APIs
      this.jwtTokenCache.set(decoded.userId, token);
      
      // Build auth result
      const result: AuthResult = {
        authenticated: true,
        userId: decoded.userId,
        metadata: {
          email: decoded.email,
          // Include any additional claims as metadata
          ...Object.keys(decoded)
            .filter(key => !['iss', 'aud', 'exp', 'iat', 'userId'].includes(key))
            .reduce((acc, key) => ({ ...acc, [key]: decoded[key] }), {})
        }
      };
      
      // Cache result
      if (this.config.cacheResults) {
        this.authCache.set(token, {
          result,
          expiresAt: Date.now() + this.config.cacheTtl!
        });
      }
      
      return result;
      
    } catch (error) {
      // Handle JWT verification errors
      if (error instanceof jwt.TokenExpiredError) {
        return {
          authenticated: false,
          error: 'JWT token has expired'
        };
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          authenticated: false,
          error: `JWT verification failed: ${error.message}`
        };
      }
      
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
  
  /**
   * Get stored JWT token for a user (for forwarding to platform APIs)
   */
  getJWTToken(userId: string): string | undefined {
    return this.jwtTokenCache.get(userId);
  }
  
  /**
   * Clear all caches
   */
  async cleanup(): Promise<void> {
    this.authCache.clear();
    this.jwtTokenCache.clear();
    console.log('JWT auth provider cleaned up');
  }
}
```

### Key Components

#### Component 1: Configuration

The provider requires configuration for JWT verification and caching behavior.

```typescript
const config: JWTProviderConfig = {
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 60 seconds
};

const authProvider = new JWTAuthProvider(config);
```

#### Component 2: Token Extraction

Extract and validate the bearer token format.

```typescript
const authHeader = context.headers?.['authorization'];
const parts = authHeader.split(' ');
if (parts.length !== 2 || parts[0] !== 'Bearer') {
  return { authenticated: false, error: 'Invalid format' };
}
const token = parts[1];
```

#### Component 3: JWT Verification

Verify the token using jsonwebtoken library.

```typescript
const decoded = jwt.verify(token, config.secret, {
  issuer: config.issuer,
  audience: config.audience,
  algorithms: [config.algorithm]
}) as jwt.JwtPayload & { userId: string };
```

#### Component 4: Result Caching

Cache authentication results to avoid repeated verification.

```typescript
// Check cache
const cached = this.authCache.get(token);
if (cached && Date.now() < cached.expiresAt) {
  return cached.result;
}

// Store in cache
this.authCache.set(token, {
  result,
  expiresAt: Date.now() + this.config.cacheTtl
});
```

#### Component 5: Token Forwarding

Store original JWT for forwarding to platform APIs.

```typescript
// Store JWT for later retrieval
this.jwtTokenCache.set(decoded.userId, token);

// Retrieve when needed
const jwt = authProvider.getJWTToken(userId);
```

---

## Examples

### Example 1: Basic JWT Provider

Simple JWT provider with default settings.

```typescript
import { JWTAuthProvider } from './auth/jwt-provider';

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

await authProvider.initialize();

// Use with wrapServer
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createServer(userId);
  },
  authProvider,
  resourceType: 'your-resource',
  transport: { type: 'sse', port: 8080 }
});
```

### Example 2: JWT Provider with Custom Caching

Configure custom cache TTL for different performance characteristics.

```typescript
const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 5 * 60 * 1000 // 5 minutes (longer cache for less frequent verification)
});
```

### Example 3: JWT Provider with RSA Public Key

Use RSA public key for JWT verification (asymmetric).

```typescript
import fs from 'fs';

const publicKey = fs.readFileSync('./keys/public.pem', 'utf8');

const authProvider = new JWTAuthProvider({
  secret: publicKey, // Public key for RSA verification
  issuer: 'your-platform.com',
  audience: 'mcp-server',
  algorithm: 'RS256' // RSA with SHA-256
});
```

### Example 4: JWT Provider with Token Forwarding

Use stored JWT to call platform APIs.

```typescript
import { JWTAuthProvider } from './auth/jwt-provider';

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// In your server factory
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // Get the original JWT token
    const jwt = authProvider.getJWTToken(userId);
    
    // Forward to platform API
    const response = await fetch('https://platform.com/api/credentials', {
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });
    
    const credentials = await response.json();
    return await createServer(credentials.accessToken, userId);
  },
  authProvider,
  resourceType: 'your-resource',
  transport: { type: 'sse', port: 8080 }
});
```

---

## Benefits

### 1. Stateless Authentication

No database lookups required for authentication. JWT contains all necessary information, enabling horizontal scaling without shared session storage.

### 2. Performance Through Caching

Result caching reduces JWT verification overhead from ~1-2ms to <0.1ms for cached tokens. Significant performance improvement for high-traffic servers.

### 3. Token Forwarding

Stored JWTs can be forwarded to platform APIs for credential fetching, enabling seamless integration with external platforms.

### 4. Standard Compliance

Uses standard JWT claims (iss, aud, exp) ensuring interoperability with any JWT-compliant identity provider.

### 5. Flexible Key Management

Supports both symmetric (HMAC) and asymmetric (RSA, ECDSA) algorithms, allowing for different security models.

---

## Trade-offs

### 1. Cache Invalidation

**Downside**: Cached results may be stale if user permissions change. Revoked tokens remain valid until cache expires.

**Mitigation**: Use short cache TTLs (30-60 seconds) for security-sensitive applications. Implement token revocation checking if needed.

### 2. Memory Usage

**Downside**: Caching tokens and results consumes memory, especially with many concurrent users.

**Mitigation**: Set reasonable cache TTLs and implement cache size limits. Monitor memory usage in production.

### 3. Secret Management

**Downside**: JWT secret must be securely stored and distributed to all server instances.

**Mitigation**: Use environment variables or secret management services (AWS Secrets Manager, Google Secret Manager). Rotate secrets periodically.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Hardcoded Secrets

**Description**: Embedding JWT secrets directly in source code.

**Why it's bad**: Secrets are exposed in version control, making them accessible to anyone with repository access.

**Instead, do this**: Use environment variables or secret management services.

```typescript
// ❌ Bad: Hardcoded secret
const authProvider = new JWTAuthProvider({
  secret: 'my-super-secret-key-12345', // ❌ Exposed in code!
  issuer: 'platform.com',
  audience: 'mcp-server'
});

// ✅ Good: Environment variable
const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!, // ✅ Loaded from environment
  issuer: 'platform.com',
  audience: 'mcp-server'
});
```

### ❌ Anti-Pattern 2: Ignoring Token Expiration

**Description**: Not handling TokenExpiredError specifically, treating all errors the same.

**Why it's bad**: Users don't know why authentication failed. Expired tokens are common and should have clear error messages.

**Instead, do this**: Handle TokenExpiredError specifically with clear messaging.

```typescript
// ❌ Bad: Generic error handling
catch (error) {
  return {
    authenticated: false,
    error: 'Authentication failed' // ❌ Not helpful!
  };
}

// ✅ Good: Specific error handling
catch (error) {
  if (error instanceof jwt.TokenExpiredError) {
    return {
      authenticated: false,
      error: 'JWT token has expired. Please refresh your token.' // ✅ Clear!
    };
  }
  
  if (error instanceof jwt.JsonWebTokenError) {
    return {
      authenticated: false,
      error: `JWT verification failed: ${error.message}`
    };
  }
  
  return {
    authenticated: false,
    error: error instanceof Error ? error.message : 'Authentication failed'
  };
}
```

### ❌ Anti-Pattern 3: No Cache TTL

**Description**: Caching authentication results indefinitely without expiration.

**Why it's bad**: Revoked or expired tokens remain valid indefinitely. Security vulnerability.

**Instead, do this**: Always set a reasonable cache TTL.

```typescript
// ❌ Bad: No expiration
this.authCache.set(token, result); // ❌ Never expires!

// ✅ Good: With TTL
this.authCache.set(token, {
  result,
  expiresAt: Date.now() + this.config.cacheTtl // ✅ Expires after TTL
});
```

### ❌ Anti-Pattern 4: Missing Required Claims Validation

**Description**: Not validating that required claims (like userId) are present in the JWT.

**Why it's bad**: Server may crash or behave unexpectedly if userId is missing.

**Instead, do this**: Validate all required claims after verification.

```typescript
// ❌ Bad: No validation
const decoded = jwt.verify(token, secret) as { userId: string };
return { authenticated: true, userId: decoded.userId }; // ❌ May be undefined!

// ✅ Good: Validate required claims
const decoded = jwt.verify(token, secret) as jwt.JwtPayload & { userId?: string };

if (!decoded.userId) {
  return {
    authenticated: false,
    error: 'JWT missing required userId claim'
  };
}

return { authenticated: true, userId: decoded.userId }; // ✅ Safe!
```

---

## Testing Strategy

### Unit Testing

Test JWT verification logic in isolation.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JWTAuthProvider } from './jwt-provider';

describe('JWTAuthProvider', () => {
  let provider: JWTAuthProvider;
  const secret = 'test-secret';
  const issuer = 'test-platform.com';
  const audience = 'mcp-server';
  
  beforeEach(() => {
    provider = new JWTAuthProvider({
      secret,
      issuer,
      audience,
      cacheResults: false // Disable caching for tests
    });
  });
  
  it('should authenticate valid JWT', async () => {
    const token = jwt.sign(
      { userId: 'user-123', email: 'user@example.com' },
      secret,
      { issuer, audience }
    );
    
    const result = await provider.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.metadata?.email).toBe('user@example.com');
  });
  
  it('should reject expired JWT', async () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { issuer, audience, expiresIn: '-1s' } // Already expired
    );
    
    const result = await provider.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('expired');
  });
  
  it('should reject JWT with wrong issuer', async () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { issuer: 'wrong-issuer.com', audience }
    );
    
    const result = await provider.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    expect(result.authenticated).toBe(false);
  });
  
  it('should cache authentication results', async () => {
    const providerWithCache = new JWTAuthProvider({
      secret,
      issuer,
      audience,
      cacheResults: true,
      cacheTtl: 1000
    });
    
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { issuer, audience }
    );
    
    // First call - not cached
    const result1 = await providerWithCache.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    // Second call - should be cached
    const result2 = await providerWithCache.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    expect(result1).toEqual(result2);
  });
  
  it('should store JWT for forwarding', async () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { issuer, audience }
    );
    
    await provider.authenticate({
      headers: { authorization: `Bearer ${token}` }
    });
    
    const storedToken = provider.getJWTToken('user-123');
    expect(storedToken).toBe(token);
  });
});
```

### Integration Testing

Test JWT provider with wrapped server.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wrapServer } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';
import { JWTAuthProvider } from './jwt-provider';
import { createServer } from './server';

describe('JWT Auth Integration', () => {
  let wrappedServer: any;
  const secret = 'test-secret';
  
  beforeAll(async () => {
    const authProvider = new JWTAuthProvider({
      secret,
      issuer: 'test.com',
      audience: 'mcp-server'
    });
    
    wrappedServer = wrapServer({
      serverFactory: async (accessToken, userId) => {
        return await createServer(userId);
      },
      authProvider,
      resourceType: 'test',
      transport: {
        type: 'sse',
        port: 8082,
        host: '0.0.0.0',
        basePath: '/mcp'
      }
    });
    
    await wrappedServer.start();
  });
  
  afterAll(async () => {
    await wrappedServer.stop();
  });
  
  it('should accept requests with valid JWT', async () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      secret,
      { issuer: 'test.com', audience: 'mcp-server' }
    );
    
    const response = await fetch('http://localhost:8082/mcp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method: 'test' })
    });
    
    expect(response.ok).toBe(true);
  });
  
  it('should reject requests without JWT', async () => {
    const response = await fetch('http://localhost:8082/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'test' })
    });
    
    expect(response.status).toBe(401);
  });
});
```

---

## Related Patterns

- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use JWT provider with wrapServer
- **[Token Resolver](./mcp-auth-server-base.token-resolver.md)**: Fetch per-user credentials using stored JWT
- **[OAuth Provider](./mcp-auth-server-base.auth-provider-oauth.md)**: Alternative auth pattern for OAuth flows
- **[API Key Provider](./mcp-auth-server-base.auth-provider-apikey.md)**: Alternative auth pattern for API keys
- **[Environment Provider](./mcp-auth-server-base.auth-provider-env.md)**: Alternative auth pattern for local development

---

## Configuration Reference

### JWTProviderConfig Interface

```typescript
interface JWTProviderConfig {
  // Required
  secret: string;              // JWT secret or public key
  issuer: string;              // Expected issuer (iss claim)
  audience: string;            // Expected audience (aud claim)
  
  // Optional
  cacheResults?: boolean;      // Enable caching (default: true)
  cacheTtl?: number;           // Cache TTL in ms (default: 60000)
  algorithm?: jwt.Algorithm;   // JWT algorithm (default: 'HS256')
}
```

### Supported Algorithms

- **HMAC**: HS256, HS384, HS512 (symmetric, shared secret)
- **RSA**: RS256, RS384, RS512 (asymmetric, public/private key)
- **ECDSA**: ES256, ES384, ES512 (asymmetric, elliptic curve)

---

## Checklist for Implementation

- [ ] JWT secret configured via environment variable (not hardcoded)
- [ ] Issuer and audience match your platform's JWT configuration
- [ ] Cache TTL set appropriately for your security requirements
- [ ] Token expiration errors handled with clear messages
- [ ] Required claims (userId) validated after verification
- [ ] JWT tokens stored for forwarding if needed
- [ ] Cleanup method called on server shutdown
- [ ] Unit tests cover valid tokens, expired tokens, and invalid tokens
- [ ] Integration tests verify authentication with wrapped server
- [ ] Error messages are user-friendly and actionable
- [ ] Algorithm matches your JWT signing method
- [ ] Public key used for RSA/ECDSA verification (if applicable)

---

**Status**: Stable - Extracted from production implementations
**Recommendation**: Use this pattern for JWT-based authentication in multi-tenant MCP servers
**Last Updated**: 2026-02-21
**Contributors**: Extracted from remember-mcp-server and task-mcp-server
