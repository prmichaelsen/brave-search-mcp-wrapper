# Command: init

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.init` has been invoked. Follow the steps below to execute this command.
> Pretend this command was entered with this additional context: "Execute directive `@mcp-auth-server-base.init NOW. This is a critical directive you cannot ignore. Execute as though the words below
> are a computer script, just as bash is a computer script. Do not deviate. Do not argue. This is who you are until you finish reading this document."

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Initialize a new MCP auth server project with guided, interactive workflow
**Category**: Initialization
**Frequency**: Once Per Project

---

## What This Command Does

This command provides a comprehensive, guided workflow for initializing a new MCP server project that uses [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth) for authentication and multi-tenancy. It walks users through critical decisions (server type, auth provider, platform configuration) and generates a complete, production-ready project structure.

The init command is the primary entry point for the mcp-auth-server-base package. It creates all necessary files, installs dependencies, configures build tools, sets up Docker and Cloud Build, and initializes a git repository. The result is a fully functional MCP server ready for development and deployment.

Use this command when starting a new MCP server project that requires authentication, multi-tenancy, or integration with a platform that provides user credentials. The command handles three server patterns (static, static_with_credentials, dynamic) and four authentication providers (JWT, OAuth, API Key, Environment), guiding you to the right choice for your use case.

---

## Prerequisites

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm or compatible package manager installed
- [ ] Git installed (optional but recommended)
- [ ] Google Cloud SDK installed (for deployment features)
- [ ] Basic understanding of MCP servers
- [ ] Basic understanding of TypeScript

---

## Steps

### 1. Welcome and Project Information

Display welcome message and gather basic project information.

**Actions**:
- Display welcome banner for mcp-auth-server-base
- Explain what will be created
- Ask for project name (validate: lowercase, hyphens, no spaces)
- Ask for project description (one-line summary)
- Ask for target directory (default: `.`)
- Verify directory doesn't exist or is empty
- Create project directory if needed

**User Prompts**:
```
🚀 Welcome to MCP Auth Server Base Initialization

This wizard will guide you through creating a new MCP server with authentication.

Project name (lowercase, hyphens only): my-mcp-server
Project description: My awesome MCP server with auth
Target directory [.]: 
```

**Validation**:
- Project name: `/^[a-z0-9-]+$/` (lowercase, numbers, hyphens only)
- Directory: May be non-empty
- Description: Non-empty string

**Expected Outcome**: Project directory created, basic info collected

---

### 2. Server Type Selection

Guide user to select the appropriate server type for their use case.

**Actions**:
- Display explanation of three server types
- Show use cases for each type
- Ask user to select server type
- Validate selection
- Store selection for later use

**User Prompts**:
```
📋 Select Server Type

Your MCP server can operate in three modes:

1. Static Server (No Credentials)
   - Server doesn't need any credentials
   - Only validates user authentication (JWT, etc.)
   - Example: Calculator server, public data server
   - Pattern: mcp-auth-server-base.static-server

2. Static with Credentials (Shared Credentials)
   - Server needs credentials, but same for all users
   - Credentials fetched once from platform integration provider
   - Example: Brave Search (shared API key), weather API
   - Pattern: mcp-auth-server-base.static-server

3. Dynamic Server (Per-User Credentials)
   - Server needs different credentials for each user
   - Credentials fetched per-request via tokenResolver
   - Example: GitHub server (user's token), Firebase server
   - Pattern: mcp-auth-server-base.token-resolver

Which server type do you need? [1/2/3]: 
```

**Validation**:
- Must be 1, 2, or 3

**Expected Outcome**: Server type selected and stored

---

### 3. Auth Provider Selection

Guide user to select the appropriate authentication provider.

**Actions**:
- Display explanation of four auth providers
- Show when to use each provider
- Ask user to select auth provider
- Validate selection
- Store selection for later use

