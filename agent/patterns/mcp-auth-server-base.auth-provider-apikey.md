# API Key Auth Provider Pattern

**Category**: Authentication
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth with API key authentication
**Status**: Stable

---

## Overview

The API Key Auth Provider Pattern demonstrates how to implement API key based authentication for MCP servers. This pattern validates API keys against a configured list or external service, implements rate limiting per key, and provides simple stateless authentication. It's ideal for service-to-service communication or developer API access.

This pattern addresses the challenge of providing simple, secure authentication for programmatic access without requiring complex OAuth flows or JWT infrastructure.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- You need simple authentication for service-to-service communication
- You're building developer APIs that need API key access
- You want to avoid OAuth/JWT complexity
- You need per-key rate limiting and usage tracking
- Your users are primarily developers or automated systems
- You want to support multiple API keys per user

❌ **Don't use this pattern when:**
- You need user-specific authentication with sessions (use JWT or OAuth)
- You require fine-grained permissions (API keys are all-or-nothing)
- You need short-lived credentials (API keys are long-lived)
- Your platform requires OAuth compliance

---

## Core Principles

1. **Simple Validation**: API keys are validated against a list or external service.

2. **Stateless Authentication**: No session storage required, keys are validated on each request.

3. **Key Rotation**: Support for multiple keys per user and key rotation without downtime.

4. **Rate Limiting**: Per-key rate limiting to prevent abuse.

5. **Secure Storage**: Keys are hashed in storage, never stored in plaintext.

6. **Revocation**: Keys can be revoked immediately without waiting for expiration.

---

## Implementation

### Complete Implementation

```typescript
import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';
import crypto from 'crypto';

export interface APIKeyProviderConfig {
  /**
   * Function to validate API key and return user info
   * Can query database, call external service, or check in-memory map
   */
  validateKey: (keyHash: string) => Promise<{
    userId: string;
    metadata?: Record<string, any>;
  } | null>;
  
  /**
   * Enable result caching
   * Default: true
   */
  cacheResults?: boolean;
  
  /**
   * Cache TTL in milliseconds
   * Default: 300000 (5 minutes)
   */
  cacheTtl?: number;
  
  /**
   * API key prefix for identification (e.g., 'sk_')
   * Default: 'sk_'
   */
  keyPrefix?: string;
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
}

export class APIKeyAuthProvider implements AuthProvider {
  private config: APIKeyProviderConfig;
  private authCache = new Map<string, CachedAuthResult>();
  
  constructor(config: APIKeyProviderConfig) {
    this.config = {
      cacheResults: true,
      cacheTtl: 300000, // 5 minutes
      keyPrefix: 'sk_',
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    console.log('API Key auth provider initialized');
    console.log(`  Key prefix: ${this.config.keyPrefix}`);
    console.log(`  Caching: ${this.config.cacheResults ? 'enabled' : 'disabled'}`);
  }
  
  async authenticate(context: RequestContext): Promise<AuthResult> {
    try {
      // Extract API key from header
      const authHeader = context.headers?.['authorization'];
      const apiKeyHeader = context.headers?.['x-api-key'];
      
      let apiKey: string | undefined;
      
      // Support both Authorization: Bearer <key> and X-API-Key: <key>
      if (authHeader && !Array.isArray(authHeader)) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          apiKey = parts[1];
        }
      } else if (apiKeyHeader && !Array.isArray(apiKeyHeader)) {
        apiKey = apiKeyHeader;
      }
      
      if (!apiKey) {
        return { 
          authenticated: false, 
          error: 'No API key provided. Use Authorization: Bearer <key> or X-API-Key: <key>' 
        };
      }
      
      // Validate key format
      if (!apiKey.startsWith(this.config.keyPrefix!)) {
        return {
          authenticated: false,
          error: `Invalid API key format. Expected prefix: ${this.config.keyPrefix}`
        };
      }
      
      // Check cache first
      if (this.config.cacheResults) {
        const cached = this.authCache.get(apiKey);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result;
        }
      }
      
      // Hash the API key for lookup
      const keyHash = this.hashKey(apiKey);
      
      // Validate key
      const userInfo = await this.config.validateKey(keyHash);
      
      if (!userInfo) {
        return {
          authenticated: false,
          error: 'Invalid or revoked API key'
        };
      }
      
      // Build auth result
      const result: AuthResult = {
        authenticated: true,
        userId: userInfo.userId,
        metadata: {
          ...userInfo.metadata,
          authMethod: 'api-key'
        }
      };
      
      // Cache result
      if (this.config.cacheResults) {
        this.authCache.set(apiKey, {
          result,
          expiresAt: Date.now() + this.config.cacheTtl!
        });
      }
      
      return result;
      
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
  
  /**
   * Hash API key for secure storage/lookup
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
  
  /**
   * Generate a new API key
   */
  static generateKey(prefix: string = 'sk_'): string {
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}${key}`;
  }
  
  async cleanup(): Promise<void> {
    this.authCache.clear();
    console.log('API Key auth provider cleaned up');
  }
}
```

---

## Examples

### Example 1: In-Memory API Key Validation

```typescript
import { APIKeyAuthProvider } from './auth/apikey-provider';

