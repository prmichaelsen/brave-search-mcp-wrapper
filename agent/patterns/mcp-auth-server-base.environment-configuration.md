# Environment Configuration Pattern

**Pattern**: mcp-auth-server-base.environment-configuration
**Category**: Operational
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines environment variable management for MCP auth-wrapped servers, covering configuration loading, validation, type safety, and security best practices. It ensures consistent configuration across development, staging, and production environments.

**Key Principles**:
- Never commit secrets to version control
- Use `.env` files for local development only
- Store production secrets in Secret Manager
- Validate configuration on startup
- Provide sensible defaults
- Use TypeScript for type safety

---

## Core Concepts

### Environment Files

```
.env                    # Base configuration (gitignored)
.env.development        # Development overrides (gitignored)
.env.*.local            # Local overrides (gitignored)
.env.example            # Template (committed to git)
```

### Configuration Layers

```
1. Default values (in code)
2. .env file
3. .env.development (if NODE_ENV=development)
4. .env.local (if exists)
5. Environment variables (highest priority)
6. Cloud Secret Manager (production)
```

---

## Implementation

### 1. Environment Configuration Module

```typescript
// src/config/environment.ts

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { logger } from '../utils/logger.js';

// Load environment variables
const envConfig = config();
expand(envConfig);

// Environment type
export type Environment = 'development' | 'staging' | 'production' | 'test';

// Configuration interface
export interface Config {
  // Server
  port: number;
  nodeEnv: Environment;
  serviceName: string;

  // Platform Integration
  platformUrl: string;
  platformServiceToken: string;

  // CORS
  corsOrigin: string;

  // Authentication
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;

  // Database (if applicable)
  databaseUrl?: string;

  // External APIs (if applicable)
  externalApiUrl?: string;
  externalApiKey?: string;

  // Logging
  logLevel: string;

  // Feature Flags
  features: {
    enableCache: boolean;
    enableMetrics: boolean;
  };
}

// Parse and validate configuration
export const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: (process.env.NODE_ENV || 'development') as Environment,
  serviceName: process.env.SERVICE_NAME || 'mcp-server',

  // Platform Integration
  platformUrl: requireEnv('PLATFORM_URL'),
  platformServiceToken: requireEnv('PLATFORM_SERVICE_TOKEN'),

  // CORS
  corsOrigin: requireEnv('CORS_ORIGIN'),

  // Authentication
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER || 'mcp-server',
  jwtAudience: process.env.JWT_AUDIENCE || 'mcp-client',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // External APIs
  externalApiUrl: process.env.EXTERNAL_API_URL,
  externalApiKey: process.env.EXTERNAL_API_KEY,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Feature Flags
  features: {
    enableCache: process.env.ENABLE_CACHE === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true'
  }
};

// Helper to require environment variable
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Helper to get optional environment variable
function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// Validate configuration on startup
export function validateConfig(): void {
  logger.info('Validating configuration');

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }

  // Validate URLs
  try {
    new URL(config.platformUrl);
    new URL(config.corsOrigin);
  } catch (error) {
    throw new Error('Invalid URL in configuration');
  }

  // Validate JWT secret length
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  // Warn about development mode in production
  if (config.nodeEnv === 'production' && config.logLevel === 'debug') {
    logger.warn('Debug logging enabled in production');
  }

  logger.info('Configuration validated successfully', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    serviceName: config.serviceName
  });
}
```

### 2. Example Environment File

```bash
# .env.example

# ============================================
# Server Configuration
# ============================================
PORT=8080
NODE_ENV=development
SERVICE_NAME=my-mcp-server

# ============================================
# Platform Integration
# ============================================
# The platform URL where this server is registered
PLATFORM_URL=https://your-platform.com

# Service token for authenticating with the platform
# Generate this from your platform's admin panel
PLATFORM_SERVICE_TOKEN=your-service-token-here

# ============================================
# CORS Configuration
# ============================================
# Origin(s) allowed to make requests to this server
# Use comma-separated list for multiple origins
CORS_ORIGIN=https://your-platform.com

# ============================================
# JWT Authentication
# ============================================
# Secret key for JWT verification (min 32 characters)
# Generate with: openssl rand -base64 32
JWT_SECRET=your-jwt-secret-here

# JWT issuer (who issued the token)
JWT_ISSUER=your-platform

# JWT audience (who the token is for)
JWT_AUDIENCE=mcp-server

# ============================================
# Database Configuration (Optional)
# ============================================
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# ============================================
# External API Configuration (Optional)
# ============================================
# EXTERNAL_API_URL=https://api.example.com
# EXTERNAL_API_KEY=your-api-key-here

# ============================================
# Logging
# ============================================
# Log level: error, warn, info, debug, trace
LOG_LEVEL=debug

# ============================================
# Feature Flags
# ============================================
ENABLE_CACHE=true
ENABLE_METRICS=false

# ============================================
# MCP Server Specific Configuration
# ============================================
# Add your server-specific environment variables here
```

