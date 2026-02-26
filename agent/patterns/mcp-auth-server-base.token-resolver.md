# Token Resolver Pattern

**Category**: Authentication
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth with dynamic credential fetching
**Status**: Stable

---

## Overview

The Token Resolver Pattern demonstrates how to implement dynamic per-user credential fetching for MCP servers. This pattern fetches user-specific access tokens from external platforms (like GitHub, Firebase, or custom APIs) and provides them to the server factory function. It enables true multi-tenancy where each user's server instance operates with their own credentials.

This pattern addresses the challenge of providing per-user access to external services without storing credentials in the MCP server itself. Instead, credentials are fetched on-demand from a trusted platform that manages user authentication and authorization.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Your MCP server needs per-user credentials for external services
- Users authenticate through a platform that manages their credentials
- You're building servers that access user-specific resources (GitHub repos, Firebase projects, etc.)
- You want to avoid storing user credentials in your server
- Your platform provides a credentials API endpoint
- You need to support credential rotation without server changes

❌ **Don't use this pattern when:**
- Your server doesn't need external credentials (use static server pattern)
- All users share the same credentials (use static with credentials pattern)
- You're building for local development only (use env provider)
- Your platform doesn't provide a credentials API

---

## Core Principles

1. **On-Demand Fetching**: Credentials are fetched when needed, not stored permanently.

2. **Token Caching**: Fetched tokens are cached (5 min TTL) to reduce API calls and improve performance.

3. **JWT Forwarding**: Uses the user's JWT token to authenticate with the platform's credentials API.

4. **Graceful Degradation**: Returns null if credentials aren't available, allowing server to handle missing credentials appropriately.

5. **Platform Agnostic**: Generic implementation works with any platform that provides a credentials API.

6. **Security by Design**: Credentials never stored permanently, only cached temporarily in memory.

---

## Implementation

### Structure

```
src/
├── auth/
│   ├── token-resolver.ts     # Token resolver implementation
│   └── jwt-provider.ts       # JWT provider (for token forwarding)
├── config/
│   └── environment.ts        # Platform configuration
└── types/
    └── credentials.ts        # Credential types
```

### Complete Implementation

```typescript
import type { ResourceTokenResolver } from '@prmichaelsen/mcp-auth';
import type { JWTAuthProvider } from './jwt-provider';

export interface TokenResolverConfig {
  /**
   * Platform URL for credentials API
   * Example: 'https://your-platform.com'
   */
  platformUrl: string;
  
  /**
   * Auth provider instance (for JWT token access)
   */
  authProvider: JWTAuthProvider;
  
  /**
   * Enable token caching
   * Default: true
   */
  cacheTokens?: boolean;
  
  /**
   * Cache TTL in milliseconds
   * Default: 300000 (5 minutes)
   */
  cacheTtl?: number;
  
  /**
   * Custom headers to include in API requests
   */
  customHeaders?: Record<string, string>;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class PlatformTokenResolver implements ResourceTokenResolver {
  private config: TokenResolverConfig;
  private tokenCache = new Map<string, CachedToken>();
  
  constructor(config: TokenResolverConfig) {
    this.config = {
      cacheTokens: true,
      cacheTtl: 300000, // 5 minutes
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    console.log('Platform token resolver initialized');
    console.log(`  Platform URL: ${this.config.platformUrl}`);
    console.log(`  Caching: ${this.config.cacheTokens ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Resolve access token for a user and resource type
   * 
   * @param userId - User ID from authentication
   * @param resourceType - Type of resource (e.g., 'github', 'firebase')
   * @returns Access token or null if not available
   */
  async resolveToken(userId: string, resourceType: string): Promise<string | null> {
    try {
      const cacheKey = `${userId}:${resourceType}`;
      
      // Check cache first
      if (this.config.cacheTokens) {
        const cached = this.tokenCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          console.log(`Cache hit for ${userId}:${resourceType}`);
          return cached.token;
        }
      }
      
      // Get JWT token from auth provider for platform authentication
      const jwtToken = this.config.authProvider.getJWTToken(userId);
      if (!jwtToken) {
        console.warn(`No JWT token found for user ${userId}`);
        return null;
      }
      
      // Call platform credentials API
      const url = `${this.config.platformUrl}/api/credentials/${resourceType}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${jwtToken}`,
        'X-User-ID': userId,
        'Content-Type': 'application/json',
        ...this.config.customHeaders
      };
      
      console.log(`Fetching ${resourceType} credentials for user ${userId}`);
      
      const response = await fetch(url, { headers });
      
      // Handle 404 - user hasn't connected this resource
      if (response.status === 404) {
        console.warn(`No ${resourceType} credentials configured for user ${userId}`);
        return null;
      }
      
      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Platform API error:', {
          status: response.status,
          error: errorData
        });
        throw new Error(
          `Platform API error: ${errorData.error || response.statusText}`
        );
      }
      
      // Parse response
      const data = await response.json();
      const token = data.access_token;
      
      if (!token) {
        console.warn(`No access_token in response for ${userId}:${resourceType}`);
        return null;
      }
      
      // Cache token
      if (this.config.cacheTokens) {
        this.tokenCache.set(cacheKey, {
          token,
          expiresAt: Date.now() + this.config.cacheTtl!
        });
        console.log(`Cached token for ${userId}:${resourceType} (TTL: ${this.config.cacheTtl}ms)`);
      }
      
      return token;
      
    } catch (error) {
      console.error(`Failed to resolve token for ${userId}:${resourceType}:`, error);
      return null;
    }
  }
  
  /**
   * Clear cached token for a specific user and resource
   */
  clearCache(userId: string, resourceType: string): void {
    const cacheKey = `${userId}:${resourceType}`;
    this.tokenCache.delete(cacheKey);
    console.log(`Cleared cache for ${cacheKey}`);
  }
  
  /**
   * Clear all cached tokens
   */
  async cleanup(): Promise<void> {
    this.tokenCache.clear();
    console.log('Token resolver cleaned up');
  }
}
```

---

## Examples

### Example 1: Basic Token Resolver Setup

```typescript
import { PlatformTokenResolver } from './auth/token-resolver';
import { JWTAuthProvider } from './auth/jwt-provider';
import { wrapServer } from '@prmichaelsen/mcp-auth';