// Simple in-memory key store (for development)
const apiKeys = new Map<string, { userId: string; name: string }>([
  [
    crypto.createHash('sha256').update('sk_test_key_123').digest('hex'),
    { userId: 'user-1', name: 'Development Key' }
  ]
]);

const authProvider = new APIKeyAuthProvider({
  validateKey: async (keyHash) => {
    const keyInfo = apiKeys.get(keyHash);
    return keyInfo ? {
      userId: keyInfo.userId,
      metadata: { keyName: keyInfo.name }
    } : null;
  }
});
```

### Example 2: Database API Key Validation

```typescript
import { APIKeyAuthProvider } from './auth/apikey-provider';
import { db } from './database';

const authProvider = new APIKeyAuthProvider({
  validateKey: async (keyHash) => {
    // Query database for API key
    const key = await db.apiKeys.findOne({
      keyHash,
      revoked: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!key) {
      return null;
    }
    
    // Update last used timestamp
    await db.apiKeys.updateOne(
      { _id: key._id },
      { $set: { lastUsedAt: new Date() } }
    );
    
    return {
      userId: key.userId,
      metadata: {
        keyName: key.name,
        createdAt: key.createdAt
      }
    };
  },
  cacheResults: true,
  cacheTtl: 60000 // 1 minute cache
});
```

### Example 3: Generating API Keys

```typescript
import { APIKeyAuthProvider } from './auth/apikey-provider';
import crypto from 'crypto';

// Generate a new API key
const newKey = APIKeyAuthProvider.generateKey('sk_');
console.log('New API key:', newKey);
// Output: sk_abc123def456...

// Hash for storage
const keyHash = crypto.createHash('sha256').update(newKey).digest('hex');

// Store in database
await db.apiKeys.create({
  keyHash,
  userId: 'user-123',
  name: 'Production Key',
  createdAt: new Date(),
  revoked: false
});

// Give the plain key to the user (only shown once!)
console.log('⚠️  Save this key - it will not be shown again!');
console.log('API Key:', newKey);
```

---

## Benefits

### 1. Simplicity

No complex OAuth flows or JWT infrastructure required. Simple header-based authentication.

### 2. Service-to-Service Communication

Perfect for automated systems, CI/CD pipelines, and service integrations.

### 3. Key Rotation

Support multiple keys per user, rotate keys without downtime.

### 4. Immediate Revocation

Keys can be revoked instantly by removing from database or marking as revoked.

---

## Trade-offs

### 1. Long-Lived Credentials

**Downside**: API keys are long-lived and don't expire automatically.

**Mitigation**: Implement expiration dates, encourage key rotation, monitor usage.

### 2. All-or-Nothing Access

**Downside**: API keys typically grant full access, no fine-grained permissions.

**Mitigation**: Implement key scopes or permissions in your validation logic.

---

## Related Patterns

- **[JWT Provider](./mcp-auth-server-base.auth-provider-jwt.md)**: Alternative for JWT-based auth
- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use API key provider with wrapServer

---

**Status**: Stable
**Recommendation**: Use for service-to-service authentication and developer APIs
**Last Updated**: 2026-02-21
