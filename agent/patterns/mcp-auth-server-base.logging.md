# Logging Pattern

**Pattern**: mcp-auth-server-base.logging
**Category**: Operational
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines structured logging strategies for MCP auth-wrapped servers, ensuring consistent, searchable, and actionable logs across development and production environments. It covers log levels, structured logging, request/response logging, performance monitoring, and integration with cloud logging services.

**Key Principles**:
- Use structured logging (JSON format)
- Include contextual information (userId, requestId, etc.)
- Log at appropriate levels
- Avoid logging sensitive information
- Make logs searchable and actionable

---

## Core Concepts

### Log Levels

Standard log levels in order of severity:

1. **ERROR** - Application errors requiring immediate attention
2. **WARN** - Warning conditions that should be reviewed
3. **INFO** - General informational messages
4. **DEBUG** - Detailed debugging information
5. **TRACE** - Very detailed tracing information (rarely used)

### Structured Logging

Logs should be structured (JSON) rather than plain text:

```json
{
  "timestamp": "2026-02-21T20:00:00.000Z",
  "level": "info",
  "message": "Request processed successfully",
  "userId": "user_123",
  "requestId": "req_abc",
  "method": "POST",
  "path": "/mcp/tools/call",
  "duration": 45,
  "statusCode": 200
}
```

---

## Implementation

### 1. Logger Setup

Create a structured logger using a logging library:

```typescript
// src/utils/logger.ts

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  
  // Base fields included in all logs
  base: {
    service: process.env.SERVICE_NAME || 'mcp-server',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'apiKey',
      'secret',
      '*.password',
      '*.token',
      '*.authorization'
    ],
    remove: true
  },
  
  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
});

// Create child logger with additional context
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### 2. Request Logging Middleware

Log all incoming requests:

```typescript
// src/middleware/request-logger.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  const requestId = randomUUID();
  req.requestId = requestId;

  // Create request-scoped logger
  req.logger = logger.child({
    requestId,
    userId: (req as any).userId, // Set by auth middleware
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Log request start
  req.logger.info('Request started', {
    headers: sanitizeHeaders(req.headers),
    query: req.query
  });

  // Capture start time
  const startTime = Date.now();

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    req.logger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    });
  });

  next();
}

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...headers };
  delete sanitized.authorization;
  delete sanitized.cookie;
  return sanitized;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: pino.Logger;
    }
  }
}
```

### 3. Application Logging

Use logger throughout the application:

```typescript
// src/services/note-service.ts

import { logger } from '../utils/logger.js';

export class NoteService {
  async createNote(userId: string, title: string, content: string): Promise<Note> {
    const serviceLogger = logger.child({ userId, service: 'NoteService' });
    
    serviceLogger.info('Creating note', { title });

    try {
      const note = await this.db.notes.create({
        userId,
        title,
        content,
        createdAt: new Date()
      });

      serviceLogger.info('Note created successfully', {
        noteId: note.id,
        title: note.title
      });

      return note;
    } catch (error) {
      serviceLogger.error('Failed to create note', {
        error,
        title
      });
      throw error;
    }
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    const serviceLogger = logger.child({ userId, noteId, service: 'NoteService' });
    
    serviceLogger.info('Deleting note');

    const note = await this.db.notes.findOne({ id: noteId, userId });
    if (!note) {
      serviceLogger.warn('Note not found for deletion');
      throw new NotFoundError('Note');
    }

    await this.db.notes.delete({ id: noteId, userId });
    serviceLogger.info('Note deleted successfully');
  }
}
```

### 4. Performance Logging

Log performance metrics:

```typescript
// src/utils/performance.ts

import { logger } from './logger.js';

export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  const perfLogger = logger.child({ operation, ...context });

  perfLogger.debug('Operation started');

  return fn()
    .then((result) => {
      const duration = Date.now() - startTime;
      perfLogger.info('Operation completed', { duration });
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      perfLogger.error('Operation failed', { duration, error });
      throw error;
    });
}

// Usage
const notes = await measurePerformance(
  'fetchUserNotes',
  () => noteService.getNotes(userId),
  { userId }
);
```

### 5. Startup and Shutdown Logging

Log application lifecycle events:

```typescript
// src/index.ts

