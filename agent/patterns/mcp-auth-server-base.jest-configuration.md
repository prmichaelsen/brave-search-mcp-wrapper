# Jest Configuration Pattern

**Pattern**: mcp-auth-server-base.jest-configuration
**Category**: Testing
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines Jest configuration for MCP auth-wrapped servers using TypeScript and ES modules. It covers test setup, module resolution, coverage configuration, and best practices for testing Node.js applications with modern JavaScript features.

**Key Principles**:
- Use ES modules (not CommonJS)
- Colocate tests with source code
- Configure path aliases
- Aim for high test coverage
- Fast test execution

---

## Core Concepts

### Jest with ES Modules

Jest traditionally uses CommonJS, but modern Node.js projects use ES modules. Configuration must handle:
- `.ts` files treated as ES modules
- `import`/`export` syntax
- Top-level `await`
- Module name mapping for path aliases

### Test Organization

```
src/
├── auth/
│   ├── jwt-provider.ts
│   └── jwt-provider.spec.ts    # Colocated test
├── services/
│   ├── note-service.ts
│   └── note-service.spec.ts    # Colocated test
└── utils/
    ├── logger.ts
    └── logger.spec.ts          # Colocated test
```

---

## Implementation

### 1. jest.config.js

```javascript
// jest.config.js

export default {
  // Use ts-jest preset for ES modules
  preset: 'ts-jest/presets/default-esm',
  
  // Test environment
  testEnvironment: 'node',
  
  // Treat .ts files as ES modules
  extensionsToTreatAsEsm: ['.ts'],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  
  // Test file patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'  // Exclude entry point
  ],
  
  // Coverage thresholds
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler'
        }
      }
    ]
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000
};
```

### 2. package.json Scripts

```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",
    "test:coverage": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage",
    "test:ci": "node --experimental-vm-modules node_modules/jest/bin/jest.js --ci --coverage --maxWorkers=2"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. Test Setup File

```typescript
// tests/setup.ts

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

### 4. TypeScript Configuration for Tests

```json
// tsconfig.json

{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@auth/*": ["src/auth/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 5. .env.test

```bash
# .env.test

NODE_ENV=test
PORT=8080

# Test credentials (not real)
JWT_SECRET=test-jwt-secret-for-testing-only
PLATFORM_SERVICE_TOKEN=test-platform-token
PLATFORM_URL=http://localhost:3000

# Test database
DATABASE_URL=sqlite::memory:

# Disable external services
ENABLE_EXTERNAL_API=false
```

---

## Examples

### Example 1: Basic Test File

```typescript
// src/utils/format.spec.ts

import { describe, it, expect } from '@jest/globals';
import { formatDate, formatCurrency } from './format.js';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2026-02-21T12:00:00Z');
    const result = formatDate(date);
    expect(result).toBe('2026-02-21');
  });

  it('should handle invalid dates', () => {
    const result = formatDate(new Date('invalid'));
    expect(result).toBe('Invalid Date');
  });
});

describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toBe('$1,234.56');
  });

  it('should handle zero', () => {
    const result = formatCurrency(0, 'USD');
    expect(result).toBe('$0.00');
  });
});
```

### Example 2: Testing with Mocks

```typescript
// src/services/note-service.spec.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NoteService } from './note-service.js';
import type { Database } from '../db/database.js';

// Mock database
const mockDb: jest.Mocked<Database> = {
  notes: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn()
  }
} as any;

describe('NoteService', () => {
  let service: NoteService;

  beforeEach(() => {
    service = new NoteService(mockDb);
    jest.clearAllMocks();
  });

  describe('createNote', () => {
    it('should create a note', async () => {
      const mockNote = {
        id: '123',
        userId: 'user1',
        title: 'Test Note',
        content: 'Test content',
        createdAt: new Date()
      };

      mockDb.notes.create.mockResolvedValue(mockNote);

      const result = await service.createNote('user1', 'Test Note', 'Test content');

      expect(result).toEqual(mockNote);
      expect(mockDb.notes.create).toHaveBeenCalledWith({
        userId: 'user1',
        title: 'Test Note',
        content: 'Test content',
        createdAt: expect.any(Date)
      });
    });

    it('should throw error on database failure', async () => {
      mockDb.notes.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createNote('user1', 'Test', 'Content')
      ).rejects.toThrow('Database error');
    });
  });
});
```

### Example 3: Testing Async Code

```typescript
// src/services/external-api.spec.ts

import { describe, it, expect, jest } from '@jest/globals';
import { fetchFromExternalAPI } from './external-api.js';

