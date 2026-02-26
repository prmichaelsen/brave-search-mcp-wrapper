# Environment Auth Provider Pattern

**Category**: Authentication
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth for local development
**Status**: Stable

---

## Overview

The Environment Auth Provider Pattern demonstrates how to implement environment variable based authentication for MCP servers during local development. This pattern bypasses real authentication by using configured user IDs from environment variables, making it perfect for development, testing, and debugging without requiring external authentication infrastructure.

This pattern addresses the challenge of running and testing MCP servers locally without setting up OAuth providers, JWT infrastructure, or API key management systems.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- You're developing and testing locally
- You need to bypass authentication for debugging
- You're running automated tests that don't need real auth
- You want to quickly prototype without auth infrastructure
- You're in a trusted development environment
- You need to simulate different users easily

❌ **Don't use this pattern when:**
- You're deploying to production (NEVER!)
- You need real security (this provides none)
- You're exposing the server to untrusted networks
- You need to test actual authentication flows
- Multiple developers share the same environment

---

## Core Principles

1. **Development Only**: Explicitly designed for local development, never for production.

2. **Environment Configuration**: User IDs configured via environment variables.

3. **No Real Validation**: Accepts any request without validation (intentionally insecure).

4. **Easy User Switching**: Change users by updating environment variables.

5. **Fail-Safe Guards**: Includes checks to prevent accidental production use.

6. **Explicit Warnings**: Logs warnings when used to remind developers it's insecure.

---

## Implementation

### Complete Implementation

```typescript
import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';

export interface EnvAuthProviderConfig {
  /**
   * Default user ID to use if no header provided
   * Read from environment variable (e.g., DEV_USER_ID)
   */
  defaultUserId: string;
  
  /**
   * Allow overriding user ID via X-User-ID header
   * Default: true
   */
  allowHeaderOverride?: boolean;
  
  /**
   * Additional metadata to include in auth result
   */
  metadata?: Record<string, any>;
  
  /**
   * Allowed user IDs (for testing multiple users)
   * If provided, only these user IDs are accepted
   */
  allowedUserIds?: string[];
}

export class EnvAuthProvider implements AuthProvider {
  private config: EnvAuthProviderConfig;
  
  constructor(config: EnvAuthProviderConfig) {
    this.config = {
      allowHeaderOverride: true,
      ...config
    };
    
    // Fail-safe: Check if we're accidentally in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '🚨 SECURITY ERROR: EnvAuthProvider cannot be used in production! ' +
        'This provider provides NO SECURITY and should only be used for local development.'
      );
    }
  }
  
  async initialize(): Promise<void> {
    console.warn('⚠️  ═══════════════════════════════════════════════════════');
    console.warn('⚠️  WARNING: Using EnvAuthProvider (NO AUTHENTICATION)');
    console.warn('⚠️  This provider is for DEVELOPMENT ONLY');
    console.warn('⚠️  DO NOT use in production or untrusted environments');
    console.warn('⚠️  Default User ID:', this.config.defaultUserId);
    console.warn('⚠️  ═══════════════════════════════════════════════════════');
  }
  
  async authenticate(context: RequestContext): Promise<AuthResult> {
    // Get user ID from header or use default
    let userId = this.config.defaultUserId;
    
    if (this.config.allowHeaderOverride) {
      const userIdHeader = context.headers?.['x-user-id'];
      if (userIdHeader && !Array.isArray(userIdHeader)) {
        userId = userIdHeader;
      }
    }
    
    // Check if user ID is in allowed list (if configured)
    if (this.config.allowedUserIds && !this.config.allowedUserIds.includes(userId)) {
      return {
        authenticated: false,
        error: `User ID '${userId}' not in allowed list. Allowed: ${this.config.allowedUserIds.join(', ')}`
      };
    }
    
    // Always authenticate successfully (this is the point!)
    return {
      authenticated: true,
      userId,
      metadata: {
        ...this.config.metadata,
        authMethod: 'env',
        warning: 'NO_REAL_AUTHENTICATION'
      }
    };
  }
  
  async cleanup(): Promise<void> {
    console.log('Env auth provider cleaned up');
  }
}
```

---

## Examples

### Example 1: Basic Development Setup

```typescript
import { EnvAuthProvider } from './auth/env-provider';

const authProvider = new EnvAuthProvider({
  defaultUserId: process.env.DEV_USER_ID || 'dev-user-123',
  metadata: {
    email: 'dev@example.com',
    name: 'Development User'
  }
});

await authProvider.initialize();

// Use with wrapServer
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createServer(userId);
  },
  authProvider,
  resourceType: 'dev-resource',
  transport: { type: 'sse', port: 8080 }
});
```

### Example 2: Testing Multiple Users

```typescript
const authProvider = new EnvAuthProvider({
  defaultUserId: 'user-1',
  allowHeaderOverride: true,
  allowedUserIds: ['user-1', 'user-2', 'user-3']
});

// In tests, switch users by setting header
const response1 = await fetch('http://localhost:8080/mcp', {
  headers: { 'X-User-ID': 'user-1' }
});

const response2 = await fetch('http://localhost:8080/mcp', {
  headers: { 'X-User-ID': 'user-2' }
});
```

### Example 3: Environment-Based Configuration

```typescript
// .env.development
// DEV_USER_ID=alice
// DEV_USER_EMAIL=alice@example.com

import { EnvAuthProvider } from './auth/env-provider';

const authProvider = new EnvAuthProvider({
  defaultUserId: process.env.DEV_USER_ID!,
  metadata: {
    email: process.env.DEV_USER_EMAIL,
    environment: 'development'
  }
});
```

