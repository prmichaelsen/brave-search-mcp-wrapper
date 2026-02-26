# Server Wrapping Pattern

**Category**: Architecture
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth
**Status**: Stable

---

## Overview

The Server Wrapping Pattern demonstrates how to wrap an MCP server with authentication and multi-tenancy support using the `wrapServer` function from [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth). This pattern transforms a standard MCP server into a multi-tenant, authenticated service that can handle per-user isolation and credential management.

The pattern addresses the challenge of adding authentication, multi-tenancy, and operational features (rate limiting, logging, health checks) to MCP servers without modifying the core server implementation. By wrapping the server factory function, you gain authentication, per-user server instances, and production-ready features with minimal code.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- You need to add authentication to an MCP server
- You want multi-tenant support with per-user data isolation
- You need to deploy MCP servers in production environments
- You want to add rate limiting, logging, and health checks
- You're building MCP servers for platforms that require user authentication
- You need to support SSE (Server-Sent Events) transport for web clients

❌ **Don't use this pattern when:**
- You're building a local-only MCP server for personal use
- Authentication is not required for your use case
- You're using stdio transport exclusively (though wrapping still works)
- The overhead of authentication is not justified for your application

---

## Core Principles

1. **Server Factory Pattern**: The wrapped server receives a factory function that creates per-user server instances, not a single shared server instance.

2. **Per-User Isolation**: Each authenticated user gets their own server instance with isolated state and credentials.

3. **Authentication Provider Integration**: Authentication is handled by pluggable auth providers (JWT, OAuth, API Key, etc.).

4. **Transport Abstraction**: The wrapper handles transport details (SSE, stdio) so the core server doesn't need to.

5. **Operational Features**: Rate limiting, logging, health checks, and CORS are provided by the wrapper.

6. **Graceful Lifecycle**: The wrapper manages server startup, shutdown, and cleanup automatically.

---

## Implementation

### Structure

```
src/
├── index.ts              # Main entry point with wrapServer
├── auth/
│   └── provider.ts       # Auth provider implementation
├── config/
│   └── environment.ts    # Environment configuration
└── types/
    └── index.ts          # Type definitions
```

### Basic Implementation

```typescript
#!/usr/bin/env node

import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from './your-mcp-server/factory';
import { YourAuthProvider } from './auth/provider';

// Configuration
const config = {
  platform: {
    url: process.env.PLATFORM_URL!,
    serviceToken: process.env.PLATFORM_SERVICE_TOKEN!
  },
  server: {
    port: parseInt(process.env.PORT || '8080')
  }
};

// Validate required configuration
if (!config.platform.serviceToken) {
  console.error('Error: PLATFORM_SERVICE_TOKEN environment variable is required');
  process.exit(1);
}

if (!config.platform.url) {
  console.error('Error: PLATFORM_URL environment variable is required');
  process.exit(1);
}

// Create auth provider
const authProvider = new YourAuthProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'your-platform.com',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 60 seconds
});

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // Create a new server instance for this user
    return await createServer(accessToken, userId);
  },
  authProvider,
  resourceType: 'your-resource',
  transport: {
    type: 'sse',
    port: config.server.port,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN || 'https://your-platform.com'
  },
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60 * 60 * 1000 // 1 hour
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  }
});

// Start server
async function main() {
  try {
    await wrappedServer.start();
    console.log(`✅ MCP Server started successfully`);
    console.log(`📡 Listening on port ${config.server.port}`);
    console.log(`🔗 Endpoint: http://0.0.0.0:${config.server.port}/mcp`);
    console.log(`🏥 Health check: http://0.0.0.0:${config.server.port}/mcp/health`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

// Start the server
main();
```

### Key Components

#### Component 1: Server Factory Function

The server factory is called for each authenticated user and must return a new server instance.

```typescript
serverFactory: async (accessToken: string, userId: string) => {
  // accessToken: User's access token (if using token resolver)
  // userId: Unique identifier for the authenticated user
  
  // Create per-user server instance
  return await createServer(accessToken, userId);
}
```

**Important**: The factory must return a **new instance** for each user, not a shared singleton.

#### Component 2: Auth Provider

The auth provider validates authentication credentials and extracts user identity.

```typescript
const authProvider = new YourAuthProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'your-platform.com',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000
});
```

See [Auth Provider Patterns](./mcp-auth-server-base.auth-provider-jwt.md) for implementation details.

#### Component 3: Transport Configuration

Configure how the server communicates with clients.

```typescript
transport: {
  type: 'sse',              // 'sse' or 'stdio'
  port: 8080,               // Port to listen on (SSE only)
  host: '0.0.0.0',          // Host to bind to (SSE only)
  basePath: '/mcp',         // Base path for endpoints (SSE only)
  cors: true,               // Enable CORS (SSE only)
  corsOrigin: 'https://...' // Allowed origin (SSE only)
}
```

#### Component 4: Middleware Configuration

Add operational features like rate limiting and logging.

```typescript
middleware: {
  rateLimit: {
    enabled: true,
    maxRequests: 100,        // Max requests per window
    windowMs: 60 * 60 * 1000 // Time window in milliseconds
  },
  logging: {
    enabled: true,
    level: 'info'            // 'debug' | 'info' | 'warn' | 'error'
  }
}
```

---

## Examples

### Example 1: Static Server (No Token Resolver)

A server that doesn't need per-user credentials, only authentication.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from '@your-org/public-data-mcp/factory';
import { JWTAuthProvider } from './auth/jwt-provider';

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // No external credentials needed
    // Just create server with user ID for data isolation
    return await createServer(userId);
  },
  authProvider,
  resourceType: 'public-data',
  transport: {
    type: 'sse',
    port: 8080,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN!
  }
});

await wrappedServer.start();
```

