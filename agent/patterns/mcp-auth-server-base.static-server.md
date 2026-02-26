# Static Server Pattern

**Category**: Architecture
**Applicable To**: MCP servers using @prmichaelsen/mcp-auth without per-user credentials
**Status**: Stable

---

## Overview

The Static Server Pattern demonstrates how to build MCP servers that use authentication for user identification but don't require per-user credential fetching. This pattern is simpler than dynamic servers and suitable for scenarios where the server doesn't need external API access tokens or where all users share the same credentials.

This pattern addresses the challenge of building authenticated, multi-tenant MCP servers that provide user-specific data isolation without the complexity of managing per-user credentials for external services.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Your server doesn't need external API credentials
- Your server provides its own data/functionality (not a proxy to external services)
- All users share the same backend credentials (static_with_credentials variant)
- You want simpler deployment without credential management
- Your server only needs user identification for data isolation
- You're building internal tools that don't integrate with external APIs

❌ **Don't use this pattern when:**
- Your server needs per-user access tokens (use dynamic server with token resolver)
- Each user needs different credentials for external services
- Your server proxies requests to user-specific external APIs
- You need to access user-owned resources on external platforms

---

## Core Principles

1. **Authentication for Identity**: Authentication is used solely for user identification, not credential fetching.

2. **No Token Resolver**: Server configuration doesn't include a tokenResolver, simplifying the architecture.

3. **Shared or No Credentials**: Server either needs no external credentials or uses shared credentials for all users.

4. **Data Isolation**: Per-user data isolation is achieved through userId, not through separate credentials.

5. **Simplified Deployment**: No need to configure platform credentials API or manage token caching.

6. **Two Variants**: Pure static (no credentials) and static_with_credentials (shared credentials).

---

## Implementation

### Structure

```
src/
├── index.ts              # Main entry point (no token resolver)
├── auth/
│   └── provider.ts       # Auth provider implementation
├── server/
│   └── factory.ts        # Server factory (no accessToken needed)
└── data/
    └── storage.ts        # User-specific data storage
```

### Variant 1: Pure Static Server

Server that doesn't need any external credentials.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from './server/factory';
import { JWTAuthProvider } from './auth/jwt-provider';

// Create auth provider
const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// Wrap server WITHOUT token resolver
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // accessToken will be empty string since no tokenResolver
    // Only userId is used for data isolation
    return await createServer(userId);
  },
  authProvider,
  // NO tokenResolver - this makes it a static server
  resourceType: 'static-resource',
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
      maxRequests: 100,
      windowMs: 60 * 60 * 1000
    },
    logging: {
      enabled: true,
      level: 'info'
    }
  }
});

await wrappedServer.start();
```

### Variant 2: Static with Credentials

Server that uses shared credentials for all users (fetched from platform's integration provider endpoint).

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from './server/factory';
import { JWTAuthProvider } from './auth/jwt-provider';

// Fetch shared credentials once at startup
async function getSharedCredentials(): Promise<string> {
  const response = await fetch(
    `${process.env.PLATFORM_URL}/api/integration-providers/brave-search`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.PLATFORM_SERVICE_TOKEN}`
      }
    }
  );
  
  const data = await response.json();
  return data.credentials.api_key;
}

// Create auth provider
const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// Fetch shared credentials at startup
const sharedApiKey = await getSharedCredentials();

// Wrap server with shared credentials
const wrappedServer = wrapServer({
  serverFactory: async (accessToken: string, userId: string) => {
    // Use shared credentials for all users
    return await createServer(sharedApiKey, userId);
  },
  authProvider,
  // NO tokenResolver - credentials are shared, not per-user
  resourceType: 'brave-search',
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

---

## Examples

### Example 1: Calculator Server (Pure Static)

Server that provides calculation functionality without any external dependencies.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { JWTAuthProvider } from './auth/jwt-provider';

function createCalculatorServer(userId: string): Server {
  const server = new Server(
    {
      name: 'calculator-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  
  // Add calculator tools
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'add',
        description: 'Add two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        }
      }
    ]
  }));
  
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name === 'add') {
      const { a, b } = request.params.arguments as { a: number; b: number };
      return {
        content: [
          {
            type: 'text',
            text: `Result: ${a + b}`
          }
        ]
      };
    }
    throw new Error('Unknown tool');
  });
  
  return server;
}

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return createCalculatorServer(userId);
  },
  authProvider,
  resourceType: 'calculator',
  transport: { type: 'sse', port: 8080 }
});

