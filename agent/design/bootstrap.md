# Bootstrap Pattern for Brave Search MCP Wrapper

**Created**: 2026-02-13  
**Status**: Ready for Implementation  
**Reference Projects**:
- `/home/prmichaelsen/agentbase-mcp-server` - Instagram MCP wrapper
- `/home/prmichaelsen/mcp-auth` - Authentication framework
- `/home/prmichaelsen/brave-search-mcp-server` - Underlying Brave Search MCP server

---

## Overview

This pattern describes how to create a multi-tenant wrapper for the Brave Search MCP server using `@prmichaelsen/mcp-auth`. The wrapper enables Platform JWT authentication and per-user Brave API key management without modifying the underlying `@brave/brave-search-mcp-server` package.

## Architecture

```
Client (Platform JWT)
  ↓
Platform JWT Provider (validates JWT → userId)
  ↓
Platform Token Resolver (userId → Brave API key via platform API)
  ↓
Brave Search Server Factory (creates per-user server instance)
  ↓
Brave Search API (via user's API key)
```

## Key Characteristics

| Aspect | Details |
|--------|---------|
| **Credentials** | Per-user Brave API keys |
| **Platform Stores** | Brave API keys per user |
| **Authentication** | Platform JWT validation |
| **Token Type** | Brave API key string |
| **Setup** | One wrapper for all users |
| **Isolation** | Per-user server instances |

## Project Structure

```
brave-search-mcp-wrapper/              # New wrapper project
├── src/
│   ├── index.ts                       # Main entry point with wrapServer
│   ├── factory.ts                     # Adapter factory for Brave Search
│   └── auth/
│       ├── platform-jwt-provider.ts   # JWT validation
│       └── platform-token-resolver.ts # API key resolution
├── agent/
│   └── design/
│       └── bootstrap.md               # This file
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile                         # For Cloud Run deployment
├── cloudbuild.yaml                    # GCP build configuration
└── README.md
```

## Implementation Steps

### Step 1: Create New Project

```bash
mkdir brave-search-mcp-wrapper
cd brave-search-mcp-wrapper
npm init -y
```

### Step 2: Install Dependencies

```json
{
  "name": "@prmichaelsen/brave-search-mcp-wrapper",
  "version": "1.0.0",
  "description": "Multi-tenant Brave Search MCP server with Platform JWT authentication",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "@brave/brave-search-mcp-server": "^2.0.72",
    "@prmichaelsen/mcp-auth": "^7.0.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^22.10.2",
    "tsx": "^4.7.0",
    "typescript": "^5.7.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 3: Create Adapter Factory

**File**: `src/factory.ts`

```typescript
import createMcpServer from '@brave/brave-search-mcp-server/dist/server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Factory adapter for Brave Search MCP server
 * 
 * Translates mcp-auth's (accessToken, userId) signature
 * to Brave Search's configuration-based initialization.
 * 
 * @param accessToken - User's Brave API key
 * @param userId - Platform user ID (for logging/tracking)
 * @returns Configured McpServer instance
 */
export function createBraveSearchServer(
  accessToken: string,
  userId?: string
): McpServer {
  console.log(`[Factory] Creating Brave Search server for user: ${userId}`);
  
  // Create server with user's Brave API key
  return createMcpServer({
    config: {
      braveApiKey: accessToken,
      loggingLevel: 'info',
      stateless: true, // Important for multi-tenant deployments
      // Optional: Configure enabled/disabled tools per user
      // enabledTools: ['brave_web_search', 'brave_local_search'],
    }
  });
}
```

### Step 4: Create Platform JWT Provider

**File**: `src/auth/platform-jwt-provider.ts`

```typescript
import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';

export interface PlatformJWTProviderConfig {
  serviceToken: string;      // Shared secret for JWT validation
  issuer?: string;           // Expected issuer (default: 'agentbase.me')
  audience?: string;         // Expected audience (default: 'mcp-server')
  cacheResults?: boolean;    // Cache auth results (default: true)
  cacheTtl?: number;         // Cache TTL in ms (default: 60000)
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
  jwtToken: string;
}

export class PlatformJWTProvider implements AuthProvider {
  private config: Required<PlatformJWTProviderConfig>;
  private authCache = new Map<string, CachedAuthResult>();
  public jwtTokenCache = new Map<string, string>();
  