### Example 2: Dynamic Server with Token Resolver

A server that fetches per-user credentials from an external platform.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from '@your-org/github-mcp/factory';
import { JWTAuthProvider } from './auth/jwt-provider';
import { PlatformTokenResolver } from './auth/token-resolver';

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  serviceToken: process.env.PLATFORM_SERVICE_TOKEN!,
  cacheTtl: 5 * 60 * 1000 // 5 minutes
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // accessToken contains the user's GitHub token
    // fetched by tokenResolver
    return await createServer(accessToken, userId);
  },
  authProvider,
  tokenResolver, // Fetches per-user credentials
  resourceType: 'github',
  transport: {
    type: 'sse',
    port: 8080,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN!
  }
});

await wrappedServer.start();
```

See [Token Resolver Pattern](./mcp-auth-server-base.token-resolver.md) for implementation details.

### Example 3: Stdio Transport (Local Development)

Using stdio transport for local development or CLI usage.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from './your-mcp-server/factory';
import { EnvAuthProvider } from './auth/env-provider';

const authProvider = new EnvAuthProvider({
  allowedUsers: ['local-user']
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    return await createServer(userId);
  },
  authProvider,
  resourceType: 'local',
  transport: {
    type: 'stdio' // Use stdio instead of SSE
  }
});

await wrappedServer.start();
```

### Example 4: Custom Middleware Configuration

Advanced middleware configuration with custom rate limits.

```typescript
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    return await createServer(accessToken, userId);
  },
  authProvider,
  resourceType: 'premium',
  transport: {
    type: 'sse',
    port: 8080,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN!
  },
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 1000,        // Higher limit for premium
      windowMs: 60 * 60 * 1000  // 1 hour
    },
    logging: {
      enabled: true,
      level: 'debug'             // More verbose logging
    }
  }
});
```

---

## Benefits

### 1. Authentication Without Code Changes

Add authentication to existing MCP servers without modifying the server implementation. The wrapper handles all authentication logic.

### 2. Multi-Tenancy by Default

Each user automatically gets their own server instance with isolated state. No risk of data leakage between users.

### 3. Production-Ready Features

Get rate limiting, logging, health checks, and CORS support out of the box. No need to implement these features yourself.