await wrappedServer.start();
```

### Example 2: Note-Taking Server (Pure Static with Data Isolation)

Server that stores user-specific notes without external credentials.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { JWTAuthProvider } from './auth/jwt-provider';
import { Database } from './data/database';

const db = new Database();

function createNotesServer(userId: string): Server {
  const server = new Server(
    {
      name: 'notes-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );
  
  // List user's notes
  server.setRequestHandler('resources/list', async () => {
    const notes = await db.getNotes(userId); // Per-user data isolation
    return {
      resources: notes.map(note => ({
        uri: `note:///${note.id}`,
        name: note.title,
        mimeType: 'text/plain'
      }))
    };
  });
  
  // Add note tool
  server.setRequestHandler('tools/call', async (request) => {
    if (request.params.name === 'add_note') {
      const { title, content } = request.params.arguments as any;
      await db.addNote(userId, title, content); // Per-user storage
      return {
        content: [{ type: 'text', text: 'Note added successfully' }]
      };
    }
    throw new Error('Unknown tool');
  });
  
  return server;
}

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return createNotesServer(userId);
  },
  authProvider,
  resourceType: 'notes',
  transport: { type: 'sse', port: 8080 }
});

await wrappedServer.start();
```

### Example 3: Brave Search Server (Static with Credentials)

Server that uses shared Brave Search API key for all users.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createBraveSearchServer } from './server/brave-search';
import { JWTAuthProvider } from './auth/jwt-provider';

// Fetch shared Brave API key from platform
async function getBraveApiKey(): Promise<string> {
  const response = await fetch(
    `${process.env.PLATFORM_URL}/api/integration-providers/brave-search`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.PLATFORM_SERVICE_TOKEN}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Brave API key');
  }
  
  const data = await response.json();
  return data.credentials.api_key;
}

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// Fetch shared credentials at startup
const braveApiKey = await getBraveApiKey();
console.log('✅ Fetched shared Brave API key');

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // All users share the same Brave API key
    return await createBraveSearchServer(braveApiKey, userId);
  },
  authProvider,
  resourceType: 'brave-search',
  transport: { type: 'sse', port: 8080 }
});

await wrappedServer.start();
```

### Example 4: Database Query Server (Static with Credentials)

Server that uses shared database credentials for all users with row-level security.

```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createDatabaseServer } from './server/database';
import { JWTAuthProvider } from './auth/jwt-provider';

const authProvider = new JWTAuthProvider({
  secret: process.env.JWT_SECRET!,
  issuer: 'your-platform.com',
  audience: 'mcp-server'
});

// Shared database credentials (from environment)
const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!
};

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // All users share database connection
    // Row-level security enforced by passing userId to queries
    return await createDatabaseServer(dbConfig, userId);
  },
  authProvider,
  resourceType: 'database',
  transport: { type: 'sse', port: 8080 }
});

await wrappedServer.start();
```

---

## Benefits

### 1. Simplicity

No token resolver configuration, no platform credentials API integration, no token caching. Simpler to deploy and maintain.

### 2. Faster Startup

No need to fetch credentials at runtime. Server starts immediately without waiting for credential fetching.

### 3. Reduced Dependencies

No dependency on external platform's credentials API. Server is more self-contained and resilient.

### 4. Lower Latency

No credential fetching overhead on first request. Users get faster response times.

### 5. Easier Testing

No need to mock credential fetching APIs. Testing is simpler and more reliable.

---

## Trade-offs

### 1. No Per-User External Access

**Downside**: Can't access user-specific resources on external platforms (GitHub repos, Firebase projects, etc.).

**Mitigation**: Use dynamic server pattern with token resolver if per-user access is needed.

### 2. Shared Credentials Limitations

**Downside**: With static_with_credentials, all users share the same API quota/rate limits.

**Mitigation**: Implement server-side rate limiting per user. Consider dynamic pattern for high-traffic scenarios.

### 3. Less Flexible

**Downside**: Can't adapt to different user permissions on external services.

**Mitigation**: Implement permission checks in your server logic based on userId.

---

## Comparison: Static vs Dynamic Servers

| Aspect | Static Server | Dynamic Server |
|--------|--------------|----------------|
| **Token Resolver** | ❌ No | ✅ Yes |
| **Per-User Credentials** | ❌ No | ✅ Yes |
| **External API Access** | Shared or None | Per-User |
| **Complexity** | Low | Medium |
| **Startup Time** | Fast | Medium (credential fetch) |
| **First Request Latency** | Low | Medium (credential fetch) |
| **Use Case** | Internal tools, calculators, shared APIs | GitHub, Firebase, user-owned resources |
| **Credential Management** | Simple | Complex |
| **Multi-Tenancy** | Via userId only | Via userId + credentials |

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Using Static Pattern for User-Owned Resources

**Description**: Building a static server to access user-specific external resources.

**Why it's bad**: Users can't access their own resources. All users share the same access or have no access.

**Instead, do this**: Use dynamic server pattern with token resolver.

```typescript
// ❌ Bad: Static server for GitHub (can't access user's repos)
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // No way to access user's GitHub repos!
    return await createGitHubServer(userId);
  },
  authProvider,
  // Missing tokenResolver - can't get user's GitHub token
  resourceType: 'github',
  transport: { type: 'sse', port: 8080 }
});

// ✅ Good: Dynamic server for GitHub
const tokenResolver = new PlatformTokenResolver({
  platformUrl: process.env.PLATFORM_URL!,
  authProvider
});

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    // accessToken contains user's GitHub token
    return await createGitHubServer(accessToken, userId);
  },
  authProvider,
  tokenResolver, // ✅ Fetches per-user GitHub tokens
  resourceType: 'github',
  transport: { type: 'sse', port: 8080 }
});
```