  constructor(config: PlatformJWTProviderConfig) {
    this.config = {
      issuer: 'agentbase.me',
      audience: 'mcp-server',
      cacheResults: true,
      cacheTtl: 60000,
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    console.log('[PlatformJWTProvider] Initialized');
  }
  
  async authenticate(context: RequestContext): Promise<AuthResult> {
    try {
      const authHeader = context.headers?.['authorization'];
      
      if (!authHeader || Array.isArray(authHeader)) {
        return {
          authenticated: false,
          error: 'No authorization header provided'
        };
      }
      
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return {
          authenticated: false,
          error: 'Invalid authorization header format'
        };
      }
      
      const token = parts[1];
      
      // Check cache
      if (this.config.cacheResults) {
        const cached = this.authCache.get(token);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result;
        }
      }
      
      // Verify JWT
      const decoded = jwt.verify(token, this.config.serviceToken, {
        issuer: this.config.issuer,
        audience: this.config.audience
      }) as jwt.JwtPayload & { userId: string };
      
      if (!decoded.userId) {
        return {
          authenticated: false,
          error: 'Invalid token: missing userId claim'
        };
      }
      
      const result: AuthResult = {
        authenticated: true,
        userId: decoded.userId,
        metadata: {
          issuer: decoded.iss,
          audience: decoded.aud,
          issuedAt: decoded.iat,
          expiresAt: decoded.exp
        }
      };
      
      // Cache result and JWT token
      if (this.config.cacheResults) {
        this.authCache.set(token, {
          result,
          expiresAt: Date.now() + this.config.cacheTtl,
          jwtToken: token
        });
      }
      
      this.jwtTokenCache.set(decoded.userId, token);
      return result;
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { authenticated: false, error: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { authenticated: false, error: `Invalid token: ${error.message}` };
      }
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
  
  async cleanup(): Promise<void> {
    this.authCache.clear();
    this.jwtTokenCache.clear();
  }
  
  getJWTToken(userId: string): string | undefined {
    return this.jwtTokenCache.get(userId);
  }
}
```

### Step 5: Create Platform Token Resolver

**File**: `src/auth/platform-token-resolver.ts`

```typescript
import type { ResourceTokenResolver, CredentialsAPIResponse } from '@prmichaelsen/mcp-auth';
import type { PlatformJWTProvider } from './platform-jwt-provider.js';

export interface PlatformTokenResolverConfig {
  platformUrl: string;
  authProvider: PlatformJWTProvider;
  cacheTokens?: boolean;
  cacheTtl?: number;
}

interface CachedToken {
  apiKey: string;
  expiresAt: number;
}

/**
 * Platform Token Resolver
 * 
 * Resolves Brave API keys from platform API.
 * The platform stores each user's Brave API key and returns it
 * when requested with a valid JWT token.
 */
export class PlatformTokenResolver implements ResourceTokenResolver {
  private config: PlatformTokenResolverConfig;
  private tokenCache = new Map<string, CachedToken>();
  
  constructor(config: PlatformTokenResolverConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    console.log('[PlatformTokenResolver] Initialized');
  }
  
  async resolveToken(userId: string, resourceType: string): Promise<string | null> {
    try {
      const cacheKey = `${userId}:${resourceType}`;
      
      // Check cache
      if (this.config.cacheTokens !== false) {
        const cached = this.tokenCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          return cached.apiKey;
        }
      }
      
      // Get JWT token from auth provider
      const jwtToken = this.config.authProvider.getJWTToken(userId);
      if (!jwtToken) {
        console.warn(`[PlatformTokenResolver] No JWT token for user ${userId}`);
        return null;
      }
      
      // Call platform API to get user's Brave API key
      const url = `${this.config.platformUrl}/api/credentials/${resourceType}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'X-User-ID': userId,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[PlatformTokenResolver] No Brave API key for user ${userId}`);
          return null;
        }
        throw new Error(`Platform API error: ${response.status}`);
      }
      
      const data = await response.json() as CredentialsAPIResponse;
      
      // For Brave Search, the "access_token" field contains the API key
      const apiKey = data.access_token;
      
      if (!apiKey) {
        console.warn('[PlatformTokenResolver] Invalid API key from platform');
        return null;
      }
      
      // Cache API key
      if (this.config.cacheTokens !== false) {
        const ttl = this.config.cacheTtl || 300000; // 5 minutes
        this.tokenCache.set(cacheKey, {
          apiKey,
          expiresAt: Date.now() + ttl
        });
      }
      
      console.log(`[PlatformTokenResolver] Resolved API key for user ${userId}`);
      return apiKey;
      
    } catch (error) {
      console.error('[PlatformTokenResolver] Failed to resolve token:', error);
      return null;
    }
  }
  
  async cleanup(): Promise<void> {
    this.tokenCache.clear();
  }
}
```

### Step 6: Create Main Entry Point

**File**: `src/index.ts`

```typescript
#!/usr/bin/env node

