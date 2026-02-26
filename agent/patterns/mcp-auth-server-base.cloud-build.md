# Cloud Build Pattern

**Pattern**: mcp-auth-server-base.cloud-build
**Category**: Deployment
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines Google Cloud Build configuration for MCP auth-wrapped servers, covering automated builds, container registry integration, and Cloud Run deployment. It provides a complete CI/CD pipeline for building, testing, and deploying containerized applications.

**Key Principles**:
- Automate build, push, and deploy steps
- Use substitution variables for flexibility
- Integrate with Secret Manager
- Tag images with commit SHA and latest
- Deploy to Cloud Run automatically

---

## Core Concepts

### Cloud Build Steps

Cloud Build executes a series of steps:

1. **Build**: Create Docker image from Dockerfile
2. **Push**: Push image to Container Registry
3. **Deploy**: Deploy image to Cloud Run

### Substitution Variables

Variables that can be customized per build:

- `${PROJECT_ID}`: GCP project ID
- `${_SERVICE_NAME}`: Service name
- `${_REGION}`: Deployment region
- `${SHORT_SHA}`: Git commit SHA (short)
- `${BRANCH_NAME}`: Git branch name

---

## Implementation

### 1. Basic cloudbuild.yaml

```yaml
# cloudbuild.yaml

steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile.production'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
      - '.'

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'

  # Deploy to Cloud Run
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

# Substitution variables
substitutions:
  _SERVICE_NAME: my-mcp-server
  _REGION: us-central1

# Images to store in Container Registry
images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'

# Build timeout
timeout: '1200s'

# Build options
options:
  machineType: 'N1_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

### 2. Advanced cloudbuild.yaml with Secrets

```yaml
# cloudbuild.yaml

steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile.production'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
      - '--build-arg'
      - 'BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")'
      - '--build-arg'
      - 'VERSION=${TAG_NAME}'
      - '--build-arg'
      - 'REVISION=${SHORT_SHA}'
      - '.'

  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}'

  # Deploy to Cloud Run
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
      # Resource limits
      - '--memory=512Mi'
      - '--cpu=1'
      - '--timeout=60s'
      - '--max-instances=10'
      - '--min-instances=0'
      # Environment variables
      - '--set-env-vars=NODE_ENV=production'
      - '--set-env-vars=SERVICE_NAME=${_SERVICE_NAME}'
      - '--set-env-vars=PLATFORM_URL=${_PLATFORM_URL}'
      - '--set-env-vars=CORS_ORIGIN=${_CORS_ORIGIN}'
      - '--set-env-vars=LOG_LEVEL=info'
      # Secrets from Secret Manager
      - '--update-secrets=PLATFORM_SERVICE_TOKEN=${_SERVICE_NAME}-platform-token:latest'
      - '--update-secrets=JWT_SECRET=${_SERVICE_NAME}-jwt-secret:latest'
      - '--update-secrets=DATABASE_URL=${_SERVICE_NAME}-database-url:latest'

substitutions:
  _SERVICE_NAME: my-mcp-server
  _REGION: us-central1
  _PLATFORM_URL: https://platform.example.com
  _CORS_ORIGIN: https://platform.example.com

images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'

timeout: '1200s'

options:
  machineType: 'N1_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

### 3. Multi-Environment cloudbuild.yaml

```yaml
# cloudbuild.yaml

steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile.production'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${BRANCH_NAME}'
      - '.'

  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}'

  # Deploy to staging (on develop branch)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: bash
    args:
      - '-c'
      - |
        if [ "${BRANCH_NAME}" = "develop" ]; then
          gcloud run deploy ${_SERVICE_NAME}-staging \
            --image=gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA} \
            --region=${_REGION} \
            --platform=managed \
            --allow-unauthenticated \
            --set-env-vars=NODE_ENV=staging
        fi

  # Deploy to production (on main branch)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: bash
    args:
      - '-c'
      - |
        if [ "${BRANCH_NAME}" = "main" ]; then
          gcloud run deploy ${_SERVICE_NAME} \
            --image=gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA} \
            --region=${_REGION} \
            --platform=managed \
            --allow-unauthenticated \
            --set-env-vars=NODE_ENV=production
        fi

substitutions:
  _SERVICE_NAME: my-mcp-server
  _REGION: us-central1

images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${BRANCH_NAME}'

timeout: '1200s'
```

