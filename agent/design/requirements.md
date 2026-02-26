# mcp-auth-server-base Package - Requirements

**Concept**: ACP package for bootstrapping MCP servers wrapped with @prmichaelsen/mcp-auth
**Created**: 2026-02-21
**Status**: Design Specification
**Version**: 1.0.0

---

## Overview

The **mcp-auth-server-base** package provides patterns, commands, templates, and configuration files to bootstrap MCP servers that use [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth) for authentication and multi-tenancy. This package is designed to be generic and reusable across different MCP server implementations, supporting multiple authentication schemes and deployment patterns.

## Problem Statement

Developers building MCP servers with mcp-auth face several challenges:

1. **Boilerplate Setup**: Repetitive configuration of build tools, TypeScript, Docker, and deployment
2. **Authentication Patterns**: Understanding the different auth provider schemes and when to use each
3. **Server Types**: Choosing between static, static_with_credentials, and dynamic server patterns
4. **Deployment Complexity**: Setting up Cloud Build, Cloud Run, and secrets management
5. **Best Practices**: Following established patterns from reference implementations
6. **Testing**: Configuring Jest with proper test patterns for MCP servers

## Solution

This ACP package provides:

- **Guided Initialization**: Interactive `@mcp-auth-server-base.init` command that walks users through setup
- **Complete Templates**: Working configuration files (tsconfig.json, Dockerfile, cloudbuild.yaml, jest.config.js)
- **Source Templates**: Base TypeScript files with placeholders for user customization
- **Patterns**: Documented patterns for all common scenarios
- **Commands**: Automation for deployment, secrets management, and maintenance
- **Reference Integration**: Patterns extracted from production implementations

---

## Core Requirements

### 1. Package Structure

**Type**: ACP Package

**Installation Methods**:
- **Bootstrap**: `curl -fsSL https://github.com/prmichaelsen/acp-mcp-auth-server-base/raw/main/scripts/bootstrap.sh | bash`
  - Installs ACP if not present
  - Installs this package
  - Runs initialization
- **Existing Project**: `@acp.package-install https://github.com/prmichaelsen/acp-mcp-auth-server-base`

**Package Contents** (`package.yaml` `include` section):
- Configuration files: `tsconfig.json`, `jest.config.js`, `.dockerignore`, `.env.example`
- Docker files: `Dockerfile.development`, `Dockerfile.production`
- Cloud Build: `cloudbuild.yaml` (with placeholders)
- Source templates: `src/index.ts.template`, `src/auth/provider.ts.template`
- Scripts: `scripts/upload-secrets.ts`, `scripts/test-auth.ts`
- Patterns: All pattern files in `agent/patterns/`
- Commands: All command files in `agent/commands/`
- Designs: All design files in `agent/designs/`

**Target Users**:
- Developers who will extend the base code provided
- Users familiar with TypeScript and Node.js
- Users deploying to Google Cloud Platform (Cloud Run)

---

### 2. Server Types

The package supports three server patterns:

#### 2.1 Static Server
- **Description**: No token resolver, only JWT validation (or other auth provider)
- **Use Case**: Server doesn't need per-user credentials
- **Example**: Public data server, read-only server
- **Credentials**: None required

#### 2.2 Static with Credentials
- **Description**: Server requires credentials, but same credentials for all users
- **Use Case**: Server needs API keys that are shared across all users
- **Example**: Brave Search API (BRAVE_API_KEY shared by all users)
- **Credentials**: Static credentials from platform's integration provider endpoint