import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createBraveSearchServer } from './factory.js';
import { PlatformJWTProvider } from './auth/platform-jwt-provider.js';
import { PlatformTokenResolver } from './auth/platform-token-resolver.js';

// Configuration from environment
const config = {
  platform: {
    url: process.env.PLATFORM_URL!,
    serviceToken: process.env.PLATFORM_SERVICE_TOKEN!
  },
  server: {
    port: parseInt(process.env.PORT || '8080')
  }
};

// Validate configuration
if (!config.platform.serviceToken) {
  console.error('Error: PLATFORM_SERVICE_TOKEN environment variable is required');
  console.error('This should match the service_token stored in the platform database for this MCP server');
  process.exit(1);
}

if (!config.platform.url) {
  console.error('Error: PLATFORM_URL environment variable is required');
  process.exit(1);
}

// Create authentication providers
const authProvider = new PlatformJWTProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'agentbase.me',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 1 minute
});

const tokenResolver = new PlatformTokenResolver({
  platformUrl: config.platform.url,
  authProvider: authProvider,  // Pass auth provider to access JWT tokens
  cacheTokens: true,
  cacheTtl: 300000 // 5 minutes
});

// Wrap the Brave Search server factory with authentication
const wrappedServer = wrapServer({
  // Server factory: creates a new Brave Search server per user
  serverFactory: (braveApiKey: string, userId: string) => {
    return createBraveSearchServer(braveApiKey, userId);
  },
  
  // Authentication
  authProvider,
  tokenResolver,
  resourceType: 'brave-search', // Platform API endpoint: /api/credentials/brave-search
  
  // Transport
  transport: {
    type: 'sse',
    port: config.server.port,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN || 'https://agentbase.me'
  },
  
  // Optional middleware
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60 * 60 * 1000 // 1 hour per user
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
    console.log(`Brave Search MCP Wrapper running on port ${config.server.port}`);
    console.log(`Endpoint: http://0.0.0.0:${config.server.port}/mcp`);
    console.log('Ready to accept requests');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await wrappedServer.stop();
  process.exit(0);
});

// Start the server
main();
```

### Step 7: Configuration Files

**File**: `.env.example`

```env
# Platform JWT (shared secret for JWT validation)
PLATFORM_SERVICE_TOKEN=your-shared-secret

# Platform API (for user API key resolution)
PLATFORM_URL=https://your-platform.com

# Server
PORT=8080
NODE_ENV=development
LOG_LEVEL=info

# CORS (optional)
CORS_ORIGIN=https://agentbase.me
```

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 8: Docker Deployment

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist ./dist

# Expose port
EXPOSE 8080

# Run server
CMD ["node", "dist/index.js"]
```

**File**: `cloudbuild.yaml` (for Google Cloud Build)

```yaml
steps:
  # Build TypeScript
  - name: 'node:18'
    entrypoint: npm
    args: ['ci']
  - name: 'node:18'
    entrypoint: npm
    args: ['run', 'build']
  
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:latest'
      - '.'
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:$COMMIT_SHA'
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'brave-search-mcp-wrapper'
      - '--image'
      - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'PLATFORM_URL=${_PLATFORM_URL}'
      - '--set-secrets'
      - 'PLATFORM_SERVICE_TOKEN=platform-service-token:latest'

images:
  - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/brave-search-mcp-wrapper:latest'
```

## Platform API Requirements

The platform must implement a credentials endpoint:

```typescript
// GET /api/credentials/brave-search
// Headers: { Authorization: Bearer <jwt-token>, X-User-ID: <user-id> }

export async function GET(request: Request) {
  // 1. Validate JWT
  const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  const userId = request.headers.get('X-User-ID');
  
  // 2. Query database for user's Brave API key
  const user = await db.query(
    'SELECT brave_api_key FROM user_credentials WHERE user_id = $1 AND resource_type = $2',
    [userId, 'brave-search']
  );
  
  if (!user.rows[0]?.brave_api_key) {
    return Response.json(
      { error: 'Brave API key not configured' },
      { status: 404 }
    );
  }
  
  // 3. Return API key in access_token field (mcp-auth convention)
  return Response.json({
    access_token: user.rows[0].brave_api_key,
    // Optional: include expiry if keys rotate
    // expires_at: user.rows[0].key_expires_at
  });
}
```

## Testing

### Local Development

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your values

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Run in dev mode
npm run dev

# 5. Test with curl
curl -X POST http://localhost:8080/mcp/message \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Generate Test JWT

```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'test-user' },
  'your-service-token',
  {
    issuer: 'agentbase.me',
    audience: 'mcp-server',
    expiresIn: '1h'
  }
);
console.log(token);
```

### Test with MCP Inspector

```bash
# Install inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector
npx @modelcontextprotocol/inspector --transport http \
  --url http://localhost:8080/mcp \
  --header "Authorization: Bearer <jwt-token>"
```

## Deployment to Cloud Run

```bash
# 1. Build and push
gcloud builds submit --config cloudbuild.yaml

# 2. Set secrets
echo -n "your-service-token" | gcloud secrets create platform-service-token --data-file=-

# 3. Deploy
gcloud run deploy brave-search-mcp-wrapper \
  --image gcr.io/PROJECT_ID/brave-search-mcp-wrapper:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars PLATFORM_URL=https://your-platform.com,CORS_ORIGIN=https://your-app.com \
  --set-secrets PLATFORM_SERVICE_TOKEN=platform-service-token:latest
```

## Security Considerations

1. **API Key Protection**
   - Store as encrypted secrets in platform database
   - Never log API keys
   - Rotate periodically
   - Use separate keys per environment

2. **JWT Validation**
   - Verify issuer and audience
   - Check expiration
   - Use strong shared secret (min 32 bytes)
   - Rotate service tokens regularly

3. **Rate Limiting**
   - Per-user rate limits (100 req/hour)
   - Brave API quotas apply per key
   - Monitor and alert on abuse

4. **CORS Configuration**
   - Always specify explicit origins
   - Never use wildcard in production
   - Validate origin against whitelist

## Key Advantages

✅ **Zero Modification**: Underlying `@brave/brave-search-mcp-server` unchanged  
✅ **Multi-Tenancy**: Single server serves all users  
✅ **Platform JWT Auth**: Secure authentication via platform  
✅ **Per-User Isolation**: Each user uses their own API key  
✅ **Centralized Credentials**: Platform manages user API keys  
✅ **Audit Trail**: All operations logged with userId  
✅ **Scalable**: Cloud Run auto-scales based on demand  

## Architecture Benefits

### Adapter Pattern
- Translates between mcp-auth and Brave Search interfaces
- No coupling between packages
- Easy to update either package independently

### Separation of Concerns
- **Brave Search MCP Server**: Search functionality
- **Wrapper**: Authentication & multi-tenancy
- **Platform**: User management & credentials

### Flexibility
- Can wrap any MCP server with exported factory
- Reusable auth providers across projects
- Easy to add new features (logging, metrics, etc.)

## Next Steps

1. Create new repository for wrapper project
2. Implement authentication providers (copy from agentbase-mcp-server)
3. Create adapter factory
4. Set up Cloud Run deployment
5. Configure platform API endpoint
6. Test with real users
7. Monitor and optimize

## Comparison with Other Wrappers

| Feature | Instagram Wrapper | Brave Search Wrapper |
|---------|------------------|---------------------|
| **Base Package** | `@prmichaelsen/agentbase` | `@brave/brave-search-mcp-server` |
| **Credential Type** | OAuth tokens | API keys |
| **Token Refresh** | Yes (via platform) | No (keys don't expire) |
| **Factory Import** | `createInstagramServer` | `createMcpServer` |
| **Resource Type** | `instagram` | `brave-search` |
| **Complexity** | Medium (OAuth flow) | Low (simple API key) |

---

**Status**: Ready for implementation  
**Reference**: See `/home/prmichaelsen/agentbase-mcp-server` for working example  
**Base Package**: `/home/prmichaelsen/brave-search-mcp-server`