// Create auth provider
const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// Create token resolver
const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  authProvider
});

// Use with wrapServer
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // accessToken contains the user's GitHub token (or other resource token)
    return await createGitHubServer(accessToken, userId);
  },
  authProvider,
  tokenResolver, // Fetches per-user GitHub tokens
  resourceType: 'github',
  transport: { type: 'sse', port: 8080 }
});
```

### Example 2: Multiple Resource Types

```typescript
// Token resolver works with any resource type
const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  authProvider
});

// GitHub server
const githubServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createGitHubServer(accessToken, userId);
  },
  authProvider,
  tokenResolver,
  resourceType: 'github', // Fetches GitHub credentials
  transport: { type: 'sse', port: 8080 }
});

// Firebase server
const firebaseServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createFirebaseServer(accessToken, userId);
  },
  authProvider,
  tokenResolver,
  resourceType: 'firebase', // Fetches Firebase credentials
  transport: { type: 'sse', port: 8081 }
});
```

### Example 3: Custom Cache TTL

```typescript
// Shorter cache for frequently changing credentials
const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  authProvider,
  cacheTokens: true,
  cacheTtl: 60000 // 1 minute (shorter for security-sensitive apps)
});

// Longer cache for stable credentials
const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  authProvider,
  cacheTokens: true,
  cacheTtl: 600000 // 10 minutes (longer for better performance)
});
```

### Example 4: Handling Missing Credentials

```typescript
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string | null, userId: string) => {
    if (!accessToken) {
      // User hasn't connected GitHub yet
      // Return a server with limited functionality or helpful error messages
      return await createLimitedServer(userId, {
        message: 'Please connect your GitHub account to use this server'
      });
    }
    
    // Full functionality with GitHub access
    return await createGitHubServer(accessToken, userId);
  },
  authProvider,
  tokenResolver,
  resourceType: 'github',
  transport: { type: 'sse', port: 8080 }
});
```

### Example 5: Manual Cache Clearing

```typescript
// Clear cache when user updates credentials
app.post('/api/credentials/github', async (req, res) => {
  const userId = req.user.id;
  
  // Update credentials in database
  await updateGitHubCredentials(userId, req.body);
  
  // Clear cached token so next request fetches fresh credentials
  tokenResolver.clearCache(userId, 'github');
  
  res.json({ success: true });
});
```

---

## Benefits

### 1. No Credential Storage

Server never stores user credentials. Credentials are fetched on-demand and cached temporarily, reducing security risk.

### 2. Automatic Credential Rotation

When users update their credentials on the platform, the server automatically uses the new credentials after cache expiration.

### 3. Platform-Managed Security

Platform handles credential encryption, storage, and access control. Server only needs to fetch them.

### 4. Multi-Tenant by Design

Each user gets their own credentials, enabling true multi-tenancy with proper data isolation.

### 5. Performance Through Caching

Token caching reduces API calls to the platform, improving response times and reducing load.

---

## Trade-offs

### 1. Platform Dependency

**Downside**: Server depends on platform's credentials API being available. If platform is down, credential fetching fails.

**Mitigation**: Implement retry logic, use longer cache TTLs, provide graceful degradation.

### 2. Cache Staleness

**Downside**: Cached tokens may be stale if user revokes or updates credentials. Changes take up to cache TTL to propagate.

**Mitigation**: Use shorter cache TTLs for security-sensitive apps, provide manual cache clearing endpoint.

### 3. Additional Latency

**Downside**: First request for each user incurs latency from platform API call.

**Mitigation**: Use caching to minimize API calls, consider pre-fetching for known users.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Storing Fetched Tokens Permanently

**Description**: Saving fetched tokens to database or file system for long-term storage.

**Why it's bad**: Defeats the purpose of on-demand fetching. Creates security risk if storage is compromised.

**Instead, do this**: Only cache in memory with TTL. Let tokens expire and be re-fetched.

```typescript
// ❌ Bad: Permanent storage
async resolveToken(userId: string, resourceType: string): Promise<string | null> {
  const token = await db.tokens.findOne({ userId, resourceType });
  if (token) return token.value; // ❌ Stored permanently!
  
  const newToken = await fetchFromPlatform(userId, resourceType);
  await db.tokens.create({ userId, resourceType, value: newToken }); // ❌ Stored!
  return newToken;
}