### Example 4: Stdio Transport (Local CLI)

```typescript
const authProvider = new EnvAuthProvider({
  defaultUserId: 'local-user',
  allowHeaderOverride: false // No headers in stdio
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createServer(userId);
  },
  authProvider,
  resourceType: 'local',
  transport: { type: 'stdio' } // For local CLI use
});
```

---

## Benefits

### 1. Zero Setup

No OAuth configuration, no JWT secrets, no API keys. Just set an environment variable and start developing.

### 2. Fast Iteration

Change users instantly by updating environment variables or headers. No need to generate new tokens.

### 3. Easy Testing

Test multi-user scenarios by switching user IDs in test cases.

### 4. Debugging Friendly

No authentication failures to debug. Focus on your server logic.

---

## Trade-offs

### 1. Zero Security

**Downside**: Provides absolutely no security. Anyone can access the server.

**Mitigation**: Only use in trusted local environments. Never expose to network. Production guard prevents accidental use.

### 2. Not Representative

**Downside**: Doesn't test real authentication flows. May miss auth-related bugs.

**Mitigation**: Use real auth providers in staging/production. Run integration tests with real auth.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Using in Production

**Description**: Deploying EnvAuthProvider to production or staging environments.

**Why it's bad**: Provides zero security. Anyone can access your server as any user.

**Instead, do this**: The provider includes a production guard that throws an error.

```typescript
// ❌ Bad: Trying to use in production
if (process.env.NODE_ENV === 'production') {
  const authProvider = new EnvAuthProvider({ ... }); // ❌ Throws error!
}

// ✅ Good: Use real auth in production
const authProvider = process.env.NODE_ENV === 'production'
  ? new JWTAuthProvider({ ... })  // ✅ Real auth
  : new EnvAuthProvider({ ... }); // ✅ Dev only
```

### ❌ Anti-Pattern 2: Exposing to Network

**Description**: Running server with EnvAuthProvider on 0.0.0.0 or public IP.

**Why it's bad**: Anyone on the network can access your server without authentication.

**Instead, do this**: Bind to localhost only in development.

```typescript
// ❌ Bad: Exposed to network
transport: {
  type: 'sse',
  port: 8080,
  host: '0.0.0.0' // ❌ Accessible from network!
}

// ✅ Good: Localhost only
transport: {
  type: 'sse',
  port: 8080,
  host: '127.0.0.1' // ✅ Local only
}
```

### ❌ Anti-Pattern 3: Ignoring Warnings

**Description**: Not reading or addressing the security warnings logged by the provider.

**Why it's bad**: Easy to forget this is insecure and accidentally deploy it.

**Instead, do this**: Read the warnings, understand the risks, and ensure proper auth in production.

```typescript
// The provider logs these warnings on initialize():
// ⚠️  WARNING: Using EnvAuthProvider (NO AUTHENTICATION)
// ⚠️  This provider is for DEVELOPMENT ONLY
// ⚠️  DO NOT use in production or untrusted environments

// ✅ Good: Acknowledge and plan for real auth
console.log('Using dev auth - remember to switch to JWT for production!');
```

---

## Testing Strategy

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { EnvAuthProvider } from './env-provider';

describe('EnvAuthProvider', () => {
  it('should always authenticate successfully', async () => {
    const provider = new EnvAuthProvider({
      defaultUserId: 'test-user'
    });
    
    const result = await provider.authenticate({
      headers: {}
    });
    
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('test-user');
  });
  
  it('should allow user ID override via header', async () => {
    const provider = new EnvAuthProvider({
      defaultUserId: 'default-user',
      allowHeaderOverride: true
    });
    
    const result = await provider.authenticate({
      headers: { 'x-user-id': 'override-user' }
    });
    
    expect(result.userId).toBe('override-user');
  });
  
  it('should restrict to allowed user IDs', async () => {
    const provider = new EnvAuthProvider({
      defaultUserId: 'user-1',
      allowedUserIds: ['user-1', 'user-2']
    });
    
    const result = await provider.authenticate({
      headers: { 'x-user-id': 'user-3' }
    });
    
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('not in allowed list');
  });
  
  it('should throw error in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    expect(() => {
      new EnvAuthProvider({ defaultUserId: 'test' });
    }).toThrow('cannot be used in production');
    
    process.env.NODE_ENV = originalEnv;
  });
});
```

---

## Related Patterns

- **[JWT Provider](./mcp-auth-server-base.auth-provider-jwt.md)**: Use in production instead of Env provider
- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use Env provider with wrapServer for development

---

## Configuration Reference

### EnvAuthProviderConfig Interface

```typescript
interface EnvAuthProviderConfig {
  // Required
  defaultUserId: string;              // Default user ID from environment
  
  // Optional
  allowHeaderOverride?: boolean;      // Allow X-User-ID header (default: true)
  metadata?: Record<string, any>;     // Additional metadata
  allowedUserIds?: string[];          // Restrict to specific user IDs
}
```

---

## Checklist for Implementation

- [ ] Only used in development environment (NODE_ENV !== 'production')
- [ ] Server bound to localhost (127.0.0.1), not 0.0.0.0
- [ ] Security warnings acknowledged and understood
- [ ] Real authentication configured for production
- [ ] Environment variables documented in .env.example
- [ ] Tests use EnvAuthProvider for simplicity
- [ ] Production deployment uses real auth provider
- [ ] Team aware this is development-only

---

**Status**: Stable - For development use only
**Recommendation**: Use ONLY for local development and testing, never in production
**Last Updated**: 2026-02-21
**Contributors**: Common development pattern
