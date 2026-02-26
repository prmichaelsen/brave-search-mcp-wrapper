# Command: add-auth-provider

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.add-auth-provider` has been invoked. Follow the steps below to execute this command.

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Add an additional authentication provider to an existing MCP auth server project
**Category**: Configuration
**Frequency**: As Needed

---

## What This Command Does

This command adds a new authentication provider to your MCP auth server, enabling multi-provider authentication:

1. **Detects existing providers** in your project
2. **Adds new provider** (JWT, OAuth, API Key, or Environment)
3. **Updates dependencies** (installs required npm packages)
4. **Updates configuration** (modifies src/index.ts and src/auth/provider.ts)
5. **Updates environment files** (.env.example with new variables)

**Use this when**:
- Adding API Key authentication to JWT-based server
- Adding Environment provider for local development
- Supporting multiple authentication methods
- Migrating from one auth provider to another

---

## Prerequisites

- [ ] Project initialized with `@mcp-auth-server-base.init`
- [ ] Existing auth provider configured
- [ ] src/auth/provider.ts exists
- [ ] src/index.ts exists
- [ ] package.json exists

---

## Steps

### 1. Detect Existing Providers

Analyze the current project to identify existing authentication providers.

**Actions**:
```bash
# Check for existing provider file
ls -la src/auth/provider.ts

# Check for auth-related dependencies
grep -E "jsonwebtoken|oauth|passport" package.json || true

# Check for auth environment variables
grep -E "JWT_SECRET|OAUTH_|API_KEY" .env.example || true
```

**Parse provider.ts**:
- Look for `createJwtProvider`, `createOAuthProvider`, etc.
- Identify which providers are already configured
- Display to user

**Expected Outcome**: Existing providers identified

**Example Output**:
```
Current Authentication Providers:
  ✓ JWT Provider (jsonwebtoken)
    - Environment: JWT_SECRET

Available Providers to Add:
  1. OAuth Provider
  2. API Key Provider
  3. Environment Provider
```

### 2. Select New Provider

Present available providers and let user choose.

**Actions**:
Ask user to select from:
1. **JWT Provider** - Token-based authentication with signature verification
2. **OAuth Provider** - OAuth 2.0 flow with token refresh
3. **API Key Provider** - Simple API key validation
4. **Environment Provider** - Development-only, reads from environment

**For each provider, explain**:
- What it does
- When to use it
- Required dependencies
- Required environment variables

**Expected Outcome**: Provider selected

### 3. Check for Conflicts

Verify the new provider won't conflict with existing configuration.

**Actions**:
- Check if provider already exists
- Check for conflicting environment variables
- Warn about potential issues

**Conflicts to check**:
- Same provider type already configured
- Overlapping environment variable names
- Dependency version conflicts

**Expected Outcome**: Conflicts identified or cleared

### 4. Install Dependencies

Install npm packages required for the new provider.

**Actions**:
Based on provider selection:

**JWT Provider**:
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**OAuth Provider**:
```bash
npm install axios
npm install --save-dev @types/axios
```

**API Key Provider**:
```bash
npm install crypto
# (built-in, no install needed)
```

**Environment Provider**:
```bash
# No additional dependencies
```

**Expected Outcome**: Dependencies installed

**Verification**:
```bash
# Verify installation
npm list jsonwebtoken  # (or relevant package)
```

### 5. Generate Provider Code

Create or update the provider file with new provider implementation.

**Actions**:
Add provider implementation to `src/auth/provider.ts`:

**For JWT Provider**:
```typescript
import jwt from 'jsonwebtoken';
import { AuthProvider } from '@prmichaelsen/mcp-auth';

export function createJwtProvider(): AuthProvider {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    async authenticate(token: string) {
      try {
        const decoded = jwt.verify(token, secret) as { sub: string; [key: string]: any };
        return {
          userId: decoded.sub,
          metadata: decoded
        };
      } catch (error) {
        throw new Error('Invalid JWT token');
      }
    }
  };
}
```

**For OAuth Provider**:
```typescript
import axios from 'axios';
import { AuthProvider } from '@prmichaelsen/mcp-auth';

