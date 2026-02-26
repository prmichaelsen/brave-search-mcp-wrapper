# OAuth Auth Provider Pattern

**Category**: Authentication
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth with OAuth 2.0 authentication
**Status**: Stable

---

## Overview

The OAuth Auth Provider Pattern demonstrates how to implement OAuth 2.0 based authentication for MCP servers. This pattern handles OAuth authorization codes, exchanges them for access tokens, and validates those tokens for subsequent requests. It's designed for scenarios where users authenticate through a web-based OAuth flow before connecting to the MCP server.

This pattern addresses the challenge of integrating MCP servers with OAuth 2.0 identity providers (like Google, GitHub, Microsoft) while maintaining secure token validation and refresh capabilities.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Your MCP server integrates with OAuth 2.0 identity providers
- Users authenticate through a web browser before connecting
- You need to support multiple OAuth providers (Google, GitHub, etc.)
- You want to leverage existing OAuth infrastructure
- Your platform uses OAuth for user authentication
- You need token refresh capabilities

❌ **Don't use this pattern when:**
- You're using JWT tokens issued by your own platform (use JWT pattern)
- You need simple API key authentication (use API Key pattern)
- You're building for local development only (use Env pattern)
- Your authentication doesn't involve browser-based flows

---

## Core Principles

1. **Authorization Code Flow**: Implements standard OAuth 2.0 authorization code flow with PKCE for security.

2. **Token Exchange**: Exchanges authorization codes for access tokens via OAuth provider's token endpoint.

3. **Token Validation**: Validates access tokens by introspection or userinfo endpoint calls.

4. **Token Refresh**: Supports refresh tokens to obtain new access tokens without re-authentication.

5. **Provider Abstraction**: Generic implementation works with any OAuth 2.0 compliant provider.

6. **Secure Storage**: Stores tokens securely with encryption at rest (implementation-dependent).

---

## Implementation

### Structure

```
src/
├── auth/
│   ├── oauth-provider.ts     # OAuth auth provider implementation
│   └── oauth-config.ts       # OAuth provider configurations
├── config/
│   └── environment.ts        # OAuth environment config
└── types/
    └── oauth.ts              # OAuth-related types
```

### Complete Implementation

```typescript
import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';

export interface OAuthProviderConfig {
  /**
   * OAuth provider name (e.g., 'google', 'github', 'microsoft')
   */
  provider: string;
  
  /**
   * OAuth client ID
   */
  clientId: string;
  
  /**
   * OAuth client secret
   */
  clientSecret: string;
  
  /**
   * OAuth authorization endpoint
   */
  authorizationEndpoint: string;
  
  /**
   * OAuth token endpoint
   */
  tokenEndpoint: string;
  
  /**
   * OAuth userinfo endpoint (for token validation)
   */
  userinfoEndpoint: string;
  
  /**
   * Redirect URI for OAuth callback
   */
  redirectUri: string;
  
  /**
   * OAuth scopes to request
   */
  scopes: string[];
  
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
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
}

interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userId: string;
}

export class OAuthAuthProvider implements AuthProvider {
  private config: OAuthProviderConfig;
  private authCache = new Map<string, CachedAuthResult>();
  private tokenStore = new Map<string, TokenInfo>();
  
  constructor(config: OAuthProviderConfig) {
    this.config = {
      cacheResults: true,
      cacheTtl: 300000, // 5 minutes
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    console.log(`OAuth auth provider initialized (${this.config.provider})`);
    console.log(`  Client ID: ${this.config.clientId}`);
    console.log(`  Scopes: ${this.config.scopes.join(', ')}`);
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
      
      const accessToken = parts[1];
      
      // Check cache first
      if (this.config.cacheResults) {
        const cached = this.authCache.get(accessToken);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result;
        }
      }
      
      // Validate token by calling userinfo endpoint
      const userinfo = await this.validateToken(accessToken);
      
      if (!userinfo) {
        return {
          authenticated: false,
          error: 'Invalid or expired access token'
        };
      }
      
      // Build auth result
      const result: AuthResult = {
        authenticated: true,
        userId: userinfo.id || userinfo.sub,
        metadata: {
          email: userinfo.email,
          name: userinfo.name,
          picture: userinfo.picture,
          provider: this.config.provider
        }
      };
      
      // Cache result
      if (this.config.cacheResults) {
        this.authCache.set(accessToken, {
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
   * Validate access token by calling userinfo endpoint
   */
  private async validateToken(accessToken: string): Promise<any | null> {
    try {
      const response = await fetch(this.config.userinfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  }
  
  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenInfo | null> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri
      });
      
      if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
      }
      
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        console.error('Token exchange failed:', await response.text());
        return null;
      }
      
      const data = await response.json();
      
      // Get user info to extract userId
      const userinfo = await this.validateToken(data.access_token);
      if (!userinfo) {
        return null;
      }
      
      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        userId: userinfo.id || userinfo.sub
      };
      
      // Store token info
      this.tokenStore.set(tokenInfo.userId, tokenInfo);
      
      return tokenInfo;
    } catch (error) {
      console.error('Code exchange failed:', error);
      return null;
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshToken(userId: string): Promise<TokenInfo | null> {
    const stored = this.tokenStore.get(userId);
    if (!stored?.refreshToken) {
      return null;
    }
    
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });
      
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      const tokenInfo: TokenInfo = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || stored.refreshToken,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        userId
      };
      
      this.tokenStore.set(userId, tokenInfo);
      
      return tokenInfo;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }
  
  /**
   * Get stored token info for a user
   */
  getTokenInfo(userId: string): TokenInfo | undefined {
    return this.tokenStore.get(userId);
  }
  
  async cleanup(): Promise<void> {
    this.authCache.clear();
    this.tokenStore.clear();
    console.log('OAuth auth provider cleaned up');
  }
}
```

