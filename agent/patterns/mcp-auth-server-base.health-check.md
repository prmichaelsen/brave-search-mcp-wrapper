# Health Check Pattern

**Pattern**: mcp-auth-server-base.health-check
**Category**: Operational
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines health check endpoint implementation for MCP auth-wrapped servers, enabling monitoring, load balancing, and orchestration systems to verify server health. It covers readiness checks, liveness checks, dependency validation, and integration with Cloud Run and monitoring systems.

**Key Principles**:
- Separate readiness from liveness
- Check critical dependencies
- Respond quickly (< 50ms)
- Include version information
- Support monitoring integration

---

## Core Concepts

### Health Check Types

1. **Liveness Check**: Is the server running?
   - Answers: "Should I restart this instance?"
   - Fast response (< 10ms)
   - Minimal checks

2. **Readiness Check**: Is the server ready to handle requests?
   - Answers: "Should I send traffic to this instance?"
   - Checks dependencies (database, external APIs)
   - Slower response acceptable (< 1s)

3. **Startup Check**: Has the server finished initializing?
   - Used during container startup
   - Allows longer initialization time
   - Prevents premature traffic

---

## Implementation

### 1. Basic Health Check Endpoint

```typescript
// src/routes/health.ts

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export const healthRouter = Router();

// Liveness check - minimal, fast check
healthRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Readiness check - includes dependency checks
healthRouter.get('/health/ready', async (req: Request, res: Response) => {
  const checks = await performReadinessChecks();
  
  const allHealthy = Object.values(checks).every(check => check.status === 'ok');
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks
  });
});

// Detailed health check - includes all information
healthRouter.get('/health/detailed', async (req: Request, res: Response) => {
  const checks = await performDetailedChecks();
  
  const allHealthy = Object.values(checks.dependencies).every(
    dep => dep.status === 'ok'
  );

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    ...checks
  });
});
```

### 2. Dependency Health Checks

```typescript
// src/health/checks.ts

import { logger } from '../utils/logger.js';

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

export interface HealthChecks {
  [key: string]: HealthCheck;
}

export async function performReadinessChecks(): Promise<HealthChecks> {
  const checks: HealthChecks = {};

  // Check database connection
  checks.database = await checkDatabase();

  // Check external API (if critical)
  if (process.env.EXTERNAL_API_URL) {
    checks.externalApi = await checkExternalApi();
  }

  return checks;
}

export async function performDetailedChecks() {
  const dependencies = await performReadinessChecks();

  return {
    dependencies,
    system: {
      memory: getMemoryUsage(),
      cpu: getCpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    }
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Perform simple query to verify connection
    await db.ping();
    
    const latency = Date.now() - startTime;

    return {
      status: latency < 100 ? 'ok' : 'degraded',
      latency,
      message: latency < 100 ? 'Connected' : 'Slow response'
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'error',
      message: 'Connection failed',
      latency: Date.now() - startTime
    };
  }
}

async function checkExternalApi(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const response = await fetch(process.env.EXTERNAL_API_URL + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'degraded',
        message: `HTTP ${response.status}`,
        latency
      };
    }

    return {
      status: 'ok',
      latency,
      message: 'Available'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime
    };
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024) // MB
  };
}

function getCpuUsage() {
  const usage = process.cpuUsage();
  return {
    user: Math.round(usage.user / 1000), // ms
    system: Math.round(usage.system / 1000) // ms
  };
}
```

### 3. Health Check Middleware

```typescript
// src/middleware/health-check.ts

import { Request, Response, NextFunction } from 'express';

// Skip auth for health check endpoints
export function skipAuthForHealthChecks(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.path.startsWith('/health')) {
    // Mark request as health check
    (req as any).isHealthCheck = true;
  }
  next();
}

// Apply in server setup before auth middleware
app.use(skipAuthForHealthChecks);
```

### 4. Docker Health Check

```dockerfile
# Dockerfile.production

FROM node:20-alpine

# ... build steps ...

# Health check configuration
HEALTHCHECK --interval=30s \
            --timeout=3s \
            --start-period=5s \
            --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
```

### 5. Cloud Run Health Check

```yaml
# cloudbuild.yaml

steps:
  # ... build and push steps ...
  
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
      # Health check configuration
      - '--max-instances=10'
      - '--min-instances=0'
      - '--timeout=60s'
      # Cloud Run automatically uses /health endpoint
```

