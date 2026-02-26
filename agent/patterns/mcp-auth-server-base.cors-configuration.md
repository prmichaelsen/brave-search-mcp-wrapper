# CORS Configuration Pattern

**Pattern**: mcp-auth-server-base.cors-configuration
**Category**: Operational
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines CORS (Cross-Origin Resource Sharing) configuration for MCP auth-wrapped servers using SSE (Server-Sent Events) transport. It covers origin configuration, preflight handling, credential support, and security considerations for multi-tenant platforms.

**Key Principles**:
- Restrict origins to trusted domains
- Support credentials for authenticated requests
- Handle preflight requests correctly
- Configure appropriate headers
- Maintain security in multi-tenant environments

---

## Core Concepts

### CORS Basics

CORS allows browsers to make cross-origin requests. For MCP servers using SSE transport:

1. **Origin**: The domain making the request (e.g., `https://platform.example.com`)
2. **Credentials**: Cookies, authorization headers, TLS client certificates
3. **Preflight**: OPTIONS request to check if actual request is allowed
4. **Headers**: Specify allowed methods, headers, and origins

### MCP SSE Transport Requirements

MCP servers using SSE transport need CORS because:
- Browser clients connect from different origins
- SSE requires long-lived connections
- Authentication headers must be sent
- Credentials (cookies/tokens) must be included

---

## Implementation

### 1. Basic CORS Configuration

```typescript
// src/config/cors.ts

import cors from 'cors';

export const corsOptions: cors.CorsOptions = {
  // Allow requests from platform origin
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Allowed methods
  methods: ['GET', 'POST', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept'
  ],
  
  // Expose headers to client
  exposedHeaders: [
    'Content-Type',
    'Cache-Control',
    'Content-Encoding'
  ],
  
  // Preflight cache duration (seconds)
  maxAge: 86400, // 24 hours
  
  // Pass CORS preflight response to next handler
  preflightContinue: false,
  
  // Provide successful status for OPTIONS requests
  optionsSuccessStatus: 204
};
```

### 2. Dynamic Origin Validation

```typescript
// src/config/cors.ts

import cors from 'cors';
import { logger } from '../utils/logger.js';

// Multiple allowed origins
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGIN_SECONDARY,
  'http://localhost:3000', // Development
  'http://localhost:5173'  // Vite dev server
].filter(Boolean) as string[];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      logger.debug('CORS: Origin allowed', { origin });
      callback(null, true);
    } else {
      logger.warn('CORS: Origin blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};
```

### 3. Pattern-Based Origin Validation

```typescript
// src/config/cors.ts

import cors from 'cors';

// Allow origins matching pattern
const allowedOriginPatterns = [
  /^https:\/\/.*\.example\.com$/, // All subdomains of example.com
  /^http:\/\/localhost:\d+$/,     // Any localhost port
];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    // Check against patterns
    const allowed = allowedOriginPatterns.some(pattern => 
      pattern.test(origin)
    );

    if (allowed) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};
```

### 4. Environment-Specific Configuration

```typescript
// src/config/cors.ts

import cors from 'cors';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const corsOptions: cors.CorsOptions = {
  origin: isDevelopment
    ? true // Allow all origins in development
    : process.env.CORS_ORIGIN, // Strict origin in production
  
  credentials: true,
  
  methods: ['GET', 'POST', 'OPTIONS'],
  
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    ...(isDevelopment ? ['X-Debug'] : []) // Extra headers in dev
  ],
  
  maxAge: isDevelopment ? 0 : 86400, // No cache in dev
  
  optionsSuccessStatus: 204
};

// Log CORS configuration on startup
logger.info('CORS configuration', {
  origin: corsOptions.origin,
  credentials: corsOptions.credentials,
  environment: process.env.NODE_ENV
});
```

### 5. Integration with Express