// ✅ Good: Memory cache with TTL
async resolveToken(userId: string, resourceType: string): Promise<string | null> {
  const cached = this.tokenCache.get(`${userId}:${resourceType}`);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token; // ✅ Temporary cache
  }
  
  const token = await fetchFromPlatform(userId, resourceType);
  this.tokenCache.set(`${userId}:${resourceType}`, {
    token,
    expiresAt: Date.now() + this.cacheTtl // ✅ Expires!
  });
  return token;
}
```

### ❌ Anti-Pattern 2: No Cache Expiration

**Description**: Caching tokens indefinitely without expiration.

**Why it's bad**: Stale tokens remain valid forever. User credential updates never propagate.

**Instead, do this**: Always set cache TTL (5 minutes recommended).

```typescript
// ❌ Bad: No expiration
this.tokenCache.set(cacheKey, token); // ❌ Never expires!

// ✅ Good: With TTL
this.tokenCache.set(cacheKey, {
  token,
  expiresAt: Date.now() + this.cacheTtl // ✅ Expires after TTL
});
```

### ❌ Anti-Pattern 3: Ignoring Missing Credentials

**Description**: Throwing errors or crashing when credentials aren't available.

**Why it's bad**: Users who haven't connected a service can't use the server at all.

**Instead, do this**: Return null and handle gracefully in server factory.

```typescript
// ❌ Bad: Throws error
async resolveToken(userId: string, resourceType: string): Promise<string> {
  const token = await fetchFromPlatform(userId, resourceType);
  if (!token) {
    throw new Error('Credentials not found'); // ❌ Crashes server!
  }
  return token;
}

// ✅ Good: Returns null
async resolveToken(userId: string, resourceType: string): Promise<string | null> {
  const token = await fetchFromPlatform(userId, resourceType);
  if (!token) {
    console.warn(`No credentials for ${userId}:${resourceType}`);
    return null; // ✅ Graceful handling
  }
  return token;
}

