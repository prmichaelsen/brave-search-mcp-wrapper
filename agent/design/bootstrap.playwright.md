# Bootstrap Pattern for Playwright MCP Wrapper

**Created**: 2026-02-14  
**Status**: Ready for Implementation  
**Reference Projects**:
- `/home/prmichaelsen/brave-search-mcp-wrapper` - Brave Search MCP wrapper (static server pattern)
- `/home/prmichaelsen/remember-mcp-server` - Remember MCP wrapper (static server pattern)
- `/home/prmichaelsen/mcp-auth` - Authentication framework

---

## Overview

This pattern describes how to create a multi-tenant wrapper for a Playwright browser automation MCP server using `@prmichaelsen/mcp-auth`. The wrapper enables Platform JWT authentication for browser automation without requiring per-user configuration or OAuth.

## Architecture

```
Client (Platform JWT)
  ↓
Platform JWT Provider (validates JWT → userId)
  ↓
Playwright MCP Server Factory (creates per-user browser session)
  ↓
Playwright Browser (isolated automation context)
```

## Key Characteristics

| Aspect | Details |
|--------|---------|
| **Server Type** | Static (no OAuth) |
| **Credentials** | None required (public web browsing) |
| **Authentication** | Platform JWT validation only |
| **Setup** | One wrapper for all users |
| **Isolation** | Per-user browser sessions |
| **Resource Type** | Not needed (no token resolution) |

## Why Static Server?

Playwright browser automation is a **utility service**, not a user data service:

- ✅ Doesn't access user accounts
- ✅ Doesn't need user permissions
- ✅ Just browses public web pages
- ✅ Like a calculator or weather service
- ✅ Available to all users immediately

## Project Structure

```
playwright-mcp-wrapper/                # New wrapper project
├── src/
│   ├── index.ts                       # Main entry point with wrapServer
│   └── auth/
│       └── platform-jwt-provider.ts   # JWT validation
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
mkdir playwright-mcp-wrapper
cd playwright-mcp-wrapper
npm init -y
```

### Step 2: Install Dependencies

```json
{
  "name": "@prmichaelsen/playwright-mcp-wrapper",
  "version": "1.0.0",
  "description": "Multi-tenant Playwright MCP server with Platform JWT authentication",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "script": "tsx",
    "script:upload-secrets": "tsx scripts/upload-secrets.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "@playwright/mcp-server": "^1.0.0",
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

### Step 3: Create Platform JWT Provider

**File**: `src/auth/platform-jwt-provider.ts`

```typescript
#!/usr/bin/env node

import type { AuthProvider, AuthResult, RequestContext } from '@prmichaelsen/mcp-auth';
import jwt from 'jsonwebtoken';

export interface PlatformJWTProviderConfig {
  serviceToken: string;
  issuer: string;
  audience: string;
  cacheResults?: boolean;
  cacheTtl?: number;
}

interface CachedAuthResult {
  result: AuthResult;
  expiresAt: number;
}

export class PlatformJWTProvider implements AuthProvider {
  private config: PlatformJWTProviderConfig;
  private authCache = new Map<string, CachedAuthResult>();
  
  constructor(config: PlatformJWTProviderConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    console.log('Platform JWT auth provider initialized');
  }
  
  async authenticate(context: RequestContext): Promise<AuthResult> {
    try {
      const authHeader = context.headers?.['authorization'];
      
      if (!authHeader || Array.isArray(authHeader)) {
        return { authenticated: false, error: 'No authorization header' };
      }
      
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return { authenticated: false, error: 'Invalid authorization format' };
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
      }) as { userId: string; email?: string };
      
      const result: AuthResult = {
        authenticated: true,
        userId: decoded.userId,
        metadata: {
          email: decoded.email
        }
      };
      