export function createOAuthProvider(): AuthProvider {
  const tokenUrl = process.env.OAUTH_TOKEN_URL;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('OAuth environment variables required');
  }

  return {
    async authenticate(token: string) {
      try {
        const response = await axios.post(tokenUrl, {
          token,
          client_id: clientId,
          client_secret: clientSecret
        });
        
        return {
          userId: response.data.user_id,
          metadata: response.data
        };
      } catch (error) {
        throw new Error('OAuth token validation failed');
      }
    }
  };
}
```

**For API Key Provider**:
```typescript
import crypto from 'crypto';
import { AuthProvider } from '@prmichaelsen/mcp-auth';

export function createApiKeyProvider(): AuthProvider {
  const validKeys = process.env.API_KEYS?.split(',') || [];
  
  if (validKeys.length === 0) {
    throw new Error('API_KEYS environment variable required');
  }

  // Hash keys for secure comparison
  const hashedKeys = validKeys.map(key => 
    crypto.createHash('sha256').update(key).digest('hex')
  );

  return {
    async authenticate(token: string) {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      if (!hashedKeys.includes(hashedToken)) {
        throw new Error('Invalid API key');
      }

      return {
        userId: 'api-key-user',
        metadata: { authType: 'api-key' }
      };
    }
  };
}
```

**For Environment Provider**:
```typescript
import { AuthProvider } from '@prmichaelsen/mcp-auth';

export function createEnvProvider(): AuthProvider {
  const allowedUserId = process.env.DEV_USER_ID || 'dev-user';

  return {
    async authenticate(token: string) {
      // In development, accept any token
      return {
        userId: allowedUserId,
        metadata: { authType: 'environment', dev: true }
      };
    }
  };
}
```

**Expected Outcome**: Provider code generated

### 6. Update Server Configuration

Modify src/index.ts to use multiple providers.

**Actions**:
Update wrapServer configuration:

**Provider Chain** (try multiple in order):
```typescript
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createJwtProvider } from './auth/provider.js';
import { createApiKeyProvider } from './auth/api-key-provider.js';

const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    // Try JWT first
    try {
      const jwtProvider = createJwtProvider();
      return await jwtProvider.authenticate(token);
    } catch (jwtError) {
      // Fall back to API Key
      try {
        const apiKeyProvider = createApiKeyProvider();
        return await apiKeyProvider.authenticate(token);
      } catch (apiKeyError) {
        throw new Error('Authentication failed: Invalid JWT or API key');
      }
    }
  },
  // ... rest of configuration
});
```

**Provider Selection** (choose based on token format):
```typescript
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    // Detect token type
    if (token.startsWith('Bearer ')) {
      // JWT token
      const jwtProvider = createJwtProvider();
      return await jwtProvider.authenticate(token.substring(7));
    } else if (token.startsWith('ApiKey ')) {
      // API Key
      const apiKeyProvider = createApiKeyProvider();
      return await apiKeyProvider.authenticate(token.substring(7));
    } else {
      throw new Error('Unknown token format');
    }
  },
  // ... rest of configuration
});
```

**Expected Outcome**: Server configuration updated

### 7. Update Environment Files

Add new environment variables to .env.example.

**Actions**:
Append to `.env.example`:

**For JWT Provider**:
```bash
# JWT Authentication
JWT_SECRET=your-jwt-secret-key-here
```

**For OAuth Provider**:
```bash
# OAuth Authentication
OAUTH_TOKEN_URL=https://oauth-provider.com/token
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
```

**For API Key Provider**:
```bash
# API Key Authentication
API_KEYS=key1,key2,key3
```

**For Environment Provider**:
```bash
# Development Authentication
DEV_USER_ID=dev-user
```

**Expected Outcome**: Environment files updated

### 8. Verify Addition

Verify the new provider is properly configured.

**Actions**:
```bash
# Type check
npm run type-check

# Build
npm run build

# Run tests (if they exist)
npm test || true
```

**Expected Outcome**: Verification passed

### 9. Display Summary

Show what was added and next steps.

**Actions**:
Display summary:

```
✅ Authentication Provider Added

Provider Added:
  ✓ API Key Provider

