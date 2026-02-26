# Docker Multi-Stage Build Pattern

**Pattern**: mcp-auth-server-base.docker-multistage
**Category**: Deployment
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines multi-stage Docker builds for MCP auth-wrapped servers, optimizing image size, build time, and security. It covers builder and production stages, dependency management, health checks, and best practices for Node.js applications.

**Key Principles**:
- Separate build and runtime dependencies
- Minimize production image size
- Use Alpine Linux for smaller images
- Include health checks
- Follow security best practices

---

## Core Concepts

### Multi-Stage Builds

Multi-stage builds use multiple `FROM` statements in a single Dockerfile:

1. **Builder Stage**: Compiles TypeScript, installs all dependencies
2. **Production Stage**: Copies compiled code, installs production dependencies only

**Benefits**:
- Smaller production images (no dev dependencies, no source files)
- Faster deployments
- Better security (fewer attack surfaces)
- Cleaner separation of concerns

---

## Implementation

### 1. Production Dockerfile

```dockerfile
# Dockerfile.production

# ============================================
# Builder Stage
# ============================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine

# Set NODE_ENV
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s \
            --timeout=3s \
            --start-period=5s \
            --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start application
CMD ["node", "dist/index.js"]
```

### 2. Development Dockerfile

```dockerfile
# Dockerfile.development

FROM node:20-alpine

# Set NODE_ENV
ENV NODE_ENV=development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Start with hot reload
CMD ["npm", "run", "dev"]
```

### 3. .dockerignore

```
# .dockerignore

# Node modules
node_modules
npm-debug.log

# Build output
dist
build
*.tsbuildinfo

# Environment files
.env
.env.*
!.env.example

# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# Tests
**/*.spec.ts
**/*.test.ts
coverage

# Documentation
*.md
!README.md

# CI/CD
.github
.gitlab-ci.yml

# Logs
logs
*.log

# OS files
.DS_Store
Thumbs.db
```

### 4. Build Scripts

```bash
#!/bin/bash
# scripts/docker-build.sh

# Build production image
docker build -f Dockerfile.production -t my-mcp-server:latest .

# Build with version tag
VERSION=$(node -p "require('./package.json').version")
docker build -f Dockerfile.production -t my-mcp-server:$VERSION .

# Build development image
docker build -f Dockerfile.development -t my-mcp-server:dev .
```

### 5. Docker Compose for Local Development

```yaml
# docker-compose.yml

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
      - LOG_LEVEL=debug
    env_file:
      - .env.development
    volumes:
      # Mount source for hot reload
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
      # Exclude node_modules
      - /app/node_modules
    command: npm run dev
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

---

## Examples

### Example 1: Basic Multi-Stage Build

```dockerfile
# Minimal production Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Example 2: With Build Arguments

```dockerfile
# Dockerfile with build arguments

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

ARG BUILD_DATE
ARG VERSION
ARG REVISION

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Example 3: With esbuild

```dockerfile
# Dockerfile for esbuild projects

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build with esbuild
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Copy package files and install production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy built files (esbuild output)
COPY --from=builder /app/dist ./dist

# esbuild bundles dependencies, so we might not need node_modules
# But keep them for any unbundled dependencies
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### Example 4: With Security Scanning

```dockerfile
# Dockerfile with security best practices

FROM node:20-alpine AS builder

# Install security updates
RUN apk update && apk upgrade

WORKDIR /app
COPY package*.json ./
RUN npm ci --audit
COPY . .
RUN npm run build

FROM node:20-alpine

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --audit && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Single-Stage Build

**Wrong**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install  # ❌ Installs dev dependencies in production
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

**Correct**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production  # ✅ Production deps only
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### ❌ Anti-Pattern 2: Running as Root

**Wrong**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
CMD ["node", "dist/index.js"]  # ❌ Runs as root
```

**Correct**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs  # ✅ Run as non-root
CMD ["node", "dist/index.js"]
```

### ❌ Anti-Pattern 3: No .dockerignore

**Wrong**:
```dockerfile
# No .dockerignore file
COPY . .  # ❌ Copies node_modules, .git, etc.
```

**Correct**:
```dockerfile
# With .dockerignore
COPY . .  # ✅ Only copies necessary files
```

### ❌ Anti-Pattern 4: Using npm install Instead of npm ci

**Wrong**:
```dockerfile
RUN npm install  # ❌ Non-deterministic, slower
```

**Correct**:
```dockerfile
RUN npm ci  # ✅ Deterministic, faster, uses package-lock.json
```

---

## Testing

### Build and Test Locally

```bash
# Build production image
docker build -f Dockerfile.production -t my-mcp-server:test .

