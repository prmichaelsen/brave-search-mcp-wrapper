# Error Handling Pattern

**Pattern**: mcp-auth-server-base.error-handling
**Category**: Operational
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines comprehensive error handling strategies for MCP auth-wrapped servers, ensuring graceful degradation, proper logging, and user-friendly error messages. It covers error types, handling strategies, recovery mechanisms, and integration with the MCP protocol.

**Key Principles**:
- Fail gracefully with informative messages
- Log errors with sufficient context for debugging
- Distinguish between user errors and system errors
- Never expose sensitive information in error messages
- Provide actionable error messages when possible

---

## Core Concepts

### Error Categories

MCP auth servers encounter four main error categories:

1. **Authentication Errors** - Invalid tokens, expired credentials, missing auth
2. **Authorization Errors** - Insufficient permissions, resource access denied
3. **Validation Errors** - Invalid input, malformed requests
4. **System Errors** - Database failures, external API errors, internal bugs

### Error Handling Layers

```
┌─────────────────────────────────────┐
│   MCP Protocol Layer                │  ← MCP error responses
├─────────────────────────────────────┤
│   Auth Middleware Layer             │  ← Auth/authz errors
├─────────────────────────────────────┤
│   Business Logic Layer              │  ← Validation errors
├─────────────────────────────────────┤
│   Data Access Layer                 │  ← System errors
└─────────────────────────────────────┘
```

---

## Implementation

### 1. Error Types

Define custom error types for different scenarios:

```typescript
// src/errors/types.ts

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, unknown>) {
    super(`${resource} not found`, 'NOT_FOUND', 404, true, context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true,
      { service, originalError: originalError?.message }
    );
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', context?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, false, context);
  }
}
```

### 2. Error Handler Middleware

Create centralized error handling:

```typescript
// src/middleware/error-handler.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/types.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logError(err, req);

  // Handle operational errors
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { context: err.context })
      }
    });
    return;
  }

  // Handle non-operational errors (programming errors)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });

  // In production, consider shutting down gracefully for non-operational errors
  if (process.env.NODE_ENV === 'production') {
    logger.error('Non-operational error detected, consider graceful shutdown', { err });
  }
}

function logError(err: Error, req: Request): void {
  const errorLog = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: (req as any).userId, // From auth middleware
    timestamp: new Date().toISOString()
  };

  if (err instanceof AppError) {
    logger.error(`${err.code}: ${err.message}`, {
      ...errorLog,
      code: err.code,
      statusCode: err.statusCode,
      isOperational: err.isOperational,
      context: err.context
    });
  } else {
    logger.error('Unexpected error', errorLog);
  }
}
```

### 3. MCP Error Responses

Handle errors in MCP tool handlers:

```typescript
// src/tools/example-tool.ts

import { AuthenticationError, ValidationError, NotFoundError } from '../errors/types.js';

export async function handleExampleTool(args: unknown, userId: string) {
  try {
    // Validate input
    if (!isValidInput(args)) {
      throw new ValidationError('Invalid input parameters', { args });
    }

    // Fetch data
    const data = await fetchData(userId);
    if (!data) {
      throw new NotFoundError('Data', { userId });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  } catch (error) {
    // Re-throw operational errors
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap unexpected errors
    logger.error('Unexpected error in example tool', { error, userId });
    throw new InternalError('Failed to process request');
  }
}
```

### 4. Async Error Handling

Wrap async handlers to catch errors:

```typescript
// src/utils/async-handler.ts

import { Request, Response, NextFunction } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage in routes
app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchData(req.userId);
  res.json(data);
}));
```

### 5. Graceful Shutdown

Handle process termination gracefully:

```typescript
// src/index.ts

import { Server } from 'http';

let server: Server;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Wait for existing connections to complete (with timeout)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Close database connections, etc.
    await closeConnections();
    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
  gracefulShutdown('unhandledRejection');
});
```

---

## Examples

### Example 1: Authentication Error

```typescript
// src/auth/jwt-provider.ts

import { AuthenticationError } from '../errors/types.js';
import jwt from 'jsonwebtoken';

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired', {
        expiredAt: error.expiredAt
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token', {
        reason: error.message
      });
    }
    throw new AuthenticationError('Token verification failed');
  }
}
```

### Example 2: External Service Error

```typescript
// src/services/external-api.ts

import { ExternalServiceError } from '../errors/types.js';

export async function fetchFromExternalAPI(userId: string): Promise<Data> {
  try {
    const response = await fetch(`https://api.example.com/data/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`
      }
    });

    if (!response.ok) {
      throw new ExternalServiceError('External API', 
        new Error(`HTTP ${response.status}: ${response.statusText}`)
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError('External API', error as Error);
  }
}
```

### Example 3: Validation Error with Context

```typescript
// src/tools/create-note.ts

import { ValidationError } from '../errors/types.js';

interface CreateNoteArgs {
  title: string;
  content: string;
  tags?: string[];
}

export async function handleCreateNote(args: unknown, userId: string) {
  // Validate args structure
  if (!isCreateNoteArgs(args)) {
    throw new ValidationError('Invalid arguments', {
      expected: 'CreateNoteArgs',
      received: typeof args
    });
  }

  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    throw new ValidationError('Title is required', {
      field: 'title',
      value: args.title
    });
  }

  if (args.title.length > 200) {
    throw new ValidationError('Title too long', {
      field: 'title',
      maxLength: 200,
      actualLength: args.title.length
    });
  }

  // Create note...
}
```

### Example 4: Error Recovery with Retry

```typescript
// src/utils/retry.ts