Files Modified:
  ✓ src/auth/api-key-provider.ts (created)
  ✓ src/index.ts (updated with provider chain)
  ✓ .env.example (added API_KEYS variable)
  ✓ package.json (added crypto dependency)

Configuration:
  • Provider Type: API Key
  • Auth Strategy: Provider chain (JWT → API Key)
  • Environment Variables: API_KEYS

Next Steps:
  1. Update .env with actual API keys:
     echo "API_KEYS=your-key-1,your-key-2" >> .env

  2. Test authentication locally:
     npm run dev
     # Test with API key header

  3. Update secrets in Secret Manager:
     @mcp-auth-server-base.setup-secrets

  4. Redeploy with new provider:
     @mcp-auth-server-base.deploy

Related Commands:
  • @mcp-auth-server-base.setup-secrets - Configure secrets
  • @mcp-auth-server-base.validate - Validate configuration
  • @mcp-auth-server-base.deploy - Deploy changes

Related Patterns:
  • agent/patterns/mcp-auth-server-base.auth-provider-apikey.md
  • agent/patterns/mcp-auth-server-base.server-wrapping.md
```

**Expected Outcome**: Summary displayed

---

## Multi-Provider Patterns

### Pattern 1: Provider Chain (Fallback)

Try providers in order until one succeeds:

```typescript
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    const providers = [
      createJwtProvider(),
      createApiKeyProvider(),
      createEnvProvider()
    ];

    for (const provider of providers) {
      try {
        return await provider.authenticate(token);
      } catch (error) {
        // Try next provider
        continue;
      }
    }

    throw new Error('All authentication methods failed');
  }
});
```

**Use when**: Want to support multiple auth methods with automatic fallback

### Pattern 2: Provider Selection (Token Type)

Choose provider based on token format:

```typescript
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    if (token.startsWith('Bearer ')) {
      // JWT token
      const jwtProvider = createJwtProvider();
      return await jwtProvider.authenticate(token.substring(7));
    } else if (token.startsWith('ApiKey ')) {
      // API Key
      const apiKeyProvider = createApiKeyProvider();
      return await apiKeyProvider.authenticate(token.substring(7));
    } else if (token.startsWith('OAuth ')) {
      // OAuth token
      const oauthProvider = createOAuthProvider();
      return await oauthProvider.authenticate(token.substring(6));
    } else {
      throw new Error('Unknown authentication scheme');
    }
  }
});
```

**Use when**: Clients explicitly specify auth type in token format

### Pattern 3: Environment-Based Selection

Use different providers for different environments:

```typescript
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    if (process.env.NODE_ENV === 'development') {
      // Development: Use environment provider
      const envProvider = createEnvProvider();
      return await envProvider.authenticate(token);
    } else {
      // Production: Use JWT provider
      const jwtProvider = createJwtProvider();
      return await jwtProvider.authenticate(token);
    }
  }
});
```

**Use when**: Want different auth in development vs production

### Pattern 4: Composite Provider

Combine multiple providers with custom logic:

```typescript
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    // Try JWT first (most common)
    try {
      const jwtProvider = createJwtProvider();
      const result = await jwtProvider.authenticate(token);
      return { ...result, authType: 'jwt' };
    } catch (jwtError) {
      // Fall back to API Key for service accounts
      try {
        const apiKeyProvider = createApiKeyProvider();
        const result = await apiKeyProvider.authenticate(token);
        return { ...result, authType: 'api-key', isServiceAccount: true };
      } catch (apiKeyError) {
        // In development only, fall back to environment
        if (process.env.NODE_ENV === 'development') {
          const envProvider = createEnvProvider();
          const result = await envProvider.authenticate(token);
          return { ...result, authType: 'env', isDev: true };
        }
        throw new Error('Authentication failed');
      }
    }
  }
});
```

**Use when**: Need complex authentication logic with multiple fallbacks

---

## Examples

### Example 1: Add API Key to JWT Server

**Scenario**: Existing JWT server, want to add API Key for service-to-service auth

**Invocation**: `@mcp-auth-server-base.add-auth-provider`

**Workflow**:
```
Agent: "Detecting existing providers..."