#### 2.3 Dynamic Server
- **Description**: Server requires per-user access tokens
- **Use Case**: Server accesses user-specific resources
- **Example**: GitHub MCP server (each user's GitHub token), Firebase MCP server
- **Credentials**: Dynamic `access_token` per user via tokenResolver

---

### 3. Authentication Providers

**Supported Providers** (from @prmichaelsen/mcp-auth):
- JWT Provider (most common)
- OAuth Provider
- API Key Provider
- Environment Variable Provider

**Package Approach**:
- Document all providers generically
- Provide patterns for each
- Let `@mcp-auth-server-base.init` guide selection
- Reference official mcp-auth documentation for details

**Platform Integration**:
- Generic patterns applicable to any multi-tenant platform
- No agentbase.me-specific code (though patterns informed by it)
- Support for both `direct-oauth` and `mcp-auth` schemes
- Patterns for credential fetching from external platforms

---

### 4. Build System

**Standard**: esbuild (no alternatives supported)

**Configuration**:
- `bundle: false` - Preserve module structure (following mcp-auth pattern)
- ES modules (`"type": "module"` in package.json)
- Export pattern defined in package.json
- Two scripts: `esbuild.build.js`, `esbuild.watch.js`

**TypeScript**:
- `moduleResolution: "bundler"`
- Module name mappers (path aliases)
- Target: ES2022
- Strict mode enabled
- Declaration files generated

**Package Scripts**:
```json
{
  "build": "node esbuild.build.js",
  "watch": "node esbuild.watch.js",
  "dev": "tsx watch src/index.ts",
  "start": "node dist/index.js",
  "test": "jest",
  "type-check": "tsc --noEmit"
}
```

---

### 5. Testing Infrastructure

**Framework**: Jest (no alternatives)

**Configuration**:
- Colocated tests (`.spec.ts` suffix)
- Full test coverage for testable files
- Some files with placeholders may not be testable until after init

**Test Types**:
- Unit tests for auth providers
- Integration tests for server wrapping
- Mock tests for external dependencies

**jest.config.js** (included in package):
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts']
};
```

---

### 6. Deployment Configuration

#### 6.1 Docker

**Files Included**:
- `Dockerfile.development` - Development build
- `Dockerfile.production` - Multi-stage production build
- `.dockerignore` - Exclude unnecessary files

**Standard Pattern**: Multi-stage builds
- Stage 1: Builder (install all deps, compile TypeScript)
- Stage 2: Production (production deps only, copy dist/)

**Base Image**: `node:20-alpine`

**Health Check**: 
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/mcp/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

#### 6.2 Cloud Build

**File**: `cloudbuild.yaml` (with placeholders)

**Steps**:
1. Build Docker image
2. Push to Container Registry (with SHA and latest tags)
3. Deploy to Cloud Run

**Cloud Run Configuration**:
- Platform: managed
- Region: us-central1
- Allow unauthenticated: true
- Min instances: 0
- Max instances: 10
- Memory: 512Mi
- CPU: 1
- Timeout: 60s

**Secrets Management**:
- Use Google Cloud Secret Manager
- Prefix secrets with service name (e.g., `myservice-platform-token`)
- Update secrets via `--update-secrets` flag
- Pattern provided for managing secrets

#### 6.3 CI/CD

**Supported**: Google Cloud Build only

**Not Supported**: GitHub Actions, GitLab CI (users can add if needed)

---

### 7. Project Structure

**Directory Layout** (informed by reference projects):
```
project-root/
├── src/
│   ├── index.ts              # Main entry point
│   ├── auth/
│   │   └── provider.ts       # Auth provider implementation
│   ├── config/
│   │   └── environment.ts    # Environment configuration
│   └── types/
│       └── index.ts          # Type definitions
├── scripts/
│   ├── upload-secrets.ts     # Upload secrets to GCP
│   └── test-auth.ts          # Generate and validate test tokens
├── dist/                     # Build output (gitignored)
├── node_modules/             # Dependencies (gitignored)
├── .env.example              # Example environment variables
├── .env                      # Local env (gitignored)
├── .env.development          # Dev env (gitignored)
├── .env.*.local              # Local overrides (gitignored)
├── .dockerignore
├── Dockerfile.development
├── Dockerfile.production
├── cloudbuild.yaml
├── tsconfig.json
├── jest.config.js
├── esbuild.build.js
├── esbuild.watch.js
├── package.json
├── package-lock.json
└── README.md
```

**Organization**: Type-based (auth/, config/, types/) not feature-based

---

### 8. Configuration Management

**Environment Variables**:
- `.env` - Base configuration (gitignored)
- `.env.development` - Development overrides (gitignored)
- `.env.*.local` - Local overrides (gitignored)
- `.env.example` - Template (committed)

**Security**:
- ❌ **NO** `.env.production` - Security anti-pattern
- Production credentials only in Cloud Secret Manager
- Never commit credentials to git

**Validation**: None (considered bloat)

**Example `.env.example`**:
```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# Platform Integration
PLATFORM_URL=https://your-platform.com
PLATFORM_SERVICE_TOKEN=your-service-token

# CORS
CORS_ORIGIN=https://your-platform.com