```typescript
// src/index.ts

import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import { wrapServer } from '@prmichaelsen/mcp-auth';

const app = express();

// Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Wrap MCP server with auth
const wrappedServer = wrapServer(mcpServer, {
  authProvider: jwtProvider,
  transport: 'sse'
});

// Mount MCP endpoints
app.use('/mcp', wrappedServer.router);

app.listen(8080, () => {
  logger.info('Server started with CORS enabled');
});
```

### 6. SSE-Specific CORS Headers

```typescript
// src/middleware/sse-cors.ts

import { Request, Response, NextFunction } from 'express';

// Additional headers for SSE connections
export function sseCorsHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // SSE requires these headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // CORS headers for SSE
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  next();
}

function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
  return allowedOrigins.includes(origin);
}

// Apply to SSE endpoints
app.use('/mcp/sse', sseCorsHeaders);
```

---

## Examples

### Example 1: Single Origin (Production)

```typescript
// .env.production
CORS_ORIGIN=https://platform.example.com

// src/config/cors.ts
export const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};
```

### Example 2: Multiple Origins

```typescript
// .env
CORS_ORIGINS=https://platform.example.com,https://admin.example.com

// src/config/cors.ts
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

### Example 3: Development vs Production

```typescript
// src/config/cors.ts

const isDev = process.env.NODE_ENV === 'development';

export const corsOptions: cors.CorsOptions = {
  origin: isDev 
    ? true // Allow all in development
    : process.env.CORS_ORIGIN, // Strict in production
  
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: isDev ? 0 : 86400
};
```

### Example 4: Subdomain Wildcard

```typescript
// Allow all subdomains of example.com

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    // Allow *.example.com
    if (origin.endsWith('.example.com') || origin === 'https://example.com') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Allowing All Origins in Production

**Wrong**:
```typescript
// NEVER do this in production
export const corsOptions: cors.CorsOptions = {
  origin: '*', // ❌ Allows any origin
  credentials: true // ❌ Can't use credentials with '*'
};
```

**Correct**:
```typescript
export const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN, // ✅ Specific origin
  credentials: true
};
```

### ❌ Anti-Pattern 2: Not Validating Origin

**Wrong**:
```typescript
export const corsOptions: cors.CorsOptions = {
  origin: true, // ❌ Accepts any origin
  credentials: true
};
```

**Correct**:
```typescript
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

### ❌ Anti-Pattern 3: Missing Credentials Flag

**Wrong**:
```typescript
export const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN,
  // ❌ Missing credentials: true
  // Auth headers won't be sent
};
```

**Correct**:
```typescript
export const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN,
  credentials: true // ✅ Required for auth
};
```

### ❌ Anti-Pattern 4: Applying CORS After Routes

**Wrong**:
```typescript
app.use('/mcp', mcpRouter); // ❌ Routes before CORS
app.use(cors(corsOptions));
```

**Correct**:
```typescript
app.use(cors(corsOptions)); // ✅ CORS before routes
app.use('/mcp', mcpRouter);
```

---

## Testing

### Unit Tests

```typescript
// src/config/cors.spec.ts

import { corsOptions } from './cors.js';

describe('CORS Configuration', () => {
  describe('origin validation', () => {
    it('should allow configured origin', (done) => {
      const origin = 'https://platform.example.com';
      process.env.CORS_ORIGIN = origin;

      const callback = (err: Error | null, allowed: boolean) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      };

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(origin, callback);
      }
    });

    it('should block unknown origin', (done) => {
      const origin = 'https://evil.com';

      const callback = (err: Error | null, allowed: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe('Not allowed by CORS');
        done();
      };

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(origin, callback);
      }
    });

    it('should allow requests with no origin', (done) => {
      const callback = (err: Error | null, allowed: boolean) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      };

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(undefined, callback);
      }
    });
  });
});
```

### Integration Tests

```typescript
// src/app.spec.ts

import request from 'supertest';
import { app } from './app.js';