// ✅ Good: Handle in server factory
serverFactory: async (accessToken: string | null, userId: string) => {
  if (!accessToken) {
    return createLimitedServer(userId); // ✅ Provide limited functionality
  }
  return createFullServer(accessToken, userId);
}
```

### ❌ Anti-Pattern 4: Not Forwarding JWT

**Description**: Using service token instead of user's JWT to call credentials API.

**Why it's bad**: Platform can't verify which user is requesting credentials. Security vulnerability.

**Instead, do this**: Always forward the user's JWT token.

```typescript
// ❌ Bad: Service token
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${SERVICE_TOKEN}`, // ❌ Service token!
    'X-User-ID': userId
  }
});

// ✅ Good: User's JWT
const jwtToken = this.authProvider.getJWTToken(userId);
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`, // ✅ User's JWT!
    'X-User-ID': userId
  }
});
```

---

## Testing Strategy

### Unit Testing

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformTokenResolver } from './token-resolver';

describe('PlatformTokenResolver', () => {
  let resolver: PlatformTokenResolver;
  let mockAuthProvider: any;
  
  beforeEach(() => {
    mockAuthProvider = {
      getJWTToken: vi.fn()
    };
    
    resolver = new PlatformTokenResolver({
      platformUrl: 'https://test-platform.com',
      authProvider: mockAuthProvider,
      cacheTokens: false // Disable caching for tests
    });
    
    global.fetch = vi.fn();
  });
  
  it('should fetch token from platform API', async () => {
    mockAuthProvider.getJWTToken.mockReturnValue('jwt-token-123');
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'github-token-456' })
    });
    
    const token = await resolver.resolveToken('user-1', 'github');
    
    expect(token).toBe('github-token-456');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-platform.com/api/credentials/github',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer jwt-token-123',
          'X-User-ID': 'user-1'
        })
      })
    );
  });
  
  it('should return null when credentials not found (404)', async () => {
    mockAuthProvider.getJWTToken.mockReturnValue('jwt-token-123');
    
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' })
    });
    
    const token = await resolver.resolveToken('user-1', 'github');
    
    expect(token).toBeNull();
  });
  
  it('should cache tokens', async () => {
    const resolverWithCache = new PlatformTokenResolver({
      platformUrl: 'https://test-platform.com',
      authProvider: mockAuthProvider,
      cacheTokens: true,
      cacheTtl: 1000
    });
    
    mockAuthProvider.getJWTToken.mockReturnValue('jwt-token-123');
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'github-token-456' })
    });
    
    // First call - fetches from API
    const token1 = await resolverWithCache.resolveToken('user-1', 'github');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Second call - uses cache
    const token2 = await resolverWithCache.resolveToken('user-1', 'github');
    expect(global.fetch).toHaveBeenCalledTimes(1); // Not called again
    
    expect(token1).toBe(token2);
  });
  
  it('should clear cache for specific user/resource', async () => {
    const resolverWithCache = new PlatformTokenResolver({
      platformUrl: 'https://test-platform.com',
      authProvider: mockAuthProvider,
      cacheTokens: true
    });
    
    mockAuthProvider.getJWTToken.mockReturnValue('jwt-token-123');
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'github-token-456' })
    });
    
    // Fetch and cache
    await resolverWithCache.resolveToken('user-1', 'github');
    
    // Clear cache
    resolverWithCache.clearCache('user-1', 'github');
    
    // Next call should fetch again
    await resolverWithCache.resolveToken('user-1', 'github');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
```

---

## Related Patterns

- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use token resolver with wrapServer
- **[JWT Provider](./mcp-auth-server-base.auth-provider-jwt.md)**: Provides JWT tokens for platform authentication
- **[Static Server](./mcp-auth-server-base.static-server.md)**: Alternative pattern when credentials aren't needed

---

## Configuration Reference

### TokenResolverConfig Interface

```typescript
interface TokenResolverConfig {
  // Required
  platformUrl: string;              // Platform credentials API URL
  authProvider: JWTAuthProvider;    // Auth provider for JWT access
  
  // Optional
  cacheTokens?: boolean;            // Enable caching (default: true)
  cacheTtl?: number;                // Cache TTL in ms (default: 300000)
  customHeaders?: Record<string, string>; // Additional headers
}
```

### Platform Credentials API

Expected API endpoint format:
```
GET /api/credentials/{resourceType}
Headers:
  Authorization: Bearer {user-jwt-token}
  X-User-ID: {userId}

Response (200 OK):
{
  "access_token": "user-resource-token",
  "expires_in": 3600,  // Optional
  "refresh_token": "..." // Optional
}

Response (404 Not Found):
{
  "error": "Credentials not configured"
}
```

---

## Checklist for Implementation

- [ ] Platform credentials API endpoint configured
- [ ] Auth provider provides JWT token access (getJWTToken method)
- [ ] Cache TTL set appropriately (5 minutes recommended)
- [ ] 404 responses handled gracefully (return null)
- [ ] JWT token forwarded to platform API (not service token)
- [ ] Server factory handles null accessToken gracefully
- [ ] Cache clearing mechanism implemented (if needed)
- [ ] Error logging provides useful debugging information
- [ ] Unit tests cover token fetching, caching, and error cases
- [ ] Integration tests verify end-to-end credential flow

---

**Status**: Stable - Extracted from production implementation
**Recommendation**: Use for dynamic servers that need per-user credentials
**Last Updated**: 2026-02-21
**Contributors**: Extracted from remember-mcp-server