### 4. Flexible Authentication

Support multiple authentication schemes (JWT, OAuth, API Key) by swapping auth providers. The server code remains unchanged.

### 5. Transport Abstraction

Switch between SSE and stdio transports without changing server logic. The wrapper handles transport details.

### 6. Graceful Lifecycle Management

The wrapper manages server startup, shutdown, and cleanup. Proper signal handling for production deployments.

---

## Trade-offs

### 1. Additional Abstraction Layer

**Downside**: Adds a wrapper layer between clients and your server, which can make debugging more complex.

**Mitigation**: Enable debug logging to see what the wrapper is doing. The wrapper provides detailed logs for troubleshooting.

### 2. Memory Overhead

**Downside**: Each user gets their own server instance, which uses more memory than a shared server.

**Mitigation**: This is intentional for data isolation. Use rate limiting and connection limits to control resource usage. For high-scale deployments, consider horizontal scaling.

### 3. Learning Curve

**Downside**: Requires understanding the wrapper's configuration options and lifecycle.

**Mitigation**: This pattern document and examples provide clear guidance. Start with minimal configuration and add features as needed.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Shared Server Instance

**Description**: Creating a single server instance outside the factory and returning it for all users.

**Why it's bad**: Breaks multi-tenancy. All users share the same server instance and can access each other's data.

**Instead, do this**: Create a new server instance inside the factory for each user.

```typescript
// ❌ Bad: Shared instance
const sharedServer = await createServer();

const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    return sharedServer; // ❌ All users share this instance!
  },
  authProvider,
  resourceType: 'bad-example',
  transport: { type: 'sse', port: 8080 }
});

// ✅ Good: Per-user instance
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    return await createServer(accessToken, userId); // ✅ New instance per user
  },
  authProvider,
  resourceType: 'good-example',
  transport: { type: 'sse', port: 8080 }
});
```

### ❌ Anti-Pattern 2: Ignoring Graceful Shutdown

**Description**: Not handling SIGINT/SIGTERM signals to stop the server gracefully.

**Why it's bad**: Server doesn't clean up resources properly. Can lead to data corruption or resource leaks.

**Instead, do this**: Always handle shutdown signals and call `wrappedServer.stop()`.

```typescript
// ❌ Bad: No shutdown handling
await wrappedServer.start();
// Server runs forever, no cleanup on exit

// ✅ Good: Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

await wrappedServer.start();
```

### ❌ Anti-Pattern 3: Missing Configuration Validation

**Description**: Not validating required environment variables before starting the server.

**Why it's bad**: Server starts but fails at runtime when configuration is accessed. Hard to debug.

**Instead, do this**: Validate configuration early and fail fast with clear error messages.

```typescript
// ❌ Bad: No validation
const config = {
  serviceToken: process.env.PLATFORM_SERVICE_TOKEN
};

// ✅ Good: Early validation
const config = {
  serviceToken: process.env.PLATFORM_SERVICE_TOKEN
};

if (!config.serviceToken) {
  console.error('Error: PLATFORM_SERVICE_TOKEN environment variable is required');
  process.exit(1);
}
```

### ❌ Anti-Pattern 4: Exposing Sensitive Data in Health Check

**Description**: Including sensitive information in health check responses.

**Why it's bad**: Health checks are often unauthenticated. Sensitive data can leak to unauthorized users.

**Instead, do this**: The wrapper provides a basic health check at `/mcp/health`. Don't add custom health checks with sensitive data.

```typescript
// ❌ Bad: Custom health check with secrets
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: process.env.DATABASE_URL, // ❌ Exposed!
    apiKey: process.env.API_KEY         // ❌ Exposed!
  });
});

// ✅ Good: Use wrapper's built-in health check
// The wrapper provides /mcp/health automatically
// It only returns { status: 'ok' } - no sensitive data
```

---

## Testing Strategy

### Unit Testing

Test the server factory function in isolation.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createServer } from './your-mcp-server/factory';