describe('CORS Integration', () => {
  it('should include CORS headers for allowed origin', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://platform.example.com');

    expect(response.headers['access-control-allow-origin'])
      .toBe('https://platform.example.com');
    expect(response.headers['access-control-allow-credentials'])
      .toBe('true');
  });

  it('should handle preflight requests', async () => {
    const response = await request(app)
      .options('/mcp/tools')
      .set('Origin', 'https://platform.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods'])
      .toContain('POST');
  });

  it('should block requests from unknown origins', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.com');

    expect(response.status).toBe(500); // CORS error
  });

  it('should allow requests without origin header', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
  });
});
```

---

## Best Practices

1. **Explicit Origins**: Always specify allowed origins explicitly in production
2. **Enable Credentials**: Set `credentials: true` for authenticated requests
3. **Validate Origins**: Implement origin validation function
4. **Environment-Specific**: Use different configs for dev/prod
5. **Log Blocked Origins**: Log blocked origins for security monitoring
6. **Preflight Caching**: Set appropriate `maxAge` for preflight requests
7. **Minimal Headers**: Only allow necessary headers
8. **Apply Early**: Apply CORS middleware before other middleware
9. **SSE Headers**: Include SSE-specific headers for event streams
10. **Test Thoroughly**: Test CORS with actual browser clients

---

## Security Considerations

### Origin Validation

1. **Never use `*` with credentials**: This is a security vulnerability
2. **Validate origin format**: Ensure origins are valid URLs
3. **Use HTTPS in production**: Only allow HTTPS origins
4. **Log blocked attempts**: Monitor for suspicious origin patterns
5. **Subdomain wildcards**: Be careful with subdomain matching

### Headers

1. **Minimize exposed headers**: Only expose necessary headers
2. **Restrict allowed headers**: Only allow required request headers
3. **Limit methods**: Only allow necessary HTTP methods
4. **Credentials flag**: Only enable if needed

### Multi-Tenant Considerations

```typescript
// Validate origin against tenant configuration
export const corsOptions: cors.CorsOptions = {
  origin: async (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    try {
      // Check if origin belongs to a valid tenant
      const tenant = await getTenantByOrigin(origin);
      if (tenant && tenant.isActive) {
        callback(null, true);
      } else {
        logger.warn('CORS: Unknown tenant origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    } catch (error) {
      logger.error('CORS: Origin validation failed', { error, origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

---

## Performance Considerations

1. **Preflight Caching**: Set `maxAge` to reduce preflight requests
2. **Origin Validation**: Keep validation logic fast (< 10ms)
3. **Static Origins**: Use static list when possible
4. **Avoid Database Lookups**: Cache tenant origins in memory

---

## Cloud Run Configuration

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
      - '--allow-unauthenticated'
      # Set CORS origin via environment variable
      - '--set-env-vars=CORS_ORIGIN=https://platform.example.com'
      - '--set-env-vars=NODE_ENV=production'
```

---

## Debugging CORS Issues

### Common Issues

1. **No CORS headers**: CORS middleware not applied
2. **Preflight fails**: Missing OPTIONS handler
3. **Credentials not sent**: Missing `credentials: true`
4. **Origin blocked**: Origin not in allowed list

### Debug Logging

```typescript
// src/config/cors.ts

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    logger.debug('CORS origin check', {
      origin,
      allowed: allowedOrigins,
      matches: allowedOrigins.includes(origin || '')
    });

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS origin blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

---

## Related Patterns

- [Server Wrapping Pattern](mcp-auth-server-base.server-wrapping.md) - CORS integration with MCP auth
- [Error Handling Pattern](mcp-auth-server-base.error-handling.md) - Handling CORS errors
- [Environment Configuration Pattern](mcp-auth-server-base.environment-configuration.md) - CORS environment variables

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server CORS configurations
**Recommendation**: Configure CORS restrictively from the start for security