# MCP Server Specific
# Add your server-specific environment variables here
```

---

### 9. Dependencies

#### 9.1 Core Dependencies

**Required**:
- `@prmichaelsen/mcp-auth`: Specific version (pinned per package version)
- `@modelcontextprotocol/sdk`: `^1.0.0` (constrain major version)
- `typescript`: Latest
- `esbuild`: `^0.24.0` (constrain major version)

**Optional** (based on auth provider choice):
- `jsonwebtoken`: For JWT provider
- `express`: For SSE transport
- `cors`: For CORS support

#### 9.2 Dev Dependencies

- `tsx`: For running TypeScript scripts
- `jest`: For testing
- `ts-jest`: Jest TypeScript support
- `@types/node`: Node.js type definitions
- `@types/jsonwebtoken`: JWT type definitions (if using JWT)

---

### 10. Commands

The package provides the following commands:

#### 10.1 Core Commands

**`@mcp-auth-server-base.init`**
- **Purpose**: Guided workflow to initialize MCP auth server
- **Interactive**: Yes (prompts for choices)
- **Actions**:
  - Select server type (static, static_with_credentials, dynamic)
  - Select auth provider (JWT, OAuth, API Key, Env)
  - Generate configuration files
  - Install dependencies
  - Create source files from templates
  - Initialize git repository
  - Set up project structure

**`@mcp-auth-server-base.validate`**
- **Purpose**: Validate project configuration
- **Checks**:
  - All required files present
  - Dependencies installed
  - Configuration valid
  - TypeScript compiles
  - Tests pass

#### 10.2 Deployment Commands

**`@mcp-auth-server-base.deploy`**
- **Purpose**: Deploy to Cloud Run
- **Actions**:
  - Build Docker image
  - Push to Container Registry
  - Deploy to Cloud Run
  - Verify deployment

**`@mcp-auth-server-base.setup-secrets`**
- **Purpose**: Help set up Cloud secrets
- **Interactive**: Yes
- **Actions**:
  - List required secrets
  - Guide user through creating secrets
  - Optionally run upload-secrets.ts script

**`@mcp-auth-server-base.logs`**
- **Purpose**: Fetch Cloud Run logs (read-only)
- **Actions**:
  - Fetch recent logs from Cloud Run
  - Filter by severity
  - Display last N entries
  - Note: Streaming is a gcloud beta feature, not supported in stable

#### 10.3 Generation Commands

**`@mcp-auth-server-base.generate-dockerfile`**
- **Purpose**: Generate Dockerfile from template
- **Options**: development, production, both

**`@mcp-auth-server-base.generate-cloudbuild`**
- **Purpose**: Generate cloudbuild.yaml from template
- **Prompts**: Service name, region, secrets

**`@mcp-auth-server-base.add-auth-provider`**
- **Purpose**: Add additional auth provider
- **Actions**:
  - Generate provider file
  - Update dependencies
  - Update configuration

#### 10.4 Maintenance Commands

**`@mcp-auth-server-base.mcp-auth-version-check`**
- **Purpose**: Check for mcp-auth updates
- **Actions**:
  - Compare current version with latest
  - Show changelog
  - Check for breaking changes

**`@mcp-auth-server-base.mcp-auth-version-update`**
- **Purpose**: Update mcp-auth version
- **Actions**:
  - Update package.json
  - Run npm install
  - Show migration guide if breaking changes
  - Update code if needed

#### 10.5 Development Commands

**`@mcp-auth-server-base.tool-create`** (potential)
- **Purpose**: Generate MCP tool boilerplate
- **Actions**:
  - Create tool handler
  - Add to server
  - Generate tests

---

### 11. Patterns

The package includes the following patterns:

#### 11.1 Core Patterns

**Server Wrapping Pattern**
- How to use `wrapServer` from mcp-auth
- Configuration options
- Transport setup (SSE, stdio)
- Middleware configuration

**Auth Provider Pattern**
- Implementing custom auth providers
- JWT provider setup
- OAuth flow
- API key validation
- Environment variable provider

**Token Resolver Pattern**
- When to use token resolver
- Implementing tokenResolver function
- Fetching credentials from platform
- Caching strategies

**Static Server Pattern**
- No tokenResolver implementation
- Auth-only validation
- Use cases and examples

#### 11.2 Operational Patterns

**Multi-Tenant Data Isolation**
- Per-user data separation
- Using userId from auth
- Storage patterns
- Security considerations

**Error Handling Pattern**
- Error types
- Error responses
- Logging errors
- User-friendly messages

**Logging Pattern**
- Structured logging
- Log levels
- Request/response logging
- Performance logging

**Health Check Pattern**
- Health check endpoint (`/mcp/health`)
- Readiness checks
- Liveness checks
- Monitoring integration

#### 11.3 Configuration Patterns

**CORS Configuration**
- Setting CORS origin
- Handling multiple origins
- Preflight requests
- Security considerations

**Environment Configuration**
- Environment variable patterns
- Configuration validation
- Defaults and overrides
- Secret management

#### 11.4 Testing Patterns

**Testing Pattern**
- Unit testing auth providers
- Mocking external dependencies
- Integration testing servers
- Test coverage strategies

#### 11.5 Deployment Patterns

**Deployment Pattern**
- Docker best practices
- Multi-stage builds
- Cloud Run configuration
- Secrets management
- CI/CD workflow

---

### 12. Design Documents

The package includes design documents for:

**Overall Architecture**
- System components
- Data flow
- Integration points
- Scalability considerations

**Security Considerations**
- Authentication security
- Secret management
- CORS policies
- Input validation
- Rate limiting (future)

**Performance Optimization** (if patterns identified)
- Caching strategies
- Connection pooling
- Response optimization

---

### 13. Scripts

**TypeScript Scripts** (included in package):

**`scripts/upload-secrets.ts`**
- Upload secrets to Google Cloud Secret Manager
- Reads from .env file
- Creates or updates secrets
- Follows naming convention (service-name-secret-name)

**`scripts/test-auth.ts`**
- Generate test JWT tokens
- Validate tokens locally
- Test auth provider
- Debug authentication issues

---

### 14. Reference Projects

**Extraction Sources** (for patterns, not direct references):
- [@prmichaelsen/mcp-auth](https://github.com/prmichaelsen/mcp-auth) - Core library
- [@prmichaelsen/remember-mcp-server](https://github.com/prmichaelsen/remember-mcp-server) - Static server example
- [@prmichaelsen/task-mcp-server](https://github.com/prmichaelsen/task-mcp-server) - Dynamic server example

**Usage in Package**:
- Extract common patterns
- Reference GitHub homepages only (not specific files/docs)
- Keep patterns generic and reusable
- No dependencies on reference projects

---

## Non-Functional Requirements

### Performance
- Server startup < 5 seconds
- Auth validation < 100ms (cached)
- Health check response < 50ms

### Reliability
- Graceful shutdown on SIGTERM/SIGINT
- Error recovery
- Health checks for monitoring

### Security
- No credentials in source code
- Secrets in Secret Manager only
- HTTPS in production
- CORS properly configured
- Input validation

### Scalability
- Stateless server design
- Horizontal scaling via Cloud Run
- Auto-scaling 0-10 instances

---

## Success Criteria

- [ ] Package installs successfully via bootstrap.sh
- [ ] Package installs into existing ACP projects
- [ ] `@mcp-auth-server-base.init` creates working project
- [ ] Generated project compiles without errors
- [ ] Tests run and pass
- [ ] Docker builds successfully
- [ ] Deploys to Cloud Run successfully
- [ ] Health check endpoint responds
- [ ] Authentication works correctly
- [ ] All commands function as expected
- [ ] Documentation is clear and complete

---

## Out of Scope

- ❌ Support for non-esbuild build tools
- ❌ Support for non-Jest test frameworks
- ❌ Support for non-GCP deployment platforms
- ❌ Rate limiting implementation (future enhancement)
- ❌ Web UI for configuration
- ❌ Automatic migration of existing projects
- ❌ Support for non-TypeScript languages
- ❌ Scalability patterns (not yet designed)

---

## Dependencies

**External**:
- Google Cloud Platform account (for deployment)
- Node.js 20+
- npm or compatible package manager

**NPM Packages**: See section 9

**Reference Projects**: See section 14

---

## Constraints

1. **Build System**: esbuild only
2. **Test Framework**: Jest only
3. **Deployment**: GCP Cloud Run only
4. **Language**: TypeScript only
5. **Module System**: ES modules only
6. **Node Version**: 20+

---

## Future Enhancements

- Rate limiting pattern and implementation
- Scalability patterns
- Additional deployment platforms
- Migration tools for existing projects
- More auth provider examples
- Performance monitoring integration
- Automated testing in CI/CD

---

**Status**: Design Specification
**Next Action**: Create milestones and begin implementation
**Related Documents**:
- [Clarifications](../clarifications/clarification-1-package-scope-and-content.md)
- [Requirements Draft](requirements.draft.md)
