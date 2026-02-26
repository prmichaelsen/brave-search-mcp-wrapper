# Command: generate-dockerfile

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.generate-dockerfile` has been invoked. Follow the steps below to execute this command.

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Generate or regenerate Dockerfile configurations for development and production environments
**Category**: Generation
**Frequency**: As Needed

---

## What This Command Does

This command generates Docker configuration files for building and running your MCP auth server:

1. **Dockerfile.development** - Single-stage build for local development with hot reload
2. **Dockerfile.production** - Multi-stage build optimized for production deployment
3. **.dockerignore** - Exclusion rules for Docker builds

**Use this when**:
- Setting up a new project (usually via `@mcp-auth-server-base.init`)
- Regenerating files after accidental deletion
- Updating Docker configuration to newer patterns
- Customizing Docker builds for specific requirements

---

## Prerequisites

- [ ] Project initialized (package.json exists)
- [ ] Source code in `src/` directory
- [ ] Build scripts configured (esbuild)
- [ ] Docker installed (for testing generated files)

---

## Steps

### 1. Verify Project Structure

Check that the project has the necessary structure for Docker builds.

**Actions**:
```bash
# Check for required files
ls -la package.json src/index.ts

# Check for build scripts
grep -E '"build"|"dev"|"start"' package.json
```

**Expected Outcome**: Project structure verified

**Troubleshooting**:
- If package.json missing: Run `@mcp-auth-server-base.init` first
- If src/index.ts missing: Create source files before generating Dockerfiles
- If build scripts missing: Add to package.json or run init command

### 2. Select Generation Target

Determine which Dockerfile(s) to generate.

**Actions**:
Ask user to select:
1. **Development only** - Generate Dockerfile.development
2. **Production only** - Generate Dockerfile.production
3. **Both** - Generate both Dockerfiles
4. **All (including .dockerignore)** - Generate all Docker files

**Expected Outcome**: Target selected

**Default**: Generate all files (option 4)

### 3. Check for Existing Files

Check if files already exist and confirm overwrite.

**Actions**:
```bash
# Check for existing files
ls -la Dockerfile.development Dockerfile.production .dockerignore 2>/dev/null || true
```

**If files exist**:
- Display warning: "⚠️  Files already exist. Overwriting will replace current configuration."
- List existing files
- Ask for confirmation: "Continue and overwrite? (y/n)"
- If no: Exit gracefully
- If yes: Proceed with generation

**Expected Outcome**: Overwrite confirmed or generation cancelled

### 4. Generate Dockerfile.development

Create the development Dockerfile with hot reload support.

**Actions**:
Create `Dockerfile.development` with this content:

```dockerfile
# Dockerfile.development
# Development build for local testing with hot reload

FROM node:20-alpine

# Set environment
ENV NODE_ENV=development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Start with hot reload
CMD ["npm", "run", "dev"]
```

**Expected Outcome**: Dockerfile.development created

**Verification**:
```bash
# Verify file created
ls -la Dockerfile.development

# Validate syntax (basic check)
docker build -f Dockerfile.development --help > /dev/null 2>&1 && echo "✓ Docker available"
```

### 5. Generate Dockerfile.production

Create the production Dockerfile with multi-stage build.

**Actions**:
Create `Dockerfile.production` with this content:

```dockerfile
# Dockerfile.production
# Multi-stage production build optimized for size and security

# ============================================
# Builder Stage
# ============================================
FROM node:20-alpine AS builder

# Install security updates
RUN apk update && apk upgrade

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine

# Install security updates and dumb-init
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

# Set environment
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env var)
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s \
            --timeout=3s \
            --start-period=5s \
            --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

**Expected Outcome**: Dockerfile.production created

**Verification**:
```bash
# Verify file created
ls -la Dockerfile.production

# Check file size (should be ~2KB)
wc -l Dockerfile.production
```

### 6. Generate .dockerignore

Create the .dockerignore file to exclude unnecessary files from Docker builds.

**Actions**:
Create `.dockerignore` with this content:

```
# .dockerignore
# Exclude unnecessary files from Docker builds

# Node modules (will be installed in container)
node_modules
npm-debug.log
yarn-error.log

# Build output (will be built in container)
dist
build
*.tsbuildinfo

# Environment files (NEVER include in image)
.env
.env.*
!.env.example

# Git
.git
.gitignore
.gitattributes

# IDE and editor files
.vscode
.idea
*.swp
*.swo
*~
.DS_Store

# Tests (not needed in production)
**/*.spec.ts
**/*.test.ts
coverage
.nyc_output

# Documentation (except README)
*.md
!README.md

# CI/CD
.github
.gitlab-ci.yml
cloudbuild.yaml

# Logs
logs
*.log

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Temporary files
tmp
temp
*.tmp

# Agent directory (ACP files not needed in container)
agent/
AGENT.md

# Scripts (not needed in production container)
scripts/
```

**Expected Outcome**: .dockerignore created

**Verification**:
```bash
# Verify file created
ls -la .dockerignore

# Check file size
wc -l .dockerignore
```

### 7. Display Generation Summary

Show what was generated and next steps.

**Actions**:
Display summary:

```
✅ Docker Configuration Generated

Files Created:
  ✓ Dockerfile.development (single-stage, hot reload)
  ✓ Dockerfile.production (multi-stage, optimized)
  ✓ .dockerignore (build exclusions)

Configuration:
  • Base Image: node:20-alpine
  • Build Tool: esbuild (via npm run build)
  • Port: 8080
  • User: nodejs (non-root)
  • Health Check: /health endpoint

Next Steps:
  1. Test development build:
     docker build -f Dockerfile.development -t my-mcp-server:dev .
     docker run -p 8080:8080 --env-file .env my-mcp-server:dev

  2. Test production build:
     docker build -f Dockerfile.production -t my-mcp-server:prod .
     docker run -p 8080:8080 --env-file .env my-mcp-server:prod

  3. Deploy to Cloud Run:
     @mcp-auth-server-base.deploy

Related Commands:
  • @mcp-auth-server-base.deploy - Deploy to Cloud Run
  • @mcp-auth-server-base.validate - Validate Docker configuration

Related Patterns:
  • agent/patterns/mcp-auth-server-base.docker-multistage.md
  • agent/patterns/mcp-auth-server-base.cloud-run-deployment.md
```

**Expected Outcome**: Summary displayed

---

## Customization Options

### Option 1: Custom Node.js Version

**Default**: node:20-alpine

**To customize**:
1. Edit both Dockerfiles
2. Change `FROM node:20-alpine` to desired version
3. Example: `FROM node:22-alpine` or `FROM node:20-slim`

**Considerations**:
- Alpine images are smaller (~100MB vs ~900MB for full images)
- Ensure Node.js version matches your package.json engines field
- Test thoroughly after changing versions

### Option 2: Custom Port

**Default**: 8080

**To customize**:
1. Edit both Dockerfiles
2. Change `EXPOSE 8080` to desired port
3. Update health check URL if needed
4. Update Cloud Run configuration in deploy command

**Note**: Cloud Run always uses PORT environment variable, so EXPOSE is mainly documentation

### Option 3: Custom Health Check Endpoint

**Default**: `/health`

**To customize**:
1. Edit Dockerfile.production health check
2. Change URL in HEALTHCHECK command
3. Ensure your server implements the custom endpoint

**Example**:
```dockerfile
HEALTHCHECK CMD node -e "fetch('http://localhost:8080/mcp/health')..."
```

### Option 4: Additional Build Steps

**To add custom build steps**:
1. Edit Dockerfile.production builder stage
2. Add RUN commands after `npm run build`
3. Example: Code generation, asset compilation, etc.

**Example**:
```dockerfile
# In builder stage
RUN npm run build
RUN npm run generate-types
RUN npm run optimize-assets
```

### Option 5: Additional Runtime Dependencies

**To add system dependencies**:
1. Edit Dockerfile.production production stage
2. Add to apk install command

**Example**:
```dockerfile
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl ca-certificates
```

### Option 6: Build Arguments

**To add build-time variables**:
1. Add ARG statements at top of Dockerfile
2. Use in build commands

**Example**:
```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

ARG BUILD_DATE
ARG VERSION
LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$VERSION
```

**Build with arguments**:
```bash
docker build \
  --build-arg NODE_VERSION=22 \
  --build-arg VERSION=1.0.0 \
  -f Dockerfile.production \
  -t my-mcp-server:1.0.0 \
  .
```

---

## Examples

### Example 1: Generate All Files (First Time)

**Scenario**: New project, no Docker files exist