import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  logger.info('Starting MCP server', {
    nodeVersion: process.version,
    port: process.env.PORT,
    environment: process.env.NODE_ENV
  });

  try {
    // Initialize dependencies
    logger.info('Initializing database connection');
    await initDatabase();
    logger.info('Database connected');

    // Start server
    const server = app.listen(process.env.PORT, () => {
      logger.info('Server started successfully', {
        port: process.env.PORT,
        pid: process.pid
      });
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutdown initiated', { signal });

  try {
    logger.info('Closing database connections');
    await closeDatabase();
    logger.info('Database connections closed');

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

startServer();
```

---

## Examples

### Example 1: Tool Execution Logging

```typescript
// src/tools/search-notes.ts

import { logger } from '../utils/logger.js';

export async function handleSearchNotes(args: SearchArgs, userId: string) {
  const toolLogger = logger.child({
    tool: 'search_notes',
    userId,
    query: args.query
  });

  toolLogger.info('Tool execution started');

  try {
    const results = await noteService.search(userId, args.query);
    
    toolLogger.info('Tool execution completed', {
      resultCount: results.length
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  } catch (error) {
    toolLogger.error('Tool execution failed', { error });
    throw error;
  }
}
```

### Example 2: External API Logging

```typescript
// src/services/external-api.ts

import { logger } from '../utils/logger.js';

export async function fetchFromExternalAPI(userId: string): Promise<Data> {
  const apiLogger = logger.child({
    service: 'ExternalAPI',
    userId
  });

  apiLogger.debug('Fetching data from external API');

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`
      }
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      apiLogger.warn('External API returned error', {
        statusCode: response.status,
        statusText: response.statusText,
        duration
      });
      throw new ExternalServiceError('External API');
    }

    const data = await response.json();

    apiLogger.info('External API request successful', {
      duration,
      dataSize: JSON.stringify(data).length
    });

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.error('External API request failed', {
      error,
      duration
    });
    throw error;
  }
}
```

### Example 3: Authentication Logging

```typescript
// src/auth/jwt-provider.ts

import { logger } from '../utils/logger.js';

export async function verifyToken(token: string): Promise<TokenPayload> {
  const authLogger = logger.child({ service: 'JWTProvider' });

  authLogger.debug('Verifying JWT token');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    
    authLogger.info('Token verified successfully', {
      userId: payload.userId,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    });

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      authLogger.warn('Token expired', {
        expiredAt: error.expiredAt
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      authLogger.warn('Invalid token', {
        reason: error.message
      });
    } else {
      authLogger.error('Token verification failed', { error });
    }
    throw new AuthenticationError('Token verification failed');
  }
}
```

### Example 4: Database Query Logging

```typescript
// src/db/notes-repository.ts

import { logger } from '../utils/logger.js';

export class NotesRepository {
  async findByUserId(userId: string): Promise<Note[]> {
    const dbLogger = logger.child({
      repository: 'NotesRepository',
      operation: 'findByUserId',
      userId
    });

    dbLogger.debug('Executing database query');

    const startTime = Date.now();

    try {
      const notes = await this.db.notes.find({ userId }).toArray();
      const duration = Date.now() - startTime;

      dbLogger.info('Query executed successfully', {
        duration,
        resultCount: notes.length
      });

      return notes;
    } catch (error) {
      const duration = Date.now() - startTime;
      dbLogger.error('Query failed', {
        duration,
        error
      });
      throw error;
    }
  }
}
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Logging Sensitive Data

**Wrong**:
```typescript
logger.info('User authenticated', {
  userId,
  password: user.password,  // ❌ Never log passwords
  token: authToken          // ❌ Never log tokens
});
```

**Correct**:
```typescript
logger.info('User authenticated', {
  userId,
  authMethod: 'jwt'
});
```

### ❌ Anti-Pattern 2: Unstructured Logs

**Wrong**:
```typescript
console.log(`User ${userId} created note with title ${title}`);
```

**Correct**:
```typescript
logger.info('Note created', {
  userId,
  title,
  noteId
});
```

### ❌ Anti-Pattern 3: Excessive Logging

**Wrong**:
```typescript
logger.info('Starting loop');
for (const item of items) {
  logger.info('Processing item', { item }); // ❌ Logs every iteration
}
logger.info('Loop complete');
```

**Correct**:
```typescript
logger.info('Processing items', { count: items.length });
const results = items.map(processItem);
logger.info('Items processed', { successCount: results.length });
```

### ❌ Anti-Pattern 4: Wrong Log Levels

**Wrong**:
```typescript
logger.error('User logged in'); // ❌ Not an error
logger.info('Database connection failed'); // ❌ Should be error
```

**Correct**:
```typescript
logger.info('User logged in');
logger.error('Database connection failed', { error });
```

---

## Testing

### Unit Tests

```typescript
// src/utils/logger.spec.ts

import { logger, createLogger } from './logger.js';
import pino from 'pino';

describe('Logger', () => {
  it('should create logger with base fields', () => {
    expect(logger.bindings()).toHaveProperty('service');
    expect(logger.bindings()).toHaveProperty('environment');
  });

  it('should create child logger with context', () => {
    const childLogger = createLogger({ userId: 'user_123' });
    expect(childLogger.bindings()).toHaveProperty('userId', 'user_123');
  });

  it('should redact sensitive fields', () => {
    const logs: any[] = [];
    const testLogger = pino({
      redact: ['password', 'token'],
      browser: { write: (obj) => logs.push(obj) }
    });

    testLogger.info({ password: 'secret123', username: 'user' });
    
    expect(logs[0]).not.toHaveProperty('password');
    expect(logs[0]).toHaveProperty('username', 'user');
  });
});
```

### Integration Tests

```typescript
// src/middleware/request-logger.spec.ts

import request from 'supertest';
import express from 'express';
import { requestLogger } from './request-logger.js';

describe('Request Logger Middleware', () => {
  let app: express.Application;
  let logs: any[] = [];

  beforeEach(() => {
    logs = [];
    app = express();
    app.use(requestLogger);
    app.get('/test', (req, res) => {
      logs.push(req.logger.bindings());
      res.json({ ok: true });
    });
  });

  it('should add requestId to request', async () => {
    await request(app).get('/test');
    
    expect(logs[0]).toHaveProperty('requestId');
    expect(typeof logs[0].requestId).toBe('string');
  });

  it('should log request method and path', async () => {
    await request(app).get('/test?foo=bar');
    
    expect(logs[0]).toHaveProperty('method', 'GET');
    expect(logs[0]).toHaveProperty('path', '/test');
  });
});
```

---

## Best Practices

1. **Use Structured Logging**: Always use JSON format for searchability
2. **Include Context**: Add userId, requestId, and other relevant context
3. **Choose Appropriate Levels**: Use correct log levels (error, warn, info, debug)
4. **Redact Sensitive Data**: Never log passwords, tokens, or PII
5. **Log Errors with Stack Traces**: Include full error objects for debugging
6. **Measure Performance**: Log duration for slow operations
7. **Use Child Loggers**: Create scoped loggers with context
8. **Log Lifecycle Events**: Startup, shutdown, and critical state changes
9. **Avoid Excessive Logging**: Don't log in tight loops
10. **Make Logs Actionable**: Include information needed to debug issues

---

## Log Level Guidelines

### ERROR
- Application crashes
- Database connection failures
- External service failures
- Unhandled exceptions
- Data corruption

### WARN
- Deprecated API usage
- Slow queries (> threshold)
- Retry attempts
- Configuration issues
- Resource limits approaching

### INFO
- Request/response logging
- User actions (login, logout)
- Business events (note created, deleted)
- Startup/shutdown
- Configuration loaded

### DEBUG
- Detailed execution flow
- Variable values
- Function entry/exit
- Cache hits/misses
- Query execution

---

## Cloud Logging Integration

### Google Cloud Logging

```typescript
// src/utils/logger.ts

import pino from 'pino';

const isCloudRun = !!process.env.K_SERVICE;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Cloud Run expects specific format
  formatters: isCloudRun
    ? {
        level: (label) => {
          return { severity: label.toUpperCase() };
        },
        log: (obj) => {
          // Map to Cloud Logging fields
          return {
            ...obj,
            'logging.googleapis.com/trace': obj.requestId,
            'logging.googleapis.com/spanId': obj.spanId
          };
        }
      }
    : undefined
});
```

### Log Correlation

```typescript
// Correlate logs with Cloud Trace
export function addTraceContext(req: Request): Record<string, string> {
  const traceHeader = req.header('X-Cloud-Trace-Context');
  if (!traceHeader) return {};

  const [trace] = traceHeader.split('/');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  return {
    'logging.googleapis.com/trace': `projects/${projectId}/traces/${trace}`
  };
}
```

---

## Performance Considerations

1. **Async Logging**: Pino uses async logging by default (non-blocking)
2. **Log Sampling**: Consider sampling high-volume logs in production
3. **Log Rotation**: Use log rotation to prevent disk space issues
4. **Structured Format**: JSON parsing is fast and efficient
5. **Child Loggers**: Minimal overhead for creating child loggers

---

## Security Considerations

1. **Never log**:
   - Passwords or password hashes
   - Authentication tokens
   - API keys or secrets
   - Credit card numbers
   - Social security numbers
   - Personal health information

2. **Sanitize**:
   - User input before logging
   - Headers (remove Authorization, Cookie)
   - Query parameters (remove sensitive params)

3. **Access Control**: Restrict log access to authorized personnel

---

## Related Patterns

- [Error Handling Pattern](mcp-auth-server-base.error-handling.md) - Error logging strategies
- [Health Check Pattern](mcp-auth-server-base.health-check.md) - Health check logging
- [Server Wrapping Pattern](mcp-auth-server-base.server-wrapping.md) - Request logging integration

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server logging implementations
**Recommendation**: Implement structured logging from the start for better observability