### 3. Type-Safe Configuration Access

```typescript
// src/config/index.ts

export { config, validateConfig } from './environment.js';
export type { Config, Environment } from './environment.js';

// Usage in application code:
import { config } from './config/index.js';

console.log(config.port); // TypeScript knows this is a number
console.log(config.platformUrl); // TypeScript knows this is a string
```

### 4. Startup Validation

```typescript
// src/index.ts

import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  try {
    // Validate configuration first
    validateConfig();

    // Log configuration (without secrets)
    logger.info('Starting server with configuration', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      serviceName: config.serviceName,
      platformUrl: config.platformUrl,
      corsOrigin: config.corsOrigin,
      features: config.features
    });

    // Start server
    app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.nodeEnv
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
```

### 5. Cloud Secret Manager Integration

```typescript
// src/config/secrets.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function loadSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return; // Only load from Secret Manager in production
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const serviceName = process.env.SERVICE_NAME;

  // Load secrets from Secret Manager
  const secrets = [
    'PLATFORM_SERVICE_TOKEN',
    'JWT_SECRET',
    'DATABASE_URL',
    'EXTERNAL_API_KEY'
  ];

  for (const secretName of secrets) {
    try {
      const name = `projects/${projectId}/secrets/${serviceName}-${secretName}/versions/latest`;
      const [version] = await client.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString();

      if (payload) {
        process.env[secretName] = payload;
        logger.info(`Loaded secret: ${secretName}`);
      }
    } catch (error) {
      logger.warn(`Failed to load secret: ${secretName}`, { error });
    }
  }
}

// Load secrets before starting server
// src/index.ts
import { loadSecrets } from './config/secrets.js';

async function startServer(): Promise<void> {
  await loadSecrets();
  validateConfig();
  // ... rest of startup
}
```

---

## Examples

### Example 1: Development Configuration

```bash
# .env.development

PORT=8080
NODE_ENV=development
SERVICE_NAME=my-mcp-server-dev

PLATFORM_URL=http://localhost:3000
PLATFORM_SERVICE_TOKEN=dev-token-123

CORS_ORIGIN=http://localhost:3000

JWT_SECRET=development-secret-key-min-32-chars
JWT_ISSUER=dev-platform
JWT_AUDIENCE=mcp-server

LOG_LEVEL=debug

ENABLE_CACHE=false
ENABLE_METRICS=false
```

### Example 2: Production Configuration (Cloud Run)

```yaml
# cloudbuild.yaml

steps:
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${_SERVICE_NAME}'
      - '--image=gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '--region=${_REGION}'
      - '--platform=managed'
      # Environment variables
      - '--set-env-vars=NODE_ENV=production'
      - '--set-env-vars=SERVICE_NAME=${_SERVICE_NAME}'
      - '--set-env-vars=PLATFORM_URL=${_PLATFORM_URL}'
      - '--set-env-vars=CORS_ORIGIN=${_CORS_ORIGIN}'
      - '--set-env-vars=LOG_LEVEL=info'
      - '--set-env-vars=ENABLE_CACHE=true'
      - '--set-env-vars=ENABLE_METRICS=true'
      # Secrets from Secret Manager
      - '--update-secrets=PLATFORM_SERVICE_TOKEN=${_SERVICE_NAME}-platform-token:latest'
      - '--update-secrets=JWT_SECRET=${_SERVICE_NAME}-jwt-secret:latest'
      - '--update-secrets=DATABASE_URL=${_SERVICE_NAME}-database-url:latest'
```

### Example 3: Feature Flags

```typescript
// src/config/features.ts

import { config } from './environment.js';

export const features = {
  cache: {
    enabled: config.features.enableCache,
    ttl: parseInt(process.env.CACHE_TTL || '300', 10) // 5 minutes
  },
  
  metrics: {
    enabled: config.features.enableMetrics,
    endpoint: process.env.METRICS_ENDPOINT || '/metrics'
  },
  
  rateLimit: {
    enabled: process.env.ENABLE_RATE_LIMIT === 'true',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10)
  }
};

// Usage
if (features.cache.enabled) {
  // Initialize cache
}
```

### Example 4: Environment-Specific Behavior

```typescript
// src/utils/environment.ts

import { config } from '../config/index.js';

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

// Usage
if (isDevelopment) {
  // Enable debug features
  app.use(morgan('dev'));
}

if (isProduction) {
  // Enable production optimizations
  app.set('trust proxy', 1);
}
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Hardcoded Secrets

**Wrong**:
```typescript
const JWT_SECRET = 'my-secret-key'; // ❌ Never hardcode secrets
const API_KEY = 'abc123'; // ❌ Never hardcode API keys
```

**Correct**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET!; // ✅ From environment
const API_KEY = process.env.API_KEY!; // ✅ From environment
```