**Invocation**: `@mcp-auth-server-base.generate-dockerfile`

**Workflow**:
```
Agent: "Which Docker files would you like to generate?"
  1. Development only
  2. Production only
  3. Both Dockerfiles
  4. All (including .dockerignore)

User: "4"

Agent: "No existing files found. Generating all Docker files..."

✅ Generated Dockerfile.development (23 lines)
✅ Generated Dockerfile.production (67 lines)
✅ Generated .dockerignore (45 lines)

Next: Test builds with docker build commands
```

### Example 2: Regenerate Production Only

**Scenario**: Production Dockerfile corrupted, need to regenerate

**Invocation**: `@mcp-auth-server-base.generate-dockerfile`

**Workflow**:
```
Agent: "Which Docker files would you like to generate?"
  1. Development only
  2. Production only
  3. Both Dockerfiles
  4. All (including .dockerignore)

User: "2"

Agent: "⚠️  Dockerfile.production already exists. Overwrite? (y/n)"

User: "y"

Agent: "Regenerating Dockerfile.production..."

✅ Generated Dockerfile.production (67 lines)

Next: Test production build
```

### Example 3: Custom Node.js Version

**Scenario**: Need to use Node.js 22 instead of 20

**Invocation**: `@mcp-auth-server-base.generate-dockerfile`

**Workflow**:
```
Agent: "Which Docker files would you like to generate?"
User: "3" (both)

Agent: "Would you like to customize the Node.js version? (default: 20)"
User: "22"

Agent: "Generating Dockerfiles with Node.js 22..."

✅ Generated Dockerfile.development (FROM node:22-alpine)
✅ Generated Dockerfile.production (FROM node:22-alpine)

Next: Update package.json engines field to match
```

### Example 4: Add Custom Build Steps

**Scenario**: Need to add code generation step to build

**Invocation**: `@mcp-auth-server-base.generate-dockerfile` then manual edit

**Workflow**:
```
Agent: "Generating Dockerfiles..."

✅ Generated Dockerfile.production

Agent: "To add custom build steps, edit Dockerfile.production builder stage:

# After npm run build, add:
RUN npm run generate-types
RUN npm run custom-build-step

Then rebuild the image."
```

---

## Verification

After generating files, verify they work correctly:

### 1. Verify Files Created

```bash
# Check files exist
ls -la Dockerfile.development Dockerfile.production .dockerignore

# Check file sizes (approximate)
# Dockerfile.development: ~20-30 lines
# Dockerfile.production: ~60-70 lines
# .dockerignore: ~40-50 lines
```

### 2. Test Development Build

```bash
# Build development image
docker build -f Dockerfile.development -t my-mcp-server:dev .

# Should complete without errors
# Check image size (should be ~300-500MB with all deps)
docker images my-mcp-server:dev
```

### 3. Test Production Build

```bash
# Build production image
docker build -f Dockerfile.production -t my-mcp-server:prod .

# Should complete without errors
# Check image size (should be ~100-150MB)
docker images my-mcp-server:prod
```

### 4. Test Container Startup

```bash
# Run development container
docker run -p 8080:8080 --env-file .env my-mcp-server:dev

# In another terminal, test health endpoint
curl http://localhost:8080/health

# Should return 200 OK
```

### 5. Verify .dockerignore

```bash
# Build and check what files are included
docker build -f Dockerfile.production -t test-ignore .

# Inspect image
docker run --rm test-ignore ls -la /app

# Should NOT see:
# - node_modules (from host)
# - .env files
# - .git directory
# - test files
```

---

## Checklist

- [ ] Project structure verified
- [ ] Generation target selected
- [ ] Existing files checked
- [ ] Dockerfile.development generated (if selected)
- [ ] Dockerfile.production generated (if selected)
- [ ] .dockerignore generated (if selected)
- [ ] Files verified to exist
- [ ] Development build tested
- [ ] Production build tested
- [ ] Container startup tested
- [ ] .dockerignore exclusions verified

---

## Expected Output

### Console Output