---

## Examples

### Example 1: Simple Health Check

```typescript
// Minimal implementation for services without dependencies

import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

### Example 2: Database Health Check

```typescript
// Check database connection and performance

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Simple ping query
    await db.query('SELECT 1');
    const latency = Date.now() - startTime;

    // Check connection pool
    const poolStats = db.pool.stats();

    return {
      status: latency < 100 ? 'ok' : 'degraded',
      latency,
      details: {
        poolSize: poolStats.size,
        poolAvailable: poolStats.available,
        poolWaiting: poolStats.waiting
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Database connection failed',
      latency: Date.now() - startTime
    };
  }
}
```

### Example 3: Multi-Dependency Check

```typescript
// Check multiple dependencies in parallel

export async function performReadinessChecks(): Promise<HealthChecks> {
  const [database, redis, externalApi] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalApi()
  ]);

  return {
    database: database.status === 'fulfilled' 
      ? database.value 
      : { status: 'error', message: 'Check failed' },
    redis: redis.status === 'fulfilled'
      ? redis.value
      : { status: 'error', message: 'Check failed' },
    externalApi: externalApi.status === 'fulfilled'
      ? externalApi.value
      : { status: 'error', message: 'Check failed' }
  };
}
```

### Example 4: Graceful Degradation

```typescript
// Continue serving requests even if non-critical dependencies fail

healthRouter.get('/health/ready', async (req, res) => {
  const checks = await performReadinessChecks();

  // Critical dependencies
  const criticalHealthy = 
    checks.database?.status === 'ok';

  // Non-critical dependencies (can be degraded)
  const nonCriticalHealthy = 
    checks.cache?.status !== 'error';

  const ready = criticalHealthy && nonCriticalHealthy;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
    degraded: checks.cache?.status === 'degraded'
  });
});
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Slow Health Checks

**Wrong**:
```typescript
// Health check that takes too long
healthRouter.get('/health', async (req, res) => {
  await checkAllDependencies(); // ❌ Too slow
  await runDiagnostics(); // ❌ Too slow
  res.json({ status: 'ok' });
});
```

**Correct**:
```typescript
// Fast liveness check
healthRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' }); // ✅ Instant response
});

// Separate readiness check for dependencies
healthRouter.get('/health/ready', async (req, res) => {
  const checks = await performReadinessChecks(); // ✅ Separate endpoint
  res.json(checks);
});
```

### ❌ Anti-Pattern 2: Requiring Authentication

**Wrong**:
```typescript
// Health check requires auth
app.use(authMiddleware); // ❌ Applies to all routes
healthRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

**Correct**:
```typescript
// Health check bypasses auth
app.use((req, res, next) => {
  if (req.path.startsWith('/health')) {
    return next(); // ✅ Skip auth
  }
  authMiddleware(req, res, next);
});
```

### ❌ Anti-Pattern 3: Exposing Sensitive Information

**Wrong**:
```typescript
healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: process.env.DATABASE_URL, // ❌ Exposes credentials
    apiKey: process.env.API_KEY // ❌ Exposes secrets
  });
});
```

**Correct**:
```typescript
healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.npm_package_version, // ✅ Safe
    uptime: process.uptime() // ✅ Safe
  });
});
```

### ❌ Anti-Pattern 4: Always Returning 200

**Wrong**:
```typescript
healthRouter.get('/health/ready', async (req, res) => {
  const checks = await performReadinessChecks();
  res.status(200).json(checks); // ❌ Always 200, even if unhealthy
});
```

**Correct**:
```typescript
healthRouter.get('/health/ready', async (req, res) => {
  const checks = await performReadinessChecks();
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  res.status(healthy ? 200 : 503).json(checks); // ✅ Correct status code
});
```

---

## Testing

### Unit Tests

```typescript
// src/health/checks.spec.ts

import { checkDatabase, performReadinessChecks } from './checks.js';