// Mock fetch
global.fetch = jest.fn();

describe('fetchFromExternalAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await fetchFromExternalAPI('user1');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data/user1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer')
        })
      })
    );
  });

  it('should handle HTTP errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(fetchFromExternalAPI('user1')).rejects.toThrow('External service error');
  });

  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(fetchFromExternalAPI('user1')).rejects.toThrow('External service error');
  });
});
```

### Example 4: Integration Test

```typescript
// src/index.spec.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from './app.js';
import { initDatabase, closeDatabase } from './db/database.js';

describe('MCP Server Integration Tests', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Health Check', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });
  });

  describe('MCP Endpoints', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/mcp/tools/call')
        .send({ tool: 'test' });
      
      expect(response.status).toBe(401);
    });

    it('should accept valid JWT', async () => {
      const token = generateTestToken('user1');
      
      const response = await request(app)
        .get('/mcp/tools')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tools');
    });
  });
});
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Not Using ES Modules

**Wrong**:
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',  // ❌ CommonJS preset
  testEnvironment: 'node'
};
```

**Correct**:
```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',  // ✅ ESM preset
  extensionsToTreatAsEsm: ['.ts']
};
```

### ❌ Anti-Pattern 2: Tests in Separate Directory

**Wrong**:
```
src/
  auth/
    jwt-provider.ts
tests/                    # ❌ Separate directory
  auth/
    jwt-provider.test.ts
```

**Correct**:
```
src/
  auth/
    jwt-provider.ts
    jwt-provider.spec.ts  # ✅ Colocated
```

### ❌ Anti-Pattern 3: No Coverage Thresholds

**Wrong**:
```javascript
export default {
  collectCoverage: true
  // ❌ No thresholds
};
```

**Correct**:
```javascript
export default {
  collectCoverage: true,
  coverageThresholds: {  // ✅ Enforce minimums
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### ❌ Anti-Pattern 4: Not Cleaning Up Mocks

**Wrong**:
```typescript
describe('MyService', () => {
  it('test 1', () => {
    jest.spyOn(service, 'method').mockReturnValue('value');
    // ❌ Mock persists to next test
  });
});
```

**Correct**:
```typescript
describe('MyService', () => {
  afterEach(() => {
    jest.clearAllMocks();  // ✅ Clean up
  });

  it('test 1', () => {
    jest.spyOn(service, 'method').mockReturnValue('value');
  });
});
```

---

## Testing Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One Assertion Per Test**: Focus on single behavior
3. **Descriptive Names**: Test names should describe behavior
4. **Test Edge Cases**: Cover error scenarios
5. **Mock External Dependencies**: Isolate unit tests
6. **Use beforeEach/afterEach**: Set up and tear down properly
7. **Avoid Test Interdependence**: Tests should be independent
8. **Fast Tests**: Keep tests under 100ms each
9. **Meaningful Assertions**: Use specific matchers
10. **Test Coverage**: Aim for 80%+ coverage

---

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Specific file
npm test -- jwt-provider.spec.ts

# Specific test
npm test -- -t "should verify valid token"
```

### CI/CD

```bash
# CI mode (no watch, with coverage)
npm run test:ci

# With specific reporters
npm test -- --ci --coverage --reporters=default --reporters=jest-junit
```

### Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# Open coverage report
open coverage/index.html

# View coverage summary
npm test -- --coverage --coverageReporters=text-summary
```

---

## Performance Considerations

1. **Parallel Execution**: Jest runs tests in parallel by default
2. **Test Isolation**: Each test file runs in separate process
3. **Mock Heavy Operations**: Mock database, network calls
4. **Limit Setup**: Minimize beforeAll/beforeEach work
5. **Fast Assertions**: Use simple matchers when possible

---

## Security Considerations

1. **Test Credentials**: Use fake credentials in tests
2. **Isolated Environment**: Tests don't affect production
3. **Clean Up**: Remove test data after tests
4. **No Real APIs**: Mock all external services
5. **Secrets**: Never commit real secrets in test files

---

## Related Patterns

- [Testing Auth Providers Pattern](mcp-auth-server-base.testing-auth-providers.md) - Testing authentication
- [Error Handling Pattern](mcp-auth-server-base.error-handling.md) - Testing error scenarios
- [Logging Pattern](mcp-auth-server-base.logging.md) - Testing with logs

---

**Status**: Production Ready
**Based On**: Requirements specification jest.config.js
**Recommendation**: Use Jest with ES modules for all MCP server testing