```
🐳 Generating Docker Configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Verifying Project Structure

✓ package.json found
✓ src/index.ts found
✓ Build scripts configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2: Selecting Generation Target

Which Docker files would you like to generate?
  1. Development only
  2. Production only
  3. Both Dockerfiles
  4. All (including .dockerignore)

Selection: 4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3: Checking for Existing Files

⚠️  Existing files found:
  • Dockerfile.production (modified 2 days ago)

Overwrite existing files? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 4-6: Generating Files

✓ Generated Dockerfile.development (23 lines)
✓ Generated Dockerfile.production (67 lines)
✓ Generated .dockerignore (45 lines)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Docker Configuration Complete

Files Created:
  ✓ Dockerfile.development - Single-stage build with hot reload
  ✓ Dockerfile.production - Multi-stage build, optimized for production
  ✓ .dockerignore - Build exclusions

Configuration:
  • Base Image: node:20-alpine
  • Build Tool: esbuild (npm run build)
  • Port: 8080
  • User: nodejs (non-root)
  • Health Check: /health endpoint

Next Steps:

1. Test Development Build:
   docker build -f Dockerfile.development -t my-mcp-server:dev .
   docker run -p 8080:8080 --env-file .env my-mcp-server:dev

2. Test Production Build:
   docker build -f Dockerfile.production -t my-mcp-server:prod .
   docker run -p 8080:8080 --env-file .env my-mcp-server:prod

3. Deploy to Cloud Run:
   @mcp-auth-server-base.deploy

Related Commands:
  • @mcp-auth-server-base.deploy - Deploy to Cloud Run
  • @mcp-auth-server-base.validate - Validate configuration

Related Patterns:
  • agent/patterns/mcp-auth-server-base.docker-multistage.md
  • agent/patterns/mcp-auth-server-base.health-check.md
  • agent/patterns/mcp-auth-server-base.cloud-run-deployment.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Troubleshooting

### Issue 1: Docker not installed

**Symptom**: Error "docker: command not found"

**Cause**: Docker not installed on system

**Solution**:
```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker (macOS)
brew install --cask docker

# Verify installation
docker --version
```

### Issue 2: Build fails with "npm ci" error

**Symptom**: Docker build fails at npm ci step

**Cause**: package-lock.json missing or out of sync

**Solution**:
```bash
# Regenerate package-lock.json
rm package-lock.json
npm install

# Try build again
docker build -f Dockerfile.production -t my-mcp-server:prod .
```

### Issue 3: Build fails with "npm run build" error

**Symptom**: Docker build fails at build step

**Cause**: Build script not configured or TypeScript errors

**Solution**:
```bash
# Test build locally first
npm run build

# Fix any TypeScript errors
npm run type-check

# Try Docker build again
docker build -f Dockerfile.production -t my-mcp-server:prod .
```

### Issue 4: Health check fails

**Symptom**: Container unhealthy, health check failing

**Cause**: Health endpoint not implemented or wrong URL

**Solution**:
```bash
# Check if health endpoint exists in your server
curl http://localhost:8080/health

# If not, implement health endpoint in src/index.ts
# Or update HEALTHCHECK command in Dockerfile.production to use correct URL

# Example: Change to /mcp/health
HEALTHCHECK CMD node -e "fetch('http://localhost:8080/mcp/health')..."
```

### Issue 5: Permission denied errors

**Symptom**: Container fails with EACCES or permission errors

**Cause**: Files owned by root, but running as nodejs user

**Solution**:
```dockerfile
# Ensure ownership is set correctly in Dockerfile.production
RUN chown -R nodejs:nodejs /app