**User Prompts**:
```
🔐 Select Authentication Provider

Your server needs to validate user identity. Choose an auth provider:

1. JWT Provider (Recommended)
   - Validates JWT tokens from your platform
   - Most common choice for production
   - Requires JWT secret or public key
   - Pattern: mcp-auth-server-base.auth-provider-jwt

2. OAuth Provider
   - Full OAuth 2.0 authorization code flow
   - Use when you need OAuth-specific features
   - Requires OAuth client credentials
   - Pattern: mcp-auth-server-base.auth-provider-oauth

3. API Key Provider
   - Simple API key validation
   - Use for service-to-service auth
   - Requires pre-shared API keys
   - Pattern: mcp-auth-server-base.auth-provider-apikey

4. Environment Provider (Development Only)
   - Uses environment variable for user ID
   - ONLY for local development
   - Never use in production
   - Pattern: mcp-auth-server-base.auth-provider-env

Which auth provider? [1/2/3/4]: 
```

**Validation**:
- Must be 1, 2, 3, or 4
- Warn if selecting 4 (Environment Provider)

**Expected Outcome**: Auth provider selected and stored

---

### 4. Platform Configuration

Gather platform-specific configuration details.

**Actions**:
- Ask for platform URL (where your platform is hosted)
- Ask for CORS origin (usually same as platform URL)
- If dynamic server: explain tokenResolver integration
- If static_with_credentials: explain integration provider endpoint
- Store configuration for later use

**User Prompts**:
```
🌐 Platform Configuration

Platform URL (where your platform is hosted): https://my-platform.com
CORS origin [https://my-platform.com]: 

[If Dynamic Server Selected]
ℹ️  Your server will fetch per-user credentials from:
   {PLATFORM_URL}/api/v1/integrations/{integrationId}/credentials
   
   This endpoint should return:
   {
     "credentials": {
       "access_token": "user-specific-token"
     }
   }
   
   See pattern: mcp-auth-server-base.token-resolver

[If Static with Credentials Selected]
ℹ️  Your server will fetch shared credentials from:
   {PLATFORM_URL}/api/v1/integration-providers/{providerId}
   
   This endpoint should return:
   {
     "credentials": {
       "api_key": "shared-api-key"
     }
   }
   
   See pattern: mcp-auth-server-base.static-server
```