import { ExternalServiceError } from '../errors/types.js';
import { logger } from './logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoff = true } = options;
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on user errors
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
        error: lastError.message
      });

      // Wait before retry
      if (attempt < maxRetries - 1) {
        const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Usage
const data = await withRetry(
  () => fetchFromExternalAPI(userId),
  { maxRetries: 3, delayMs: 1000, backoff: true }
);
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Swallowing Errors

**Wrong**:
```typescript
try {
  await riskyOperation();
} catch (error) {
  // Silent failure
  console.log('Error occurred');
}
```

**Correct**:
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', { error });
  throw new InternalError('Operation failed');
}
```

### ❌ Anti-Pattern 2: Exposing Sensitive Information

**Wrong**:
```typescript
catch (error) {
  throw new Error(`Database error: ${error.message}`);
  // Exposes database details
}
```

**Correct**:
```typescript
catch (error) {
  logger.error('Database error', { error });
  throw new InternalError('Data access failed');
}
```

### ❌ Anti-Pattern 3: Generic Error Messages

**Wrong**:
```typescript
if (!data) {
  throw new Error('Error');
}
```

**Correct**:
```typescript
if (!data) {
  throw new NotFoundError('Note', { noteId, userId });
}
```

### ❌ Anti-Pattern 4: Not Handling Async Errors

**Wrong**:
```typescript
app.get('/data', async (req, res) => {
  const data = await fetchData(); // Unhandled rejection
  res.json(data);
});
```

**Correct**:
```typescript
app.get('/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));
```

---

## Testing

### Unit Tests

```typescript
// src/errors/types.spec.ts

import { AuthenticationError, ValidationError } from './types.js';

describe('Error Types', () => {
  describe('AuthenticationError', () => {
    it('should create error with correct properties', () => {
      const error = new AuthenticationError('Token expired', { token: 'abc' });
      
      expect(error.message).toBe('Token expired');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ token: 'abc' });
    });
  });

  describe('ValidationError', () => {
    it('should create error with validation context', () => {
      const error = new ValidationError('Invalid email', { 
        field: 'email',
        value: 'invalid'
      });
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context?.field).toBe('email');
    });
  });
});
```

### Integration Tests

```typescript
// src/middleware/error-handler.spec.ts

import request from 'supertest';
import express from 'express';
import { errorHandler } from './error-handler.js';
import { ValidationError } from '../errors/types.js';

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.get('/test-validation', () => {
      throw new ValidationError('Invalid input', { field: 'name' });
    });
    app.use(errorHandler);
  });

  it('should handle ValidationError correctly', async () => {
    const response = await request(app).get('/test-validation');
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid input');
  });

  it('should not expose context in production', async () => {
    process.env.NODE_ENV = 'production';
    const response = await request(app).get('/test-validation');
    
    expect(response.body.error.context).toBeUndefined();
  });
});
```

---

## Best Practices

1. **Use Custom Error Types**: Create specific error classes for different scenarios
2. **Log with Context**: Include relevant context (userId, requestId, etc.) in error logs
3. **Fail Fast**: Validate input early and throw errors immediately
4. **Graceful Degradation**: Provide fallback behavior when possible
5. **User-Friendly Messages**: Error messages should be actionable for users
6. **Security First**: Never expose sensitive information in error messages
7. **Centralized Handling**: Use middleware for consistent error handling
8. **Monitor Errors**: Track error rates and patterns in production
9. **Retry Strategically**: Retry transient failures, not user errors
10. **Test Error Paths**: Write tests for error scenarios

---

## Integration with MCP Auth

### Auth Middleware Errors

```typescript
// mcp-auth handles authentication errors internally
// Your server receives authenticated requests or rejection

import { wrapServer } from '@prmichaelsen/mcp-auth';

const wrappedServer = wrapServer(mcpServer, {
  authProvider: jwtProvider,
  // mcp-auth will reject unauthenticated requests
  // Your tools only receive authenticated requests
});
```

### Tool Error Handling

```typescript
// In your MCP tools, focus on business logic errors
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // request.userId is guaranteed to exist (from mcp-auth)
  try {
    const tools = await getToolsForUser(request.userId);
    return { tools };
  } catch (error) {
    // Handle business logic errors
    if (error instanceof NotFoundError) {
      return { tools: [] }; // Graceful fallback
    }
    throw error; // Let error handler catch it
  }
});
```

---

## Performance Considerations

1. **Error Creation Cost**: Custom error classes have minimal overhead
2. **Stack Traces**: Captured automatically, useful for debugging
3. **Logging Volume**: Log errors appropriately (not every validation error)
4. **Retry Backoff**: Use exponential backoff to avoid overwhelming services
5. **Circuit Breaker**: Consider implementing for external service calls

---

## Security Considerations

1. **Never expose**:
   - Database connection strings
   - API keys or tokens
   - Internal file paths
   - Stack traces (in production)
   - User data from other users

2. **Always sanitize**:
   - Error messages sent to clients
   - Log output (remove sensitive data)
   - Context objects (filter sensitive fields)

3. **Rate limiting**: Prevent error-based attacks (e.g., brute force)

---

## Related Patterns

- [Logging Pattern](mcp-auth-server-base.logging.md) - Structured error logging
- [Health Check Pattern](mcp-auth-server-base.health-check.md) - Error monitoring
- [Testing Auth Providers Pattern](mcp-auth-server-base.testing-auth-providers.md) - Testing error scenarios

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server error handling
**Recommendation**: Implement comprehensive error handling from the start