# Before switching to non-root user
USER nodejs
```

### Issue 6: Image size too large

**Symptom**: Production image > 200MB

**Cause**: Dev dependencies included or inefficient layer caching

**Solution**:
```bash
# Check what's in the image
docker run --rm my-mcp-server:prod du -sh /app/*

# Ensure using multi-stage build
# Ensure using --only=production flag
# Ensure npm cache is cleaned

# Verify .dockerignore excludes node_modules
grep "node_modules" .dockerignore
```

### Issue 7: Build is slow

**Symptom**: Docker build takes > 5 minutes

**Cause**: Poor layer caching or rebuilding unchanged layers

**Solution**:
```bash
# Use BuildKit for better caching
DOCKER_BUILDKIT=1 docker build -f Dockerfile.production -t my-mcp-server:prod .

# Ensure package.json copied before source code (for layer caching)
# Check Dockerfile order:
# 1. COPY package*.json
# 2. RUN npm ci
# 3. COPY . .
# 4. RUN npm run build
```

### Issue 8: Container exits immediately

**Symptom**: Container starts then exits with code 0 or 1

**Cause**: Application crashes on startup or missing environment variables

**Solution**:
```bash
# Check container logs
docker logs <container-id>

# Run with interactive terminal to see errors
docker run -it --env-file .env my-mcp-server:prod

# Check for missing environment variables
# Ensure .env file has all required variables from .env.example
```

---

## Advanced Usage

### Multi-Platform Builds

Build for multiple architectures (amd64, arm64):

```bash
# Enable buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.production \
  -t my-mcp-server:latest \
  --push \
  .
```

### Build with Cache Mounts

Use BuildKit cache mounts for faster builds:

```dockerfile
# In builder stage
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

### Build with Secrets

Pass secrets at build time (not recommended, use runtime secrets instead):

```bash
# Build with secret
docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -f Dockerfile.production \
  -t my-mcp-server:prod \
  .
```

**In Dockerfile**:
```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

### Development with Docker Compose

Create `docker-compose.yml` for local development:

```yaml
version: '3.8'

services:
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile.development
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PORT=8080
    env_file:
      - .env
    volumes:
      # Mount source for hot reload
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
      # Exclude node_modules
      - /app/node_modules
```

**Usage**:
```bash
# Start development environment
docker-compose up

# Rebuild and start
docker-compose up --build

# Stop
docker-compose down
```

---

## Security Considerations

### 1. Never Include Secrets in Images

**❌ WRONG**:
```dockerfile
COPY .env .env  # ❌ NEVER do this
```

**✅ CORRECT**:
```bash
# Pass secrets at runtime
docker run --env-file .env my-mcp-server:prod

# Or use Docker secrets
docker run --secret my-secret my-mcp-server:prod
```

### 2. Run as Non-Root User

**Always included in production Dockerfile**:
```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
```

### 3. Use Official Base Images

**✅ CORRECT**:
```dockerfile
FROM node:20-alpine  # Official Node.js image
```

**❌ WRONG**:
```dockerfile
FROM random-user/node:20  # Untrusted image
```

### 4. Install Security Updates

**Always included**:
```dockerfile
RUN apk update && apk upgrade
```

### 5. Scan Images for Vulnerabilities

```bash
# Scan with Docker
docker scan my-mcp-server:prod

# Scan with Trivy
trivy image my-mcp-server:prod

# Scan with Snyk
snyk container test my-mcp-server:prod
```

### 6. Use .dockerignore

**Always exclude**:
- `.env` files
- `.git` directory
- `node_modules` (from host)
- Test files
- Documentation

### 7. Minimize Attack Surface

- Use Alpine images (smaller, fewer packages)
- Install only necessary dependencies
- Remove build tools in production stage
- Use multi-stage builds

---

## Related Commands

- [`@mcp-auth-server-base.init`](mcp-auth-server-base.init.md) - Includes Dockerfile generation
- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy Docker image to Cloud Run
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate Docker configuration
- [`@mcp-auth-server-base.generate-cloudbuild`](mcp-auth-server-base.generate-cloudbuild.md) - Generate CI/CD configuration

---

## Related Patterns

- [`mcp-auth-server-base.docker-multistage`](../patterns/mcp-auth-server-base.docker-multistage.md) - Multi-stage build pattern
- [`mcp-auth-server-base.health-check`](../patterns/mcp-auth-server-base.health-check.md) - Health check implementation
- [`mcp-auth-server-base.cloud-run-deployment`](../patterns/mcp-auth-server-base.cloud-run-deployment.md) - Cloud Run deployment
- [`mcp-auth-server-base.environment-configuration`](../patterns/mcp-auth-server-base.environment-configuration.md) - Environment variables

---

## Notes

- **Overwrite Warning**: Always warn before overwriting existing files
- **Customization**: Support common customizations (Node version, port, etc.)
- **Testing**: Encourage users to test builds locally before deploying
- **Security**: Emphasize security best practices (non-root, no secrets, scanning)
- **Multi-Stage**: Production always uses multi-stage for optimization
- **Alpine**: Default to Alpine images for smaller size
- **Health Checks**: Always include health checks for Cloud Run
- **.dockerignore**: Critical for excluding secrets and unnecessary files

---

**Namespace**: mcp-auth-server-base
**Command**: generate-dockerfile
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.7.0+
**Author**: mcp-auth-server-base Package