Current Providers:
  ✓ JWT Provider

Agent: "Which provider would you like to add?"
  1. OAuth Provider
  2. API Key Provider
  3. Environment Provider

User: "2"

Agent: "Adding API Key Provider..."

✅ Created src/auth/api-key-provider.ts
✅ Updated src/index.ts (provider chain)
✅ Updated .env.example (API_KEYS variable)
✅ No additional dependencies needed

Next: Add API keys to .env and redeploy
```

### Example 2: Add Environment Provider for Development

**Scenario**: Production JWT server, want easy local development

**Invocation**: `@mcp-auth-server-base.add-auth-provider`

**Workflow**:
```
Agent: "Which provider would you like to add?"
User: "3" (Environment Provider)

Agent: "Adding Environment Provider..."

✅ Created src/auth/env-provider.ts
✅ Updated src/index.ts (environment-based selection)
✅ Updated .env.example (DEV_USER_ID variable)

Configuration:
  • Development: Environment Provider (no auth required)
  • Production: JWT Provider (secure auth)

Next: Set NODE_ENV=development for local testing
```

### Example 3: Add OAuth as Alternative

**Scenario**: JWT server, want to support OAuth as alternative

**Invocation**: `@mcp-auth-server-base.add-auth-provider`

**Workflow**:
```
Agent: "Which provider would you like to add?"
User: "1" (OAuth Provider)

Agent: "Installing dependencies..."
✓ npm install axios

Agent: "Adding OAuth Provider..."

✅ Created src/auth/oauth-provider.ts
✅ Updated src/index.ts (token format detection)
✅ Updated .env.example (OAUTH_* variables)
✅ Installed dependencies