### ❌ Anti-Pattern 2: Fetching Credentials Per Request

**Description**: Fetching shared credentials on every request instead of at startup.

**Why it's bad**: Adds unnecessary latency and API calls. Defeats the purpose of static pattern.

**Instead, do this**: Fetch shared credentials once at startup.

```typescript
// ❌ Bad: Fetch on every request
const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    const apiKey = await fetchSharedApiKey(); // ❌ Slow!
    return await createServer(apiKey, userId);
  },
  authProvider,
  resourceType: 'api',
  transport: { type: 'sse', port: 8080 }
});

// ✅ Good: Fetch once at startup
const sharedApiKey = await fetchSharedApiKey(); // ✅ Once!

const wrappedServer = wrapServer({
  serverFactory: async (accessToken, userId) => {
    return await createServer(sharedApiKey, userId); // ✅ Fast!
  },
  authProvider,
  resourceType: 'api',
  transport: { type: 'sse', port: 8080 }
});
```

### ❌ Anti-Pattern 3: Ignoring Data Isolation

**Description**: Not using userId to isolate user data in static servers.

**Why it's bad**: Users can access each other's data. Security vulnerability.

**Instead, do this**: Always use userId for data isolation.

```typescript
// ❌ Bad: No data isolation
server.setRequestHandler('resources/list', async () => {
  const notes = await db.getAllNotes(); // ❌ All users' notes!
  return { resources: notes };
});

// ✅ Good: Per-user data isolation
server.setRequestHandler('resources/list', async () => {
  const notes = await db.getNotes(userId); // ✅ Only this user's notes
  return { resources: notes };
});
```

---

## Testing Strategy

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createNotesServer } from './server/notes';

describe('Static Notes Server', () => {
  it('should isolate notes by userId', async () => {
    const server1 = createNotesServer('user-1');
    const server2 = createNotesServer('user-2');
    
    // Add note for user-1
    await server1.request({
      method: 'tools/call',
      params: {
        name: 'add_note',
        arguments: { title: 'User 1 Note', content: 'Content' }
      }
    });
    
    // User-2 shouldn't see user-1's notes
    const user2Notes = await server2.request({
      method: 'resources/list',
      params: {}
    });
    
    expect(user2Notes.resources).toHaveLength(0);
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wrapServer } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';

describe('Static Server Integration', () => {
  let wrappedServer: any;
  const secret = 'test-secret';
  
  beforeAll(async () => {
    wrappedServer = wrapServer({
      serverFactory: async (accessToken, userId) => {
        return createNotesServer(userId);
      },
      authProvider: new JWTAuthProvider({ secret, issuer: 'test', audience: 'test' }),
      resourceType: 'notes',
      transport: { type: 'sse', port: 8082 }
    });
    
    await wrappedServer.start();
  });
  
  afterAll(async () => {
    await wrappedServer.stop();
  });
  
  it('should work without token resolver', async () => {
    const token = jwt.sign({ userId: 'user-1' }, secret, {
      issuer: 'test',
      audience: 'test'
    });
    
    const response = await fetch('http://localhost:8082/mcp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'resources/list',
        params: {}
      })
    });
    
    expect(response.ok).toBe(true);
  });
});
```

---

## Related Patterns

- **[Server Wrapping](./mcp-auth-server-base.server-wrapping.md)**: Use static pattern with wrapServer
- **[Token Resolver](./mcp-auth-server-base.token-resolver.md)**: Alternative pattern for dynamic servers
- **[Auth Provider - JWT](./mcp-auth-server-base.auth-provider-jwt.md)**: Authentication for static servers

---

## Decision Guide

**Use Static Server when:**
- ✅ Server provides its own functionality (calculator, notes, database queries)
- ✅ All users share the same external API credentials
- ✅ You want simplicity and fast startup
- ✅ You don't need per-user external resource access

**Use Dynamic Server when:**
- ✅ Server accesses user-owned external resources (GitHub repos, Firebase projects)
- ✅ Each user needs their own API credentials
- ✅ You need to respect per-user permissions on external platforms
- ✅ Users connect their own accounts to external services

---

## Checklist for Implementation

- [ ] Server doesn't require per-user external credentials
- [ ] wrapServer configured WITHOUT tokenResolver
- [ ] Shared credentials (if needed) fetched at startup, not per request
- [ ] Server factory uses userId for data isolation
- [ ] All data access queries filter by userId
- [ ] Authentication provider configured correctly
- [ ] Transport configuration matches deployment environment
- [ ] Rate limiting configured appropriately
- [ ] Unit tests verify data isolation by userId
- [ ] Integration tests verify server works without token resolver
- [ ] Documentation explains why static pattern was chosen

---

**Status**: Stable - Common pattern for internal tools
**Recommendation**: Use for servers that don't need per-user external credentials
**Last Updated**: 2026-02-21
**Contributors**: Common MCP server pattern