### ❌ Anti-Pattern 2: Committing .env Files

**Wrong**:
```bash
# .gitignore
# ❌ .env not ignored
node_modules/
dist/
```

**Correct**:
```bash
# .gitignore
node_modules/
dist/
.env
.env.local
.env.*.local
.env.development
.env.production
```

### ❌ Anti-Pattern 3: No Validation

**Wrong**:
```typescript
const port = process.env.PORT; // ❌ No validation, could be undefined
app.listen(port); // ❌ Runtime error if PORT not set
```

**Correct**:
```typescript
const port = parseInt(process.env.PORT || '8080', 10);
if (port < 1 || port > 65535) {
  throw new Error('Invalid port');
}
app.listen(port);
```

### ❌ Anti-Pattern 4: Using .env.production

**Wrong**:
```bash
# .env.production (committed to git)
JWT_SECRET=production-secret # ❌ Secret in version control
DATABASE_URL=postgres://... # ❌ Credentials in version control
```

**Correct**:
```bash
# Use Cloud Secret Manager for production
# Or environment variables in deployment platform
# Never commit production secrets
```

---

## Testing

### Unit Tests

```typescript
// src/config/environment.spec.ts

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset environment
    delete process.env.PORT;
    delete process.env.JWT_SECRET;
  });

  it('should use default port if not specified', () => {
    const config = loadConfig();
    expect(config.port).toBe(8080);
  });

  it('should throw error for missing required variable', () => {
    delete process.env.JWT_SECRET;
    expect(() => loadConfig()).toThrow('Missing required environment variable: JWT_SECRET');
  });

  it('should parse boolean feature flags', () => {
    process.env.ENABLE_CACHE = 'true';
    const config = loadConfig();
    expect(config.features.enableCache).toBe(true);
  });

  it('should validate port range', () => {
    process.env.PORT = '99999';
    expect(() => validateConfig()).toThrow('Invalid port');
  });
});
```

### Integration Tests

```typescript
// tests/config.integration.spec.ts

describe('Configuration Integration', () => {
  it('should load configuration from .env.test', () => {
    expect(config.nodeEnv).toBe('test');
    expect(config.port).toBeDefined();
  });

  it('should have all required variables', () => {
    expect(config.platformUrl).toBeDefined();
    expect(config.jwtSecret).toBeDefined();
    expect(config.corsOrigin).toBeDefined();
  });

  it('should not expose secrets in logs', () => {
    const logs: any[] = [];
    const testLogger = createLogger({ write: logs.push });

    testLogger.info('Config loaded', { config });

    const logStr = JSON.stringify(logs);
    expect(logStr).not.toContain(config.jwtSecret);
    expect(logStr).not.toContain(config.platformServiceToken);
  });
});
```

---

## Best Practices

1. **Never Commit Secrets**: Use `.gitignore` to exclude `.env` files
2. **Use .env.example**: Provide template with all required variables
3. **Validate on Startup**: Fail fast if configuration is invalid
4. **Type Safety**: Use TypeScript interfaces for configuration
5. **Sensible Defaults**: Provide defaults for non-critical settings
6. **Environment-Specific**: Use different configs for dev/prod
7. **Secret Manager**: Use cloud secret manager for production
8. **Document Variables**: Comment each variable in `.env.example`
9. **Fail Fast**: Throw errors for missing required variables
10. **Log Configuration**: Log non-sensitive config on startup

---

## Security Considerations

### Never Log Secrets

```typescript
// src/utils/logger.ts

// Redact sensitive fields
export const logger = pino({
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'JWT_SECRET',
      'PLATFORM_SERVICE_TOKEN',
      'DATABASE_URL',
      '*.password',
      '*.token',
      '*.secret'
    ],
    remove: true
  }
});
```

### Validate Secret Strength

```typescript
function validateJwtSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  
  // Check for common weak secrets
  const weakSecrets = ['secret', 'password', '12345', 'changeme'];
  if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
    throw new Error('JWT_SECRET appears to be weak');
  }
}
```

### Rotate Secrets Regularly

```bash
# Generate new JWT secret
openssl rand -base64 32

# Update in Secret Manager
gcloud secrets versions add my-service-jwt-secret --data-file=-
```

---

## Performance Considerations

1. **Load Once**: Load configuration once at startup
2. **Cache Values**: Don't read `process.env` repeatedly
3. **Lazy Loading**: Load optional configs only when needed
4. **Parallel Loading**: Load secrets in parallel

---

## Related Patterns

- [Server Wrapping Pattern](mcp-auth-server-base.server-wrapping.md) - Using config in server setup
- [CORS Configuration Pattern](mcp-auth-server-base.cors-configuration.md) - CORS environment variables
- [Logging Pattern](mcp-auth-server-base.logging.md) - Logging configuration

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server configuration management
**Recommendation**: Implement robust configuration management from the start