Next: Configure OAuth credentials in .env
```

---

## Verification

After adding provider, verify it works:

### 1. Verify Files Created

```bash
# Check provider file
ls -la src/auth/*-provider.ts

# Check for new provider function
grep -E "createJwtProvider|createOAuthProvider|createApiKeyProvider|createEnvProvider" src/auth/*.ts
```

### 2. Verify Dependencies

```bash
# Check package.json
cat package.json | grep -A 5 '"dependencies"'

# Verify installed
npm list jsonwebtoken oauth axios
```

### 3. Verify Configuration

```bash
# Check src/index.ts for provider usage
grep -A 10 "authProvider" src/index.ts

# Check environment variables
grep -E "JWT_SECRET|OAUTH_|API_KEY|DEV_USER" .env.example
```

### 4. Test Type Checking

```bash
# Should compile without errors
npm run type-check
```

### 5. Test Build

```bash
# Should build successfully
npm run build
```

### 6. Test Locally

```bash
# Start server
npm run dev

# In another terminal, test with new auth method
# (specific test depends on provider added)
```

---

## Checklist

- [ ] Existing providers detected
- [ ] New provider selected
- [ ] Conflicts checked
- [ ] Dependencies installed
- [ ] Provider code generated
- [ ] Server configuration updated
- [ ] Environment files updated
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] Local testing passed

---

## Expected Output

### Console Output

```
🔐 Adding Authentication Provider

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Detecting Existing Providers

Current Providers:
  ✓ JWT Provider (jsonwebtoken)
    Environment: JWT_SECRET

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2: Selecting New Provider

Which provider would you like to add?
  1. OAuth Provider - OAuth 2.0 flow with token refresh
  2. API Key Provider - Simple API key validation
  3. Environment Provider - Development-only (no real auth)

Selection: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3: Checking for Conflicts

✓ No conflicts detected
✓ API Key Provider not currently configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 4: Installing Dependencies

✓ crypto (built-in, no install needed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 5: Generating Provider Code

✓ Created src/auth/api-key-provider.ts (45 lines)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 6: Updating Server Configuration

✓ Updated src/index.ts (provider chain logic)

Strategy: Provider Chain (JWT → API Key)
  • Try JWT first
  • Fall back to API Key if JWT fails

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 7: Updating Environment Files

✓ Updated .env.example (API_KEYS variable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 8: Verifying Addition

✓ TypeScript compiles without errors
✓ Build succeeds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ API Key Provider Added Successfully

Files Created:
  ✓ src/auth/api-key-provider.ts

Files Modified:
  ✓ src/index.ts (provider chain)
  ✓ .env.example (API_KEYS)

Configuration:
  • Providers: JWT + API Key
  • Strategy: Provider chain (JWT first, API Key fallback)
  • Environment Variables: JWT_SECRET, API_KEYS

Next Steps:

1. Add API keys to .env:
   echo "API_KEYS=key1,key2,key3" >> .env

2. Test locally:
   npm run dev
   # Test with: Authorization: ApiKey your-key-here

3. Update secrets in Secret Manager:
   @mcp-auth-server-base.setup-secrets

4. Redeploy:
   @mcp-auth-server-base.deploy

Related Commands:
  • @mcp-auth-server-base.setup-secrets
  • @mcp-auth-server-base.validate
  • @mcp-auth-server-base.deploy

Related Patterns:
  • agent/patterns/mcp-auth-server-base.auth-provider-apikey.md
  • agent/patterns/mcp-auth-server-base.server-wrapping.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Troubleshooting

### Issue 1: Provider already exists

**Symptom**: Error "Provider already configured"

**Cause**: Selected provider is already in use

**Solution**:
```bash
# Check existing providers
grep -r "createJwtProvider\|createOAuthProvider" src/

# Choose a different provider or modify existing one
```

### Issue 2: Dependency installation fails

**Symptom**: npm install fails

**Cause**: Network issues or package conflicts

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install jsonwebtoken

# Or use specific version
npm install jsonwebtoken@9.0.0
```

### Issue 3: TypeScript compilation errors

**Symptom**: tsc reports type errors after adding provider

**Cause**: Missing type definitions or incorrect imports

**Solution**:
```bash
# Install type definitions
npm install --save-dev @types/jsonwebtoken

# Check imports
# Ensure using .js extension for ES modules
import { createJwtProvider } from './auth/provider.js';
```

### Issue 4: Provider conflicts

**Symptom**: Multiple providers interfere with each other

**Cause**: Overlapping authentication logic

**Solution**:
```typescript
// Use explicit provider selection instead of chain
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    // Detect token type explicitly
    if (token.includes('.')) {
      // JWT (has dots)
      return await createJwtProvider().authenticate(token);
    } else {
      // API Key (no dots)
      return await createApiKeyProvider().authenticate(token);
    }
  }
});
```

### Issue 5: Environment variables not loaded

**Symptom**: Error "JWT_SECRET is required" even though it's in .env

**Cause**: .env file not loaded or wrong file

**Solution**:
```bash
# Verify .env file exists
ls -la .env

# Check if dotenv is configured (if using dotenv)
grep "dotenv" src/index.ts

# Or use environment variables directly
export JWT_SECRET=your-secret
npm run dev
```

### Issue 6: Authentication still fails

**Symptom**: All providers reject valid tokens

**Cause**: Provider logic error or misconfiguration

**Solution**:
```typescript
// Add debug logging
const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    console.log('Authenticating token:', token.substring(0, 20) + '...');
    
    try {
      const result = await createJwtProvider().authenticate(token);
      console.log('JWT auth succeeded:', result.userId);
      return result;
    } catch (error) {
      console.log('JWT auth failed:', error.message);
      throw error;
    }
  }
});
```

---

## Advanced Usage

### Multiple Provider Files

Organize providers in separate files:

```
src/auth/
├── provider.ts          # Main provider factory
├── jwt-provider.ts      # JWT implementation
├── oauth-provider.ts    # OAuth implementation
├── apikey-provider.ts   # API Key implementation
└── env-provider.ts      # Environment implementation
```

**provider.ts**:
```typescript
import { createJwtProvider } from './jwt-provider.js';
import { createApiKeyProvider } from './apikey-provider.js';
import { createEnvProvider } from './env-provider.js';

export function createAuthProvider() {
  return async (token: string) => {
    // Provider chain logic
    // ...
  };
}
```

### Provider with Caching

Cache authentication results:

```typescript
const authCache = new Map<string, { userId: string; expires: number }>();

const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    // Check cache
    const cached = authCache.get(token);
    if (cached && cached.expires > Date.now()) {
      return { userId: cached.userId };
    }

    // Authenticate
    const result = await createJwtProvider().authenticate(token);

    // Cache for 5 minutes
    authCache.set(token, {
      userId: result.userId,
      expires: Date.now() + 5 * 60 * 1000
    });

    return result;
  }
});
```

### Provider with Metrics

Track authentication metrics:

```typescript
let authAttempts = 0;
let authSuccesses = 0;
let authFailures = 0;

const wrappedServer = wrapServer(server, {
  authProvider: async (token: string) => {
    authAttempts++;
    
    try {
      const result = await createJwtProvider().authenticate(token);
      authSuccesses++;
      return result;
    } catch (error) {
      authFailures++;
      throw error;
    }
  }
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    auth_attempts: authAttempts,
    auth_successes: authSuccesses,
    auth_failures: authFailures,
    success_rate: authSuccesses / authAttempts
  });
});
```

---

## Security Considerations

### 1. Provider Order Matters

**❌ WRONG**:
```typescript
// Environment provider first (bypasses real auth!)
const providers = [
  createEnvProvider(),  // ❌ Accepts anything
  createJwtProvider()   // Never reached
];
```

**✅ CORRECT**:
```typescript
// Most secure first, least secure last
const providers = [
  createJwtProvider(),    // ✅ Secure
  createApiKeyProvider(), // ✅ Moderately secure
  createEnvProvider()     // ✅ Dev only, last resort
];
```

### 2. Environment Provider in Production

**❌ NEVER do this**:
```typescript
// Environment provider in production
if (process.env.NODE_ENV === 'production') {
  return createEnvProvider();  // ❌ NO AUTH IN PRODUCTION!
}
```

**✅ CORRECT**:
```typescript
// Environment provider only in development
if (process.env.NODE_ENV === 'development') {
  return createEnvProvider();  // ✅ Dev only
} else {
  return createJwtProvider();  // ✅ Secure in production
}
```

### 3. API Key Storage

**❌ WRONG**:
```typescript
// Hardcoded API keys
const validKeys = ['key1', 'key2'];  // ❌ In source code
```

**✅ CORRECT**:
```typescript
// From environment
const validKeys = process.env.API_KEYS?.split(',') || [];  // ✅ From env
```

### 4. Error Messages

**❌ WRONG**:
```typescript
throw new Error('JWT verification failed: ' + error.message);  // ❌ Leaks details
```

**✅ CORRECT**:
```typescript
throw new Error('Authentication failed');  // ✅ Generic message
```

---

## Related Commands

- [`@mcp-auth-server-base.init`](mcp-auth-server-base.init.md) - Initial provider setup
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate auth configuration
- [`@mcp-auth-server-base.setup-secrets`](mcp-auth-server-base.setup-secrets.md) - Configure secrets
- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy with new provider

---

## Related Patterns

- [`mcp-auth-server-base.auth-provider-jwt`](../patterns/mcp-auth-server-base.auth-provider-jwt.md) - JWT provider
- [`mcp-auth-server-base.auth-provider-oauth`](../patterns/mcp-auth-server-base.auth-provider-oauth.md) - OAuth provider
- [`mcp-auth-server-base.auth-provider-apikey`](../patterns/mcp-auth-server-base.auth-provider-apikey.md) - API Key provider
- [`mcp-auth-server-base.auth-provider-env`](../patterns/mcp-auth-server-base.auth-provider-env.md) - Environment provider
- [`mcp-auth-server-base.server-wrapping`](../patterns/mcp-auth-server-base.server-wrapping.md) - Server configuration

---

## Notes

- **Multi-Provider Support**: Server can use multiple auth methods simultaneously
- **Provider Chain**: Try providers in order until one succeeds
- **Provider Selection**: Choose provider based on token format
- **Environment-Based**: Different providers for dev vs production
- **Security**: Most secure provider should be tried first
- **Dependencies**: Automatically install required packages
- **Configuration**: Update both code and environment files
- **Testing**: Verify locally before deploying

---

**Namespace**: mcp-auth-server-base
**Command**: add-auth-provider
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.7.0+