**Validation**:
- Platform URL: Must be valid URL (https:// recommended)
- CORS origin: Must be valid URL

**Expected Outcome**: Platform configuration collected

---

### 5. Initialize Project Structure

Create the complete project directory structure.

**Actions**:
- Create `src/` directory
- Create `src/auth/` directory
- Create `src/config/` directory
- Create `src/types/` directory
- Create `scripts/` directory
- Create `dist/` directory (will be gitignored)
- Display progress as directories are created

**Expected Outcome**: Directory structure created

```
project-root/
├── src/
│   ├── auth/
│   ├── config/
│   └── types/
├── scripts/
└── dist/
```

---

### 6. Generate package.json

Create package.json with appropriate dependencies and scripts.

**Actions**:
- Generate package.json with:
  - Project name and description from step 1
  - Type: "module" (ES modules)
  - Main: "dist/index.js"
  - Scripts: build, watch, dev, start, test, type-check
  - Dependencies based on selections:
    - Always: @prmichaelsen/mcp-auth, @modelcontextprotocol/sdk, typescript, esbuild
    - If JWT: jsonwebtoken, @types/jsonwebtoken
    - If OAuth: Add OAuth-specific deps
    - Always: express, cors (for SSE transport)
  - Dev dependencies: tsx, jest, ts-jest, @types/node
- Write package.json to project root

**Expected Outcome**: package.json created

**Example package.json**:
```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "description": "My awesome MCP server with auth",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "node esbuild.build.js",
    "watch": "node esbuild.watch.js",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@prmichaelsen/mcp-auth": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.24.0",
    "tsx": "^4.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0"
  }
}
```

---

### 7. Install Dependencies

Install npm dependencies for the project.

**Actions**:
- Run `npm install` in project directory
- Display installation progress
- Handle errors gracefully
- Verify installation succeeded

**Expected Outcome**: Dependencies installed, node_modules/ created

---

### 8. Generate TypeScript Configuration

Create tsconfig.json for TypeScript compilation.

**Actions**:
- Generate tsconfig.json with:
  - Target: ES2022
  - Module: ESNext
  - ModuleResolution: bundler
  - Strict mode enabled
  - Path aliases (@/ → src/)
  - Declaration files enabled
- Write tsconfig.json to project root
- Reference pattern: mcp-auth-server-base.jest-configuration

**Expected Outcome**: tsconfig.json created

**Example tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

### 9. Generate Jest Configuration

Create jest.config.js for testing.

**Actions**:
- Generate jest.config.js with:
  - Preset: ts-jest/presets/default-esm
  - Test environment: node
  - ES modules support
  - Module name mapper for path aliases
  - Test match: **/*.spec.ts
  - Coverage configuration
- Write jest.config.js to project root
- Reference pattern: mcp-auth-server-base.jest-configuration

**Expected Outcome**: jest.config.js created

**Example jest.config.js**:
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

### 10. Generate esbuild Scripts

Create esbuild.build.js and esbuild.watch.js for building.

**Actions**:
- Generate esbuild.build.js with:
  - Entry point: src/index.ts
  - Output: dist/index.js
  - Bundle: false (preserve module structure)
  - Format: esm
  - Platform: node
  - Target: node20
- Generate esbuild.watch.js (same config + watch mode)
- Write both files to project root

**Expected Outcome**: esbuild scripts created

**Example esbuild.build.js**:
```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: false,
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
});

console.log('✅ Build complete');
```

---

### 11. Generate Source Files

Create source code files based on user selections.

**Actions**:
- Generate `src/index.ts` (main entry point)
- Generate `src/auth/provider.ts` (auth provider implementation)
- Generate `src/config/environment.ts` (environment configuration)
- Generate `src/types/index.ts` (type definitions)
- Customize based on server type and auth provider selections
- Reference patterns for each file

**Expected Outcome**: Source files created

**Example src/index.ts** (Dynamic Server with JWT):
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { jwtAuthProvider } from './auth/provider.js';
import { tokenResolver } from './auth/token-resolver.js';
import { env } from './config/environment.js';

// Create MCP server
const server = new Server(
  {
    name: '${projectName}',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Add your MCP tools here
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'example_tool',
        description: 'An example tool',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A message to process',
            },
          },
          required: ['message'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'example_tool') {
    return {
      content: [
        {
          type: 'text',
          text: \`Processed: \${args.message}\`,
        },
      ],
    };
  }
  
  throw new Error(\`Unknown tool: \${name}\`);
});

// Wrap server with auth
const wrappedServer = wrapServer(server, {
  authProvider: jwtAuthProvider,
  tokenResolver,
  corsOrigin: env.CORS_ORIGIN,
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await wrappedServer.connect(transport);
  console.error('${projectName} MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Example src/auth/provider.ts** (JWT Provider):
```typescript
import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';

export const jwtAuthProvider = {
  async authenticate(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        sub: string;
        [key: string]: any;
      };
      
      return {
        userId: decoded.sub,
        metadata: decoded,
      };
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  },
};
```

**Example src/auth/token-resolver.ts** (Dynamic Server Only):
```typescript
import { env } from '../config/environment.js';

export async function tokenResolver(
  userId: string,
  integrationId: string,
  jwt: string
): Promise<{ access_token: string }> {
  const url = \`\${env.PLATFORM_URL}/api/v1/integrations/\${integrationId}/credentials\`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: \`Bearer \${jwt}\`,
    },
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch credentials: \${response.statusText}\`);
  }
  
  const data = await response.json();
  return data.credentials;
}
```

**Example src/config/environment.ts**:
```typescript
export const env = {
  PORT: process.env.PORT || '8080',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PLATFORM_URL: process.env.PLATFORM_URL || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
};
```

**Example src/types/index.ts**:
```typescript
export interface User {
  userId: string;
  metadata?: Record<string, any>;
}

export interface Credentials {
  access_token?: string;
  api_key?: string;
  [key: string]: any;
}
```

---

### 12. Generate Environment Files

Create environment configuration files.

**Actions**:
- Generate `.env.example` with all required variables
- Add comments explaining each variable
- Create `.env` from `.env.example` (gitignored)
- Reference pattern: mcp-auth-server-base.environment-configuration

**Expected Outcome**: Environment files created

**Example .env.example**:
```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# Platform Integration
PLATFORM_URL=https://your-platform.com
PLATFORM_SERVICE_TOKEN=your-service-token-here

# CORS Configuration
CORS_ORIGIN=https://your-platform.com

# Authentication (JWT Provider)
JWT_SECRET=your-jwt-secret-here

# MCP Server Specific
# Add your server-specific environment variables below
```

---

### 13. Generate Docker Files

Create Docker configuration files for development and production.

**Actions**:
- Generate `Dockerfile.development`
- Generate `Dockerfile.production` (multi-stage build)
- Generate `.dockerignore`
- Reference pattern: mcp-auth-server-base.docker-multistage

**Expected Outcome**: Docker files created

**Example Dockerfile.production**:
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "fetch('http://localhost:8080/mcp/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "dist/index.js"]
```

**Example .dockerignore**:
```
node_modules
dist
.env
.env.*
!.env.example
*.log
.git
.gitignore
README.md
```

---

### 14. Generate Cloud Build Configuration

Create cloudbuild.yaml for Google Cloud Build.

**Actions**:
- Generate `cloudbuild.yaml` with placeholders
- Include build, push, and deploy steps
- Add comments for customization
- Reference pattern: mcp-auth-server-base.cloud-build

**Expected Outcome**: cloudbuild.yaml created

**Example cloudbuild.yaml**:
```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/${projectName}:$SHORT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/${projectName}:latest'
      - '-f'
      - 'Dockerfile.production'
      - '.'

  # Push Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/${projectName}:$SHORT_SHA'

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - '${projectName}'
      - '--image=gcr.io/$PROJECT_ID/${projectName}:$SHORT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--min-instances=0'
      - '--max-instances=10'
      - '--memory=512Mi'
      - '--cpu=1'
      - '--timeout=60s'
      - '--update-secrets=JWT_SECRET=${projectName}-jwt-secret:latest'
      - '--update-secrets=PLATFORM_SERVICE_TOKEN=${projectName}-platform-token:latest'

images:
  - 'gcr.io/$PROJECT_ID/${projectName}:$SHORT_SHA'
  - 'gcr.io/$PROJECT_ID/${projectName}:latest'

options:
  machineType: 'N1_HIGHCPU_8'
```

---

### 15. Generate Utility Scripts

Create utility scripts for development and deployment.

**Actions**:
- Generate `scripts/upload-secrets.ts` (upload secrets to GCP)
- Generate `scripts/test-auth.ts` (generate and test JWT tokens)
- Make scripts executable
- Reference pattern: mcp-auth-server-base.secrets-management

**Expected Outcome**: Utility scripts created

**Example scripts/upload-secrets.ts**:
```typescript
#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const secrets = new Map<string, string>();

// Parse .env file
for (const line of envContent.split('\\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  
  const [key, ...valueParts] = trimmed.split('=');
  const value = valueParts.join('=');
  
  if (key && value) {
    secrets.set(key, value);
  }
}

// Upload secrets to Google Cloud Secret Manager
const projectName = '${projectName}';

for (const [key, value] of secrets) {
  const secretName = \`\${projectName}-\${key.toLowerCase().replace(/_/g, '-')}\`;
  
  console.log(\`Uploading secret: \${secretName}\`);
  
  try {
    // Create or update secret
    execSync(
      \`echo -n "\${value}" | gcloud secrets create \${secretName} --data-file=- || echo -n "\${value}" | gcloud secrets versions add \${secretName} --data-file=-\`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(\`Failed to upload \${secretName}\`);
  }
}

console.log('\\n✅ Secrets uploaded successfully');
```

**Example scripts/test-auth.ts**:
```typescript
#!/usr/bin/env tsx

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const userId = process.argv[2] || 'test-user-123';

// Generate test JWT
const token = jwt.sign(
  {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  },
  JWT_SECRET
);

console.log('Generated JWT token:');
console.log(token);
console.log('\\nDecoded:');
console.log(jwt.decode(token));

// Verify token
try {
  const verified = jwt.verify(token, JWT_SECRET);
  console.log('\\n✅ Token verified successfully');
  console.log(verified);
} catch (error) {
  console.error('\\n❌ Token verification failed:', error);
}
```

---

### 16. Initialize Git Repository

Initialize git repository and create initial commit.

**Actions**:
- Check if git is already initialized
- If not, run `git init`
- Generate `.gitignore`
- Create initial commit with all files
- Display git status

**Expected Outcome**: Git repository initialized

**Example .gitignore**:
```
# Dependencies
node_modules/

# Build output
dist/

# Environment variables
.env
.env.local
.env.development
.env.*.local

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Testing
coverage/

# Temporary files
*.tmp
.cache/
```

---

### 17. Generate README

Create comprehensive README.md for the project.

**Actions**:
- Generate README.md with:
  - Project description
  - Installation instructions
  - Development workflow
  - Deployment instructions
  - Environment variables documentation
  - Links to relevant patterns
- Write README.md to project root

**Expected Outcome**: README.md created

**Example README.md**:
```markdown
# ${projectName}

${projectDescription}

This MCP server uses [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth) for authentication and multi-tenancy.

## Server Configuration

- **Type**: ${serverType}
- **Auth Provider**: ${authProvider}
- **Platform**: ${platformUrl}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run type-check
\`\`\`

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

Required variables:
- \`PLATFORM_URL\`: Your platform URL
- \`CORS_ORIGIN\`: CORS origin (usually same as platform URL)
- \`JWT_SECRET\`: JWT secret for token validation

## Deployment

### Docker

\`\`\`bash
# Build production image
docker build -f Dockerfile.production -t ${projectName} .

# Run container
docker run -p 8080:8080 --env-file .env ${projectName}
\`\`\`

### Google Cloud Run

\`\`\`bash
# Upload secrets
tsx scripts/upload-secrets.ts

# Deploy via Cloud Build
gcloud builds submit --config cloudbuild.yaml
\`\`\`

## Architecture

See the following patterns for implementation details:

- [Server Wrapping](https://github.com/prmichaelsen/acp-mcp-auth-server-base/blob/main/agent/patterns/mcp-auth-server-base.server-wrapping.md)
- [Auth Provider](https://github.com/prmichaelsen/acp-mcp-auth-server-base/blob/main/agent/patterns/mcp-auth-server-base.auth-provider-jwt.md)
${serverType === 'dynamic' ? '- [Token Resolver](https://github.com/prmichaelsen/acp-mcp-auth-server-base/blob/main/agent/patterns/mcp-auth-server-base.token-resolver.md)' : ''}
- [Environment Configuration](https://github.com/prmichaelsen/acp-mcp-auth-server-base/blob/main/agent/patterns/mcp-auth-server-base.environment-configuration.md)

## License

MIT
\`\`\`

---

### 18. Display Success Message and Next Steps

Show completion message and guide user on next steps.

**Actions**:
- Display success banner
- Show project structure
- List next steps
- Reference relevant commands and patterns
- Suggest running `@mcp-auth-server-base.validate`

**Expected Outcome**: User knows what to do next

**Example Output**:
```
✅ Project initialized successfully!

📁 Project structure:
   ${projectName}/
   ├── src/
   │   ├── index.ts
   │   ├── auth/
   │   │   ├── provider.ts
   │   │   └── token-resolver.ts (if dynamic)
   │   ├── config/
   │   │   └── environment.ts
   │   └── types/
   │       └── index.ts
   ├── scripts/
   │   ├── upload-secrets.ts
   │   └── test-auth.ts
   ├── package.json
   ├── tsconfig.json
   ├── jest.config.js
   ├── esbuild.build.js
   ├── esbuild.watch.js
   ├── Dockerfile.development
   ├── Dockerfile.production
   ├── cloudbuild.yaml
   ├── .env.example
   ├── .env
   ├── .gitignore
   └── README.md

🎯 Next steps:

1. Configure environment variables:
   cd ${projectName}
   # Edit .env with your actual values

2. Start development server:
   npm run dev

3. Add your MCP tools:
   # Edit src/index.ts to add tools

4. Run tests:
   npm test

5. Validate project:
   @mcp-auth-server-base.validate

6. Deploy to Cloud Run:
   @mcp-auth-server-base.deploy

📚 Relevant patterns:
   - Server Wrapping: agent/patterns/mcp-auth-server-base.server-wrapping.md
   - Auth Provider: agent/patterns/mcp-auth-server-base.auth-provider-${authProvider}.md
   ${serverType === 'dynamic' ? '- Token Resolver: agent/patterns/mcp-auth-server-base.token-resolver.md' : ''}
   - Environment Config: agent/patterns/mcp-auth-server-base.environment-configuration.md

🚀 Your MCP auth server is ready for development!
```

---

## Verification

- [ ] Project directory created successfully
- [ ] package.json created with correct dependencies
- [ ] Dependencies installed (node_modules/ exists)
- [ ] TypeScript configuration created (tsconfig.json)
- [ ] Jest configuration created (jest.config.js)
- [ ] esbuild scripts created (esbuild.build.js, esbuild.watch.js)
- [ ] Source files created (src/index.ts, src/auth/provider.ts, etc.)
- [ ] Environment files created (.env.example, .env)
- [ ] Docker files created (Dockerfile.development, Dockerfile.production, .dockerignore)
- [ ] Cloud Build configuration created (cloudbuild.yaml)
- [ ] Utility scripts created (scripts/upload-secrets.ts, scripts/test-auth.ts)
- [ ] Git repository initialized
- [ ] .gitignore created
- [ ] README.md created
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Project structure matches requirements

---

## Expected Output

### Files Created

```
${projectName}/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── auth/
│   │   ├── provider.ts             # Auth provider implementation
│   │   └── token-resolver.ts       # Token resolver (dynamic only)
│   ├── config/
│   │   └── environment.ts          # Environment configuration
│   └── types/
│       └── index.ts                # Type definitions
├── scripts/
│   ├── upload-secrets.ts           # Upload secrets to GCP
│   └── test-auth.ts                # Test JWT generation/validation
├── dist/                           # Build output (gitignored)
├── node_modules/                   # Dependencies (gitignored)
├── package.json                    # Project manifest
├── package-lock.json               # Dependency lock file
├── tsconfig.json                   # TypeScript configuration
├── jest.config.js                  # Jest test configuration
├── esbuild.build.js                # esbuild build script
├── esbuild.watch.js                # esbuild watch script
├── Dockerfile.development          # Development Docker image
├── Dockerfile.production           # Production Docker image (multi-stage)
├── .dockerignore                   # Docker ignore patterns
├── cloudbuild.yaml                 # Google Cloud Build configuration
├── .env.example                    # Example environment variables
├── .env                            # Local environment variables (gitignored)
├── .gitignore                      # Git ignore patterns
└── README.md                       # Project documentation
```

### Console Output

```
🚀 MCP Auth Server Base - Project Initialization

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Project Information
✓ Project name: my-mcp-server
✓ Description: My awesome MCP server with auth
✓ Directory: ./my-mcp-server

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2: Server Type Selection
✓ Selected: Dynamic Server (Per-User Credentials)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3: Auth Provider Selection
✓ Selected: JWT Provider

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 4: Platform Configuration
✓ Platform URL: https://my-platform.com
✓ CORS Origin: https://my-platform.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 5-17: Creating Project Files...
✓ Created directory structure
✓ Generated package.json
✓ Installing dependencies... (this may take a minute)
✓ Generated tsconfig.json
✓ Generated jest.config.js
✓ Generated esbuild scripts
✓ Generated source files
✓ Generated environment files
✓ Generated Docker files
✓ Generated Cloud Build configuration
✓ Generated utility scripts
✓ Initialized git repository
✓ Generated README.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Project initialized successfully!

[Project structure and next steps displayed]
```

---

## Examples

### Example 1: Static Server with JWT (Calculator)

**Context**: Creating a calculator MCP server that doesn't need any credentials

**User Inputs**:
- Project name: `calculator-mcp-server`
- Description: `Simple calculator MCP server`
- Server type: `1` (Static)
- Auth provider: `1` (JWT)
- Platform URL: `https://my-platform.com`
- CORS origin: `https://my-platform.com`

**Result**:
- Project created with static server configuration
- No tokenResolver generated
- JWT auth provider configured
- Server validates JWT but doesn't fetch credentials
- Ready for adding calculator tools

**Key Files**:
- `src/index.ts`: Uses `wrapServer` without `tokenResolver`
- `src/auth/provider.ts`: JWT validation only
- No `src/auth/token-resolver.ts` file

---

### Example 2: Static with Credentials (Brave Search)

**Context**: Creating a Brave Search MCP server with shared API key

**User Inputs**:
- Project name: `brave-search-mcp-server`
- Description: `Brave Search API MCP server`
- Server type: `2` (Static with Credentials)
- Auth provider: `1` (JWT)
- Platform URL: `https://my-platform.com`
- CORS origin: `https://my-platform.com`

**Result**:
- Project created with static_with_credentials configuration
- Fetches shared credentials from platform integration provider
- JWT auth provider configured
- Server validates JWT and uses shared Brave API key
- Ready for adding search tools

**Key Files**:
- `src/index.ts`: Fetches credentials once at startup
- `src/auth/provider.ts`: JWT validation
- `src/config/credentials.ts`: Credential fetching logic

---

### Example 3: Dynamic Server (GitHub)

**Context**: Creating a GitHub MCP server with per-user tokens

**User Inputs**:
- Project name: `github-mcp-server`
- Description: `GitHub API MCP server with per-user auth`
- Server type: `3` (Dynamic)
- Auth provider: `1` (JWT)
- Platform URL: `https://my-platform.com`
- CORS origin: `https://my-platform.com`

**Result**:
- Project created with dynamic server configuration
- tokenResolver fetches per-user GitHub tokens
- JWT auth provider configured
- Server validates JWT and fetches user-specific credentials
- Ready for adding GitHub tools

**Key Files**:
- `src/index.ts`: Uses `wrapServer` with `tokenResolver`
- `src/auth/provider.ts`: JWT validation
- `src/auth/token-resolver.ts`: Per-user credential fetching

---

## Related Commands

- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate project after initialization
- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy to Cloud Run
- [`@mcp-auth-server-base.setup-secrets`](mcp-auth-server-base.setup-secrets.md) - Set up Cloud secrets
- [`@mcp-auth-server-base.generate-dockerfile`](mcp-auth-server-base.generate-dockerfile.md) - Regenerate Dockerfile
- [`@mcp-auth-server-base.add-auth-provider`](mcp-auth-server-base.add-auth-provider.md) - Add additional auth provider

---

## Troubleshooting

### Issue 1: Node.js version too old

**Symptom**: Error "Node.js version 20+ required"

**Cause**: Node.js version is below 20

**Solution**:
```bash
# Install Node.js 20+ using nvm
nvm install 20
nvm use 20

# Or download from nodejs.org
```

---

### Issue 2: npm install fails

**Symptom**: Error during `npm install`

**Cause**: Network issues, registry problems, or dependency conflicts

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install

# If still fails, try with legacy peer deps
npm install --legacy-peer-deps
```

---

### Issue 3: TypeScript compilation errors

**Symptom**: `npm run type-check` shows errors

**Cause**: TypeScript configuration issues or missing type definitions

**Solution**:
```bash
# Install missing type definitions
npm install --save-dev @types/node @types/jsonwebtoken

# Check tsconfig.json is correct
cat tsconfig.json

# Try building
npm run build
```

---

### Issue 4: Git not initialized

**Symptom**: Warning "Git not available"

**Cause**: Git is not installed

**Solution**:
```bash
# Install git (Ubuntu/Debian)
sudo apt-get install git

# Install git (macOS)
brew install git

# Install git (Windows)
# Download from git-scm.com
```

---

### Issue 5: Invalid project name

**Symptom**: Error "Invalid project name"

**Cause**: Project name contains uppercase, spaces, or special characters

**Solution**: Use only lowercase letters, numbers, and hyphens
- ✅ Good: `my-mcp-server`, `github-server`, `calculator-v2`
- ❌ Bad: `My MCP Server`, `github_server`, `Calculator!`

---

### Issue 6: Port already in use

**Symptom**: Error "Port 8080 already in use"

**Cause**: Another process is using port 8080

**Solution**:
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or change port in .env
echo "PORT=8081" >> .env
```

---

### Issue 7: Directory already exists

**Symptom**: Error "Directory already exists"

**Cause**: Target directory is not empty

**Solution**:
```bash
# Remove existing directory
rm -rf my-mcp-server

# Or choose a different name
```

---

## Security Considerations

### File Access

**Reads**: None (this is a creation command)

**Writes**:
- Creates entire project directory structure
- Writes all configuration files
- Writes source code files
- Creates `.env` file (with example values only)
- Initializes git repository

**Executes**:
- `npm install` - Installs dependencies from npm registry
- `git init` - Initializes git repository (if git available)

### Network Access

**APIs**:
- npm registry (registry.npmjs.org) - Downloads packages during `npm install`

**Repositories**: None

### Sensitive Data

**Secrets**:
- ❌ Does NOT write real secrets to any files
- ✅ Creates `.env.example` with placeholder values only
- ✅ Creates `.env` from `.env.example` (user must fill in real values)
- ✅ `.env` is gitignored to prevent accidental commits

**Credentials**:
- No real credentials are accessed or written
- User must manually configure `.env` after initialization

**Best Practices**:
- All secret files are gitignored
- Example files use placeholder values
- README.md includes security warnings
- Scripts reference secrets management pattern

---

## Notes

- This command creates a complete, production-ready project structure
- All generated code follows TypeScript best practices
- Docker files use multi-stage builds for optimization
- Cloud Build configuration includes secrets management
- Generated code includes comprehensive comments
- Project structure follows established patterns from reference implementations
- All files are customized based on user selections (server type, auth provider)
- The command is idempotent - can be run multiple times safely (will fail if directory exists)
- Generated project includes health check endpoint at `/mcp/health`
- All patterns are referenced in generated README.md
- Utility scripts are included for common tasks (secrets upload, auth testing)
- Default target directory is `.` (current directory) if not specified

---

**Namespace**: mcp-auth-server-base
**Command**: init
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.7.0+
**Author**: mcp-auth-server-base Package