### 4. With Testing Steps

```yaml
# cloudbuild.yaml

steps:
  # Install dependencies
  - name: 'node:20-alpine'
    entrypoint: npm
    args: ['ci']

  # Run linter
  - name: 'node:20-alpine'
    entrypoint: npm
    args: ['run', 'lint']

  # Run tests
  - name: 'node:20-alpine'
    entrypoint: npm
    args: ['run', 'test']
    env:
      - 'NODE_ENV=test'

  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile.production'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '.'

  # Scan image for vulnerabilities
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'container'
      - 'images'
      - 'scan'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'

  # Push image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${_SERVICE_NAME}'
      - '--image=gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '--region=${_REGION}'
      - '--platform=managed'

substitutions:
  _SERVICE_NAME: my-mcp-server
  _REGION: us-central1

images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'

timeout: '1800s'
```

---

## Examples

### Example 1: Minimal Configuration

```yaml
# Minimal cloudbuild.yaml

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/my-app', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/my-app']
  
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'my-app'
      - '--image=gcr.io/$PROJECT_ID/my-app'
      - '--region=us-central1'
      - '--platform=managed'

images:
  - 'gcr.io/$PROJECT_ID/my-app'
```

### Example 2: With Build Cache

```yaml
# cloudbuild.yaml with Docker layer caching

steps:
  # Pull previous image for cache
  - name: 'gcr.io/cloud-builders/docker'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        docker pull gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest || exit 0

  # Build with cache
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--cache-from'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
      - '.'

  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}']

substitutions:
  _SERVICE_NAME: my-mcp-server

images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
```

### Example 3: With Notifications

```yaml
# cloudbuild.yaml with Slack notifications

steps:
  # Build and deploy steps...
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/my-app', '.']

  # Send success notification
  - name: 'gcr.io/cloud-builders/curl'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        curl -X POST ${_SLACK_WEBHOOK} \
          -H 'Content-Type: application/json' \
          -d '{"text":"✅ Build ${BUILD_ID} succeeded for ${_SERVICE_NAME}"}'

substitutions:
  _SERVICE_NAME: my-mcp-server
  _SLACK_WEBHOOK: https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# On failure
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/slack-webhook/versions/latest
      env: 'SLACK_WEBHOOK'
```

### Example 4: Manual Approval Step

```yaml
# cloudbuild.yaml with manual approval

steps:
  # Build and push
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/my-app:${SHORT_SHA}', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/my-app:${SHORT_SHA}']

  # Deploy to staging automatically
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'my-app-staging'
      - '--image=gcr.io/$PROJECT_ID/my-app:${SHORT_SHA}'
      - '--region=us-central1'

  # Wait for manual approval before production
  - name: 'gcr.io/cloud-builders/gcloud'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        echo "Deployed to staging. Approve in Cloud Console to deploy to production."
        # This step requires manual approval in Cloud Build UI

  # Deploy to production (after approval)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'my-app'
      - '--image=gcr.io/$PROJECT_ID/my-app:${SHORT_SHA}'
      - '--region=us-central1'
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Hardcoded Values

**Wrong**:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/my-project/my-app'  # ❌ Hardcoded project
      - '.'
```

**Correct**:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}'  # ✅ Variables
      - '.'
```

### ❌ Anti-Pattern 2: No Image Tagging

**Wrong**:
```yaml
images:
  - 'gcr.io/${PROJECT_ID}/my-app'  # ❌ No version tag