describe('Health Checks', () => {
  describe('checkDatabase', () => {
    it('should return ok when database is healthy', async () => {
      const result = await checkDatabase();
      
      expect(result.status).toBe('ok');
      expect(result.latency).toBeLessThan(100);
    });

    it('should return error when database is down', async () => {
      // Mock database failure
      jest.spyOn(db, 'ping').mockRejectedValue(new Error('Connection failed'));
      
      const result = await checkDatabase();
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Connection failed');
    });

    it('should return degraded when database is slow', async () => {
      // Mock slow database
      jest.spyOn(db, 'ping').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 150))
      );
      
      const result = await checkDatabase();
      
      expect(result.status).toBe('degraded');
      expect(result.latency).toBeGreaterThan(100);
    });
  });

  describe('performReadinessChecks', () => {
    it('should check all dependencies', async () => {
      const checks = await performReadinessChecks();
      
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('externalApi');
    });
  });
});
```

### Integration Tests

```typescript
// src/routes/health.spec.ts

import request from 'supertest';
import { app } from '../app.js';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(50);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      const response = await request(app).get('/health/ready');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toHaveProperty('database');
    });

    it('should return 503 when dependencies are unhealthy', async () => {
      // Mock database failure
      jest.spyOn(db, 'ping').mockRejectedValue(new Error('Down'));
      
      const response = await request(app).get('/health/ready');
      
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('not_ready');
    });
  });

  describe('GET /health/detailed', () => {
    it('should include system information', async () => {
      const response = await request(app).get('/health/detailed');
      
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('system');
      expect(response.body.system).toHaveProperty('memory');
    });
  });
});
```

---

## Best Practices

1. **Separate Endpoints**: Use different endpoints for liveness and readiness
2. **Fast Liveness**: Liveness checks should respond in < 10ms
3. **Timeout Readiness**: Readiness checks should timeout after 1-2 seconds
4. **No Auth Required**: Health checks should not require authentication
5. **Proper Status Codes**: Return 503 when unhealthy, 200 when healthy
6. **Include Latency**: Report check latency for performance monitoring
7. **Graceful Degradation**: Distinguish critical from non-critical dependencies
8. **Version Information**: Include version for deployment tracking
9. **Parallel Checks**: Check dependencies in parallel for speed
10. **Cache Results**: Consider caching health check results (5-10 seconds)

---

## Monitoring Integration

### Prometheus Metrics

```typescript
// src/metrics/health.ts

import { Counter, Gauge, Histogram } from 'prom-client';

export const healthCheckDuration = new Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks',
  labelNames: ['check_type', 'dependency']
});

export const healthCheckStatus = new Gauge({
  name: 'health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['dependency']
});

export const healthCheckErrors = new Counter({
  name: 'health_check_errors_total',
  help: 'Total number of health check errors',
  labelNames: ['dependency']
});

// Usage in health checks
async function checkDatabase(): Promise<HealthCheck> {
  const timer = healthCheckDuration.startTimer({ 
    check_type: 'readiness',
    dependency: 'database'
  });

  try {
    await db.ping();
    healthCheckStatus.set({ dependency: 'database' }, 1);
    return { status: 'ok' };
  } catch (error) {
    healthCheckStatus.set({ dependency: 'database' }, 0);
    healthCheckErrors.inc({ dependency: 'database' });
    return { status: 'error' };
  } finally {
    timer();
  }
}
```

### Cloud Monitoring

```typescript
// Log health check results for Cloud Monitoring
import { logger } from '../utils/logger.js';

async function performReadinessChecks(): Promise<HealthChecks> {
  const checks = await runChecks();

  // Log for Cloud Monitoring
  logger.info('Health check completed', {
    checks,
    allHealthy: Object.values(checks).every(c => c.status === 'ok')
  });

  return checks;
}
```

---

## Performance Considerations

1. **Response Time**: Liveness < 10ms, Readiness < 1s
2. **Caching**: Cache health check results for 5-10 seconds
3. **Parallel Execution**: Check dependencies in parallel
4. **Timeouts**: Set aggressive timeouts for dependency checks
5. **Connection Pooling**: Reuse connections for health checks

---

## Security Considerations

1. **No Authentication**: Health checks must be publicly accessible
2. **No Sensitive Data**: Never expose credentials or internal details
3. **Rate Limiting**: Consider rate limiting health check endpoints
4. **Minimal Information**: Only expose necessary information
5. **Internal vs External**: Consider separate internal/external health endpoints

---

## Related Patterns

- [Error Handling Pattern](mcp-auth-server-base.error-handling.md) - Error handling in health checks
- [Logging Pattern](mcp-auth-server-base.logging.md) - Health check logging
- [Server Wrapping Pattern](mcp-auth-server-base.server-wrapping.md) - Health check integration

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server health check implementations
**Recommendation**: Implement health checks from the start for production readiness