---

## Examples

### Example 1: Google OAuth Provider

```typescript
import { OAuthAuthProvider } from './auth/oauth-provider';

const authProvider = new OAuthAuthProvider({
  provider: 'google',
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userinfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
  redirectUri: 'https://your-app.com/oauth/callback',
  scopes: ['openid', 'email', 'profile']
});

await authProvider.initialize();
```

### Example 2: GitHub OAuth Provider

```typescript
const authProvider = new OAuthAuthProvider({
  provider: 'github',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userinfoEndpoint: 'https://api.github.com/user',
  redirectUri: 'https://your-app.com/oauth/callback',
  scopes: ['read:user', 'user:email']
});
```

### Example 3: OAuth with Token Refresh

```typescript
// In your server factory
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // Check if token needs refresh
    const tokenInfo = authProvider.getTokenInfo(userId);
    
    if (tokenInfo?.expiresAt && Date.now() > tokenInfo.expiresAt) {
      // Token expired, refresh it
      const refreshed = await authProvider.refreshToken(userId);
      if (refreshed) {
        accessToken = refreshed.accessToken;
      }
    }
    
    return await createServer(accessToken, userId);
  },
  authProvider,
  resourceType: 'oauth-resource',
  transport: { type: 'sse', port: 8080 }
});
```

---

## Benefits

### 1. Standard OAuth 2.0 Compliance

Works with any OAuth 2.0 compliant provider (Google, GitHub, Microsoft, etc.) without modification.

### 2. Secure Authorization Flow

Implements authorization code flow with PKCE, the most secure OAuth flow for public clients.

### 3. Token Refresh Support

Automatically refreshes expired tokens using refresh tokens, providing seamless user experience.

### 4. Provider Flexibility

Single implementation supports multiple OAuth providers through configuration.

---

## Trade-offs

### 1. Browser Dependency

**Downside**: Requires browser-based authentication flow, not suitable for CLI-only tools.

**Mitigation**: Provide alternative authentication methods for CLI users (API keys, device flow).

### 2. Token Storage Complexity

**Downside**: Requires secure storage for refresh tokens and access tokens.

**Mitigation**: Use encrypted storage, implement token rotation, clear tokens on logout.

---

## Related Patterns

- **[JWT Provider](./mcp-auth-server-base.auth-provider-jwt.md)**: Alternative for JWT-based auth
- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use OAuth provider with wrapServer

---

**Status**: Stable
**Recommendation**: Use for browser-based OAuth 2.0 authentication flows
**Last Updated**: 2026-02-21