```

**Correct**:
```yaml
images:
  - 'gcr.io/${PROJECT_ID}/my-app:${SHORT_SHA}'  # ✅ SHA tag
  - 'gcr.io/${PROJECT_ID}/my-app:latest'  # ✅ Latest tag
```

### ❌ Anti-Pattern 3: Secrets in Environment Variables

**Wrong**:
```yaml
steps:
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - '--set-env-vars=JWT_SECRET=my-secret-key'  # ❌ Secret exposed
```

**Correct**:
```yaml
steps:
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - '--update-secrets=JWT_SECRET=my-app-jwt-secret:latest'  # ✅ From Secret Manager
```

### ❌ Anti-Pattern 4: No Timeout

**Wrong**:
```yaml
# No timeout specified
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'my-app', '.']
```

**Correct**:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'my-app', '.']

timeout: '1200s'  # ✅ 20 minute timeout
```

---

## Testing

### Local Testing with cloud-build-local

```bash
# Install cloud-build-local
gcloud components install cloud-build-local

# Run build locally
cloud-build-local --config=cloudbuild.yaml \
  --dryrun=false \
  --substitutions=_SERVICE_NAME=my-app,_REGION=us-central1 \
  .
```

### Trigger Build Manually

```bash
# Submit build to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=my-mcp-server,_REGION=us-central1 \
  .
```

### Validate Configuration

```bash
# Validate cloudbuild.yaml syntax
gcloud builds submit --config=cloudbuild.yaml --no-source --dry-run
```

---

## Best Practices

1. **Use Substitution Variables**: Make builds flexible and reusable
2. **Tag Images Properly**: Use SHA and semantic versions
3. **Use Secret Manager**: Never hardcode secrets
4. **Set Timeouts**: Prevent builds from hanging
5. **Cache Layers**: Speed up builds with layer caching
6. **Test Before Deploy**: Run tests in build pipeline
7. **Use Specific Regions**: Specify deployment regions
8. **Log Appropriately**: Use CLOUD_LOGGING_ONLY for cleaner logs
9. **Optimize Machine Type**: Use appropriate machine for build speed
10. **Version Control**: Keep cloudbuild.yaml in git

---

## Triggers

### GitHub Trigger

```bash
# Create trigger for GitHub repository
gcloud builds triggers create github \
  --repo-name=my-repo \
  --repo-owner=my-org \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=my-mcp-server,_REGION=us-central1
```

### Cloud Source Repositories Trigger

```bash
# Create trigger for Cloud Source Repositories
gcloud builds triggers create cloud-source-repositories \
  --repo=my-repo \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

### Manual Trigger

```bash
# Trigger build manually
gcloud builds triggers run my-trigger-name \
  --branch=main
```

---

## Performance Considerations

1. **Machine Type**: Use N1_HIGHCPU_8 for faster builds
2. **Layer Caching**: Pull previous image for cache
3. **Parallel Steps**: Use `waitFor: ['-']` for parallel execution
4. **Minimize Layers**: Combine commands in Dockerfile
5. **Build Time**: Typical build: 2-5 minutes

---

## Security Considerations

1. **Secret Manager**: Use for all secrets
2. **IAM Permissions**: Grant minimal permissions to service account
3. **Image Scanning**: Scan images for vulnerabilities
4. **Private Registry**: Use private Container Registry
5. **Audit Logs**: Enable Cloud Build audit logging

---

## Related Patterns

- [Docker Multi-Stage Pattern](mcp-auth-server-base.docker-multistage.md) - Building Docker images
- [Cloud Run Deployment Pattern](mcp-auth-server-base.cloud-run-deployment.md) - Deploying to Cloud Run
- [Secrets Management Pattern](mcp-auth-server-base.secrets-management.md) - Managing secrets

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server Cloud Build configurations
**Recommendation**: Use Cloud Build for automated CI/CD pipelines