# Run container
docker run -p 8080:8080 --env-file .env.test my-mcp-server:test

# Test health endpoint
curl http://localhost:8080/health

# Check image size
docker images my-mcp-server:test

# Inspect layers
docker history my-mcp-server:test

# Run security scan
docker scan my-mcp-server:test
```

### Automated Testing

```bash
#!/bin/bash
# scripts/test-docker.sh

set -e

echo "Building Docker image..."
docker build -f Dockerfile.production -t my-mcp-server:test .

echo "Starting container..."
CONTAINER_ID=$(docker run -d -p 8080:8080 --env-file .env.test my-mcp-server:test)

echo "Waiting for container to be healthy..."
sleep 5

echo "Testing health endpoint..."
curl -f http://localhost:8080/health || exit 1

echo "Stopping container..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID

echo "✅ Docker tests passed"
```

---

## Best Practices

1. **Use Multi-Stage Builds**: Separate build and runtime stages
2. **Use Alpine Images**: Smaller size, faster deployments
3. **Use npm ci**: Deterministic, faster than npm install
4. **Run as Non-Root**: Create and use non-root user
5. **Include Health Checks**: Enable container orchestration
6. **Use .dockerignore**: Exclude unnecessary files
7. **Layer Caching**: Copy package.json before source code
8. **Clean npm Cache**: Remove cache after install
9. **Use Specific Versions**: Pin Node.js version
10. **Add Labels**: Include metadata for tracking

---

## Optimization Techniques

### 1. Layer Caching

```dockerfile
# Copy package files first (changes less frequently)
COPY package*.json ./
RUN npm ci

# Copy source code last (changes more frequently)
COPY . .
RUN npm run build
```

### 2. Minimize Layers

```dockerfile
# Combine commands to reduce layers
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*
```

### 3. Use Build Cache

```bash
# Build with BuildKit for better caching
DOCKER_BUILDKIT=1 docker build -f Dockerfile.production -t my-mcp-server .
```

### 4. Multi-Platform Builds

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.production \
  -t my-mcp-server:latest \
  .
```

---

## Security Considerations

1. **Non-Root User**: Always run as non-root
2. **Security Updates**: Install OS security updates
3. **Minimal Base Image**: Use Alpine for smaller attack surface
4. **No Secrets in Image**: Never COPY .env files
5. **Scan Images**: Use `docker scan` or Trivy
6. **Read-Only Filesystem**: Consider read-only root filesystem
7. **Drop Capabilities**: Drop unnecessary Linux capabilities
8. **Use Secrets**: Mount secrets at runtime, not build time

### Security Scanning

```bash
# Scan with Docker
docker scan my-mcp-server:latest

# Scan with Trivy
trivy image my-mcp-server:latest

# Scan with Snyk
snyk container test my-mcp-server:latest
```

---

## Performance Considerations

1. **Image Size**: Aim for < 200MB for Node.js apps
2. **Build Time**: Use layer caching effectively
3. **Startup Time**: Optimize application startup
4. **Memory Usage**: Set appropriate memory limits
5. **CPU Usage**: Consider CPU limits for builds

### Benchmarks

```
Single-stage build:  ~500MB, 2-3 minutes
Multi-stage build:   ~150MB, 2-3 minutes
Alpine multi-stage:  ~100MB, 1-2 minutes
```

---

## Cloud Run Integration

```dockerfile
# Dockerfile optimized for Cloud Run

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# Cloud Run provides PORT environment variable
ENV PORT=8080
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
```

---

## Related Patterns

- [Cloud Build Pattern](mcp-auth-server-base.cloud-build.md) - Building and pushing images
- [Cloud Run Deployment Pattern](mcp-auth-server-base.cloud-run-deployment.md) - Deploying containers
- [Environment Configuration Pattern](mcp-auth-server-base.environment-configuration.md) - Runtime configuration

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server Dockerfiles
**Recommendation**: Use multi-stage builds for all production deployments