describe('Server Factory', () => {
  it('should create server with user ID', async () => {
    const accessToken = 'test-token';
    const userId = 'user-123';
    
    const server = await createServer(accessToken, userId);
    
    expect(server).toBeDefined();
    expect(server.userId).toBe(userId);
  });
  
  it('should create isolated instances per user', async () => {
    const server1 = await createServer('token1', 'user-1');
    const server2 = await createServer('token2', 'user-2');
    
    expect(server1).not.toBe(server2);
    expect(server1.userId).not.toBe(server2.userId);
  });
});
```

### Integration Testing

Test the wrapped server with authentication.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from './your-mcp-server/factory';
import { TestAuthProvider } from './test/auth-provider';

describe('Wrapped Server', () => {
  let wrappedServer: any;
  
  beforeAll(async () => {
    const authProvider = new TestAuthProvider();
    
    wrappedServer = wrapServer({
      serverFactory: async (accessToken: string, userId: string) => {
        return await createServer(accessToken, userId);
      },
      authProvider,
      resourceType: 'test',
      transport: {
        type: 'sse',
        port: 8081,
        host: '0.0.0.0',
        basePath: '/mcp'
      }
    });
    
    await wrappedServer.start();
  });
  
  afterAll(async () => {
    await wrappedServer.stop();
  });
  
  it('should respond to health check', async () => {
    const response = await fetch('http://localhost:8081/mcp/health');
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
  
  it('should require authentication', async () => {
    const response = await fetch('http://localhost:8081/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'test' })
    });
    
    expect(response.status).toBe(401); // Unauthorized
  });
});
```

---

## Related Patterns

- **[Auth Provider - JWT](./mcp-auth-server-base.auth-provider-jwt.md)**: Implement JWT authentication for the wrapper
- **[Token Resolver](./mcp-auth-server-base.token-resolver.md)**: Fetch per-user credentials dynamically
- **[Static Server](./mcp-auth-server-base.static-server.md)**: Pattern for servers without token resolver
- **[Error Handling](./mcp-auth-server-base.error-handling.md)**: Handle errors in wrapped servers
- **[Logging](./mcp-auth-server-base.logging.md)**: Configure logging for wrapped servers

---

## Configuration Reference

### wrapServer Options

```typescript
interface WrapServerOptions {
  // Required
  serverFactory: (accessToken: string, userId: string) => Promise<Server>;
  authProvider: AuthProvider;
  resourceType: string;
  
  // Optional
  tokenResolver?: TokenResolver;
  transport?: TransportConfig;
  middleware?: MiddlewareConfig;
}

interface TransportConfig {
  type: 'sse' | 'stdio';
  
  // SSE-specific options
  port?: number;           // Default: 8080
  host?: string;           // Default: '0.0.0.0'
  basePath?: string;       // Default: '/mcp'
  cors?: boolean;          // Default: false
  corsOrigin?: string;     // Required if cors: true
}

interface MiddlewareConfig {
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;   // Max requests per window
    windowMs: number;      // Time window in milliseconds
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

---

## Checklist for Implementation

- [ ] Server factory creates new instance per user (not shared)
- [ ] Auth provider is properly configured and tested
- [ ] Required environment variables are validated early
- [ ] Transport configuration matches deployment environment
- [ ] CORS origin is configured for production domain
- [ ] Rate limiting is enabled with appropriate limits
- [ ] Logging is enabled with appropriate level
- [ ] Graceful shutdown handlers are implemented (SIGINT, SIGTERM)
- [ ] Health check endpoint is accessible
- [ ] Server factory handles errors gracefully
- [ ] Token resolver is implemented if needed (dynamic servers)
- [ ] Integration tests verify authentication works
- [ ] Documentation explains server-specific configuration

---

**Status**: Stable - Extracted from production implementations
**Recommendation**: Use this pattern for all MCP servers requiring authentication and multi-tenancy
**Last Updated**: 2026-02-21
**Contributors**: Extracted from remember-mcp-server and task-mcp-server