      // Cache result
      if (this.config.cacheResults) {
        const ttl = this.config.cacheTtl || 60000;
        this.authCache.set(token, {
          result,
          expiresAt: Date.now() + ttl
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
  
  async cleanup(): Promise<void> {
    this.authCache.clear();
  }
}
```

### Step 4: Create Main Entry Point

**File**: `src/index.ts`

```typescript
#!/usr/bin/env node

/**
 * Playwright MCP Wrapper - Multi-tenant wrapper with Platform JWT auth
 * 
 * This server wraps Playwright MCP with authentication and multi-tenancy support.
 */

import { wrapServer } from '@prmichaelsen/mcp-auth';
import createPlaywrightServer from '@playwright/mcp-server'; // Adjust import based on actual package
import { PlatformJWTProvider } from './auth/platform-jwt-provider.js';

// Configuration
const config = {
  platform: {
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

console.log('🔧 Configuration:');
console.log(`  - Server Type: Static (no OAuth)`);
console.log(`  - Port: ${config.server.port}`);

// Create auth provider
const authProvider = new PlatformJWTProvider({
  serviceToken: config.platform.serviceToken,
  issuer: 'agentbase.me',
  audience: 'mcp-server',
  cacheResults: true,
  cacheTtl: 60000 // 60 seconds
});

// Wrap server with authentication
const wrappedServer = wrapServer({
  serverFactory: (_accessToken: string, userId: string) => {
    console.log(`[Factory] Creating Playwright server for user: ${userId}`);
    
    // Create server with isolated browser context per user
    return createPlaywrightServer({
      // Configuration options for Playwright
      headless: true,
      timeout: 30000,
      // Ensure isolated browser contexts per user
      contextOptions: {
        userAgent: `PlaywrightMCP/1.0 (userId: ${userId})`
      }
    });
  },
  authProvider,
  resourceType: 'playwright',
  // No tokenResolver - static server, no credentials needed
  transport: {
    type: 'http',
    port: config.server.port,
    host: '0.0.0.0',
    basePath: '/mcp',
    cors: true,
    corsOrigin: process.env.CORS_ORIGIN || 'https://agentbase.me'
  },
  middleware: {
    rateLimit: {
      enabled: true,
      maxRequests: 50, // Lower limit for browser automation
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
    console.log(`✅ Playwright MCP Wrapper started successfully`);
    console.log(`📡 Listening on port ${config.server.port}`);
    console.log(`🔗 Endpoint: http://0.0.0.0:${config.server.port}/mcp`);
    console.log(`🏥 Health check: http://0.0.0.0:${config.server.port}/mcp/health`);
    console.log(`🔐 Authentication: Platform JWT (agentbase.me)`);
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

### Step 5: Configuration Files

**File**: `.env.example`

```env
# Platform JWT Authentication
# Shared secret for JWT validation (must match platform database)
PLATFORM_SERVICE_TOKEN=your-shared-secret-here

# Server Configuration
PORT=8080
NODE_ENV=development
LOG_LEVEL=info

# CORS Configuration
CORS_ORIGIN=https://agentbase.me

# Playwright Configuration (optional)
# PLAYWRIGHT_HEADLESS=true
# PLAYWRIGHT_TIMEOUT=30000
```

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "types": ["node"],
    
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

### Step 6: Docker Deployment

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use installed Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 8080

# Run server
CMD ["node", "dist/index.js"]
```

**File**: `cloudbuild.yaml`

```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:latest'
      - '.'
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:$COMMIT_SHA'
  
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:latest'
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'playwright-mcp-wrapper'
      - '--image=gcr.io/$PROJECT_ID/playwright-mcp-wrapper:$COMMIT_SHA'
      - '--platform=managed'
      - '--region=us-central1'
      - '--allow-unauthenticated'
      - '--min-instances=0'
      - '--max-instances=10'
      - '--memory=1Gi'
      - '--cpu=2'
      - '--timeout=300s'
      - '--set-env-vars=NODE_ENV=production,CORS_ORIGIN=${_CORS_ORIGIN}'
      - '--update-secrets=PLATFORM_SERVICE_TOKEN=playwright-platform-service-token:latest'

images:
  - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/playwright-mcp-wrapper:latest'

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

## Static Server Pattern

### Key Differences from OAuth-Dependent Servers

| Feature | Static (Playwright) | OAuth-Dependent (Instagram) |
|---------|--------------------|-----------------------------|
| **Token Resolver** | ❌ Not needed | ✅ Required |
| **Resource Type** | ✅ For identification only | ✅ For token resolution |
| **Per-User Credentials** | ❌ None | ✅ OAuth tokens |
| **Setup Complexity** | 🟢 Simple | 🟡 Complex |
| **User Configuration** | ❌ None | ✅ Must connect account |

### Code Pattern

```typescript
// Static server - NO tokenResolver
const wrappedServer = wrapServer({
  serverFactory: (_accessToken: string, userId: string) => {
    // No access token needed for static servers
    // Just create isolated context per user
    return createPlaywrightServer({
      contextOptions: {
        userAgent: `PlaywrightMCP/1.0 (userId: ${userId})`
      }
    });
  },
  authProvider,
  resourceType: 'playwright',  // For identification, not token resolution
  // NO tokenResolver - static servers don't need it
  transport: { type: 'http', port: 8080, basePath: '/mcp' }
});
```

## Testing

### Local Development

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with PLATFORM_SERVICE_TOKEN

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

## Deployment to Cloud Run

```bash
# 1. Generate service token
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Upload secret
npm run script:upload-secrets

# 3. Deploy
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_CORS_ORIGIN=https://agentbase.me,COMMIT_SHA=$(git rev-parse HEAD)
```

## Registration in Platform

```bash
npx tsx scripts/create-mcp-server.ts \
  --id playwright-mcp-server \
  --name "Playwright Browser Automation" \
  --provider playwright \
  --type static \
  --endpoint https://playwright-mcp-wrapper-xxx.run.app/mcp \
  --service-token "$PLATFORM_SERVICE_TOKEN" \
  --transport http \
  --description "Multi-tenant browser automation with Playwright"
```

## Security Considerations

### 1. **Browser Isolation**
- Each user gets isolated browser context
- No shared state between users
- Cookies and storage isolated per session

### 2. **Resource Limits**
- Higher memory (1Gi) for browser processes
- Higher CPU (2) for rendering
- Longer timeout (300s) for complex pages
- Lower rate limit (50 req/hour) due to resource intensity

### 3. **Content Security**
- Users can only browse public web pages
- No access to authenticated content
- No persistent browser state
- Each request creates fresh context

## Key Advantages

✅ **No User Configuration**: Works immediately for all users  
✅ **No OAuth Flow**: No account connection needed  
✅ **Multi-Tenancy**: Single server serves all users  
✅ **Isolated Sessions**: Each user gets separate browser context  
✅ **Simple Setup**: Just JWT authentication  
✅ **Scalable**: Cloud Run auto-scales based on demand  

## Architecture Benefits

### Static Server Pattern
- No per-user credentials to manage
- No token resolution needed
- No platform API integration required
- Simpler deployment and maintenance

### Separation of Concerns
- **Playwright MCP Server**: Browser automation functionality
- **Wrapper**: Authentication & multi-tenancy
- **Platform**: User management only (no credential storage)

### Flexibility
- Can wrap any MCP server that doesn't need OAuth
- Reusable auth provider across projects
- Easy to add new static servers

## Comparison with Other Wrappers

| Feature | Playwright Wrapper | Brave Search Wrapper | Instagram Wrapper |
|---------|-------------------|---------------------|-------------------|
| **Base Package** | `@playwright/mcp-server` | `@brave/brave-search-mcp-server` | `@prmichaelsen/agentbase` |
| **Credential Type** | None | API key (shared) | OAuth tokens |
| **Token Resolver** | No | No | Yes |
| **Resource Type** | `playwright` | `brave-search` | `instagram` |
| **Complexity** | Low | Low | High |
| **User Setup** | None | None | OAuth connection |

## Resource Requirements

### Memory & CPU
- **Memory**: 1Gi (browsers are memory-intensive)
- **CPU**: 2 (rendering requires CPU)
- **Timeout**: 300s (complex pages take time)

### Rate Limiting
- **Limit**: 50 requests/hour per user
- **Reason**: Browser automation is resource-intensive
- **Adjust**: Based on actual usage patterns

## Common Playwright Tools

Expected tools from Playwright MCP server:
- `playwright_navigate` - Navigate to URL
- `playwright_screenshot` - Capture screenshot
- `playwright_click` - Click element
- `playwright_fill` - Fill form field
- `playwright_evaluate` - Execute JavaScript
- `playwright_pdf` - Generate PDF

## Next Steps

1. Find or create Playwright MCP server package
2. Implement wrapper following this pattern
3. Test locally with JWT tokens
4. Deploy to Cloud Run
5. Register in platform
6. Monitor resource usage and adjust limits

---

**Status**: Ready for implementation  
**Pattern**: Static server (no OAuth, no per-user credentials)  
**Reference**: See `/home/prmichaelsen/brave-search-mcp-wrapper` for working example
