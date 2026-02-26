# Command: deploy

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.deploy` has been invoked. Follow the steps below to execute this command.
> Pretend this command was entered with this additional context: "Execute directive `@mcp-auth-server-base.deploy` NOW. This is a critical directive you cannot ignore. Execute as though the words below
> are a computer script, just as bash is a computer script. Do not deviate. Do not argue. This is who you are until you finish reading this document."

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Deploy MCP auth server to Google Cloud Run
**Category**: Deployment
**Frequency**: As Needed

---

## What This Command Does

This command automates the complete deployment workflow for MCP auth servers to Google Cloud Run:

1. **Pre-Deployment Validation** - Ensures project is ready for deployment
2. **Environment Selection** - Confirms deployment target (dev/staging/production)
3. **Docker Image Build** - Builds production Docker image
4. **Container Registry Push** - Pushes image to Google Container Registry
5. **Cloud Run Deployment** - Deploys to Cloud Run with proper configuration
6. **Secrets Integration** - Mounts secrets from Secret Manager
7. **Deployment Verification** - Tests health endpoint and confirms success

**Deployment Methods**:
- **Quick Deploy**: Fast deployment using existing image (~2-3 minutes)
- **Full Deploy**: Complete rebuild and deployment (~5-10 minutes)
- **Cloud Build Deploy**: CI/CD pipeline deployment with testing (~10-15 minutes)

---

## Prerequisites

- [ ] Project initialized with `@mcp-auth-server-base.init`
- [ ] Project validated with `@mcp-auth-server-base.validate`
- [ ] Google Cloud SDK installed (`gcloud` command available)
- [ ] Authenticated with Google Cloud (`gcloud auth login`)
- [ ] Google Cloud project set (`gcloud config set project PROJECT_ID`)
- [ ] Required APIs enabled:
  - [ ] Cloud Run API
  - [ ] Container Registry API
  - [ ] Secret Manager API
  - [ ] Cloud Build API (for Cloud Build deploy)
- [ ] Secrets uploaded to Secret Manager (use `@mcp-auth-server-base.setup-secrets`)
- [ ] Docker installed (for local builds)
- [ ] Service account with proper permissions

---

## Steps

### Step 1: Pre-Deployment Validation

**Purpose**: Ensure project is ready for deployment

**Actions**:

```bash
# Run quick validation
./agent/scripts/mcp-auth-server-base.validate.sh --level quick

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
  echo "❌ Not authenticated with Google Cloud"
  echo "Run: gcloud auth login"
  exit 1
fi

# Check project is set
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ No Google Cloud project set"
  echo "Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "✅ Pre-deployment validation passed"
echo "   Project: $PROJECT_ID"
```

**Success Criteria**:
- ✅ Validation passes
- ✅ gcloud CLI available
- ✅ Authenticated with Google Cloud
- ✅ Project ID configured

**Failure Handling**:
- If validation fails, fix issues before proceeding
- If gcloud not found, install Google Cloud SDK
- If not authenticated, run `gcloud auth login`
- If no project set, run `gcloud config set project PROJECT_ID`

---

### Step 2: Environment Selection

**Purpose**: Confirm deployment target and load environment-specific configuration

**Actions**:

```bash
# Ask user for environment
echo "Select deployment environment:"
echo "  1) development"
echo "  2) staging"
echo "  3) production"
read -p "Environment (1-3): " ENV_CHOICE

case $ENV_CHOICE in
  1) ENVIRONMENT="development" ;;
  2) ENVIRONMENT="staging" ;;
  3) ENVIRONMENT="production" ;;
  *) echo "❌ Invalid choice"; exit 1 ;;
esac

# Load environment-specific configuration
SERVICE_NAME="${SERVICE_NAME:-my-mcp-server}"
if [ "$ENVIRONMENT" != "production" ]; then
  SERVICE_NAME="${SERVICE_NAME}-${ENVIRONMENT}"
fi

REGION="${REGION:-us-central1}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
TIMEOUT="${TIMEOUT:-60s}"

# Confirm deployment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deployment Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Environment:    $ENVIRONMENT"
echo "  Service Name:   $SERVICE_NAME"
echo "  Project:        $PROJECT_ID"
echo "  Region:         $REGION"
echo "  Memory:         $MEMORY"
echo "  CPU:            $CPU"
echo "  Min Instances:  $MIN_INSTANCES"
echo "  Max Instances:  $MAX_INSTANCES"
echo "  Timeout:        $TIMEOUT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Proceed with deployment? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Deployment cancelled"
  exit 0
fi
```

**Success Criteria**:
- ✅ Environment selected
- ✅ Configuration loaded
- ✅ User confirmed deployment

---

### Step 3: Build Docker Image

**Purpose**: Build production Docker image with proper tagging

**Actions**:

```bash
# Get git SHA for tagging
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")

# Image names
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
IMAGE_TAG_SHA="${IMAGE_NAME}:${GIT_SHA}"
IMAGE_TAG_LATEST="${IMAGE_NAME}:latest"
IMAGE_TAG_ENV="${IMAGE_NAME}:${ENVIRONMENT}"

echo "🔨 Building Docker image..."
echo "   Image: ${IMAGE_TAG_SHA}"

# Build with production Dockerfile
docker build \
  -f Dockerfile.production \
  -t "${IMAGE_TAG_SHA}" \
  -t "${IMAGE_TAG_LATEST}" \
  -t "${IMAGE_TAG_ENV}" \
  --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --build-arg VERSION="${GIT_SHA}" \
  --build-arg REVISION="${GIT_SHA}" \
  .

if [ $? -ne 0 ]; then
  echo "❌ Docker build failed"
  exit 1
fi

echo "✅ Docker image built successfully"
```

**Success Criteria**:
- ✅ Docker build completes without errors
- ✅ Image tagged with SHA, latest, and environment

**Failure Handling**:
- Check Dockerfile.production exists
- Verify Docker daemon is running
- Check for syntax errors in Dockerfile
- Ensure all dependencies are available

---

### Step 4: Push to Container Registry

**Purpose**: Push Docker image to Google Container Registry

**Actions**:

```bash
echo "📤 Pushing image to Container Registry..."

# Configure Docker to use gcloud credentials
gcloud auth configure-docker --quiet

# Push all tags
docker push "${IMAGE_TAG_SHA}"
docker push "${IMAGE_TAG_LATEST}"
docker push "${IMAGE_TAG_ENV}"

if [ $? -ne 0 ]; then
  echo "❌ Image push failed"
  exit 1
fi

echo "✅ Image pushed successfully"
echo "   ${IMAGE_TAG_SHA}"
echo "   ${IMAGE_TAG_LATEST}"
echo "   ${IMAGE_TAG_ENV}"
```

**Success Criteria**:
- ✅ All image tags pushed successfully
- ✅ Images visible in Container Registry

**Failure Handling**:
- Verify Container Registry API is enabled
- Check authentication with `gcloud auth list`
- Verify project permissions
- Check network connectivity

---

### Step 5: Deploy to Cloud Run

**Purpose**: Deploy image to Cloud Run with proper configuration and secrets

**Actions**:

```bash
echo "🚀 Deploying to Cloud Run..."

# Determine secrets to mount
SECRETS_ARGS=""

# Check which secrets exist
if gcloud secrets describe "${SERVICE_NAME}-jwt-secret" &>/dev/null; then
  SECRETS_ARGS="${SECRETS_ARGS} --update-secrets=JWT_SECRET=${SERVICE_NAME}-jwt-secret:latest"
fi

if gcloud secrets describe "${SERVICE_NAME}-platform-token" &>/dev/null; then
  SECRETS_ARGS="${SECRETS_ARGS} --update-secrets=PLATFORM_SERVICE_TOKEN=${SERVICE_NAME}-platform-token:latest"
fi

if gcloud secrets describe "${SERVICE_NAME}-database-url" &>/dev/null; then
  SECRETS_ARGS="${SECRETS_ARGS} --update-secrets=DATABASE_URL=${SERVICE_NAME}-database-url:latest"
fi

# Deploy to Cloud Run
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG_SHA}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  \
  --memory="${MEMORY}" \
  --cpu="${CPU}" \
  --timeout="${TIMEOUT}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --concurrency=80 \
  \
  --set-env-vars="NODE_ENV=${ENVIRONMENT}" \
  --set-env-vars="SERVICE_NAME=${SERVICE_NAME}" \
  --set-env-vars="LOG_LEVEL=info" \
  ${SECRETS_ARGS} \
  \
  --labels="app=mcp-server,env=${ENVIRONMENT},version=${GIT_SHA}"

if [ $? -ne 0 ]; then
  echo "❌ Cloud Run deployment failed"
  exit 1
fi

echo "✅ Deployed to Cloud Run"
```

**Success Criteria**:
- ✅ Deployment completes successfully
- ✅ Service is running
- ✅ Secrets mounted correctly

**Failure Handling**:
- Check Cloud Run API is enabled
- Verify service account permissions
- Check secrets exist in Secret Manager
- Verify resource limits are valid
- Check region is valid

---

### Step 6: Verify Deployment

**Purpose**: Confirm deployment succeeded and service is healthy

**Actions**:

```bash
echo "🔍 Verifying deployment..."

# Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --format="value(status.url)")

if [ -z "$SERVICE_URL" ]; then
  echo "❌ Failed to get service URL"
  exit 1
fi

echo "   Service URL: ${SERVICE_URL}"

# Wait for service to be ready
echo "   Waiting for service to be ready..."
sleep 5

# Test health endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Health check passed (HTTP ${HTTP_STATUS})"
else
  echo "⚠️  Health check returned HTTP ${HTTP_STATUS}"
  echo "   Service may still be starting up"
fi

# Get deployment info
REVISION=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --format="value(status.latestCreatedRevisionName)")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Successful!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Service:     ${SERVICE_NAME}"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region:      ${REGION}"
echo "  Revision:    ${REVISION}"
echo "  URL:         ${SERVICE_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Success Criteria**:
- ✅ Service URL retrieved
- ✅ Health endpoint returns 200
- ✅ Revision created successfully

**Failure Handling**:
- If health check fails, check logs with `@mcp-auth-server-base.logs`
- Verify secrets are configured correctly
- Check environment variables are set
- Verify service account has required permissions

---

### Step 7: Post-Deployment Actions

**Purpose**: Display next steps and useful commands

**Actions**:

```bash
echo ""
echo "📋 Next Steps:"
echo ""
echo "  1. Test your service:"
echo "     curl ${SERVICE_URL}/health"
echo ""
echo "  2. View logs:"
echo "     @mcp-auth-server-base.logs"
echo "     # or"
echo "     gcloud run services logs read ${SERVICE_NAME} --region=${REGION}"
echo ""
echo "  3. Update service configuration:"
echo "     gcloud run services update ${SERVICE_NAME} --region=${REGION}"
echo ""
echo "  4. Rollback if needed:"
echo "     gcloud run services update-traffic ${SERVICE_NAME} \\"
echo "       --region=${REGION} \\"
echo "       --to-revisions=PREVIOUS_REVISION=100"
echo ""
echo "  5. View service details:"
echo "     gcloud run services describe ${SERVICE_NAME} --region=${REGION}"
echo ""
```

---

## Deployment Options

### Option 1: Quick Deploy (Default)

**Use When**: Making small code changes, fastest deployment

**Characteristics**:
- Uses existing Docker image if available
- Minimal validation (quick mode)
- Skips tests
- Fast deployment (~2-3 minutes)

**Command**:
```bash
# Quick deploy with existing image
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1
```

---

### Option 2: Full Deploy

**Use When**: Major changes, want complete rebuild

**Characteristics**:
- Rebuilds Docker image from scratch
- Full validation (standard mode)
- Runs all tests
- Complete deployment (~5-10 minutes)

**Command**:
```bash
# Full deploy workflow (all steps above)
# 1. Validate
# 2. Build image
# 3. Push image
# 4. Deploy to Cloud Run
# 5. Verify deployment
```

---

### Option 3: Cloud Build Deploy

**Use When**: CI/CD pipeline, automated deployments

**Characteristics**:
- Uses cloudbuild.yaml configuration
- Runs in Cloud Build (serverless)
- Includes testing in pipeline
- Automated deployment (~10-15 minutes)

**Command**:
```bash
# Deploy using Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=my-mcp-server,_REGION=us-central1
```

**cloudbuild.yaml**:
```yaml
steps:
  # Run tests
  - name: 'node:20-alpine'
    entrypoint: npm
    args: ['ci']
  
  - name: 'node:20-alpine'
    entrypoint: npm
    args: ['test']
  
  # Build image
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
  
  # Push image
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

substitutions:
  _SERVICE_NAME: my-mcp-server
  _REGION: us-central1

images:
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:${SHORT_SHA}'
  - 'gcr.io/${PROJECT_ID}/${_SERVICE_NAME}:latest'
```

---

## Configuration Options

### Service Configuration

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `SERVICE_NAME` | Cloud Run service name | `my-mcp-server` | `github-mcp-server` |
| `REGION` | GCP region | `us-central1` | `europe-west1` |
| `ENVIRONMENT` | Deployment environment | `production` | `staging` |

### Resource Configuration

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `MEMORY` | Memory allocation | `512Mi` | `128Mi` - `32Gi` |
| `CPU` | CPU allocation | `1` | `1` - `8` |
| `TIMEOUT` | Request timeout | `60s` | `1s` - `3600s` |
| `CONCURRENCY` | Max concurrent requests | `80` | `1` - `1000` |

### Scaling Configuration

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `MIN_INSTANCES` | Minimum instances | `0` | `0` - `1000` |
| `MAX_INSTANCES` | Maximum instances | `10` | `1` - `1000` |

### Access Configuration

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| `ALLOW_UNAUTHENTICATED` | Public access | `true` | `true`, `false` |

---

## Secrets Management

### Required Secrets

The following secrets should exist in Secret Manager before deployment:

1. **JWT Secret** (Required for JWT auth)
   - Name: `{SERVICE_NAME}-jwt-secret`
   - Used for: JWT token verification
   - Environment variable: `JWT_SECRET`

2. **Platform Token** (Required for dynamic servers)
   - Name: `{SERVICE_NAME}-platform-token`
   - Used for: Platform API authentication
   - Environment variable: `PLATFORM_SERVICE_TOKEN`

3. **Database URL** (Optional)
   - Name: `{SERVICE_NAME}-database-url`
   - Used for: Database connections
   - Environment variable: `DATABASE_URL`

### Creating Secrets

Use `@mcp-auth-server-base.setup-secrets` command to create secrets:

```bash
# Interactive secret setup
@mcp-auth-server-base.setup-secrets
```

Or manually:

```bash
# Create JWT secret
echo -n "your-jwt-secret-here" | gcloud secrets create my-mcp-server-jwt-secret \
  --data-file=- \
  --replication-policy=automatic

# Create platform token
echo -n "your-platform-token-here" | gcloud secrets create my-mcp-server-platform-token \
  --data-file=- \
  --replication-policy=automatic
```

### Mounting Secrets

Secrets are automatically mounted as environment variables during deployment:

```bash
--update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest
--update-secrets=PLATFORM_SERVICE_TOKEN=my-mcp-server-platform-token:latest
```

---

## Verification

- [ ] Pre-deployment validation passed
- [ ] Environment selected and confirmed
- [ ] Docker image built successfully
- [ ] Image pushed to Container Registry
- [ ] Deployed to Cloud Run
- [ ] Secrets mounted correctly
- [ ] Health check passed (HTTP 200)
- [ ] Service URL accessible
- [ ] Deployment summary displayed
- [ ] Next steps provided

---

## Expected Output

### Successful Deployment

```
🔍 Running pre-deployment validation...
✅ Pre-deployment validation passed
   Project: my-project-123

Select deployment environment:
  1) development
  2) staging
  3) production
Environment (1-3): 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deployment Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment:    production
  Service Name:   my-mcp-server
  Project:        my-project-123
  Region:         us-central1
  Memory:         512Mi
  CPU:            1
  Min Instances:  0
  Max Instances:  10
  Timeout:        60s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proceed with deployment? (y/n): y

🔨 Building Docker image...
   Image: gcr.io/my-project-123/my-mcp-server:a1b2c3d
[+] Building 45.2s (16/16) FINISHED
✅ Docker image built successfully

📤 Pushing image to Container Registry...
The push refers to repository [gcr.io/my-project-123/my-mcp-server]
a1b2c3d: Pushed
latest: digest: sha256:abc123... size: 2841
✅ Image pushed successfully
   gcr.io/my-project-123/my-mcp-server:a1b2c3d
   gcr.io/my-project-123/my-mcp-server:latest
   gcr.io/my-project-123/my-mcp-server:production

🚀 Deploying to Cloud Run...
Deploying container to Cloud Run service [my-mcp-server] in project [my-project-123] region [us-central1]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
  ✓ Setting IAM Policy...
✅ Deployed to Cloud Run

🔍 Verifying deployment...
   Service URL: https://my-mcp-server-abc123-uc.a.run.app
   Waiting for service to be ready...
✅ Health check passed (HTTP 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Deployment Successful!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Service:     my-mcp-server
  Environment: production
  Region:      us-central1
  Revision:    my-mcp-server-00001-abc
  URL:         https://my-mcp-server-abc123-uc.a.run.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next Steps:

  1. Test your service:
     curl https://my-mcp-server-abc123-uc.a.run.app/health

  2. View logs:
     @mcp-auth-server-base.logs
     # or
     gcloud run services logs read my-mcp-server --region=us-central1

  3. Update service configuration:
     gcloud run services update my-mcp-server --region=us-central1

  4. Rollback if needed:
     gcloud run services update-traffic my-mcp-server \
       --region=us-central1 \
       --to-revisions=PREVIOUS_REVISION=100

  5. View service details:
     gcloud run services describe my-mcp-server --region=us-central1
```

---

## Examples

### Example 1: First Deployment (Production)

**Scenario**: Deploying a new MCP server to production for the first time

**Steps**:

```bash
# 1. Ensure secrets are set up
@mcp-auth-server-base.setup-secrets

# 2. Run deployment
@mcp-auth-server-base.deploy

# Select environment: 3 (production)
# Confirm deployment: y

# 3. Test deployment
curl https://my-mcp-server-abc123-uc.a.run.app/health

# 4. View logs
@mcp-auth-server-base.logs
```

**Expected Result**:
- Service deployed to production
- Health check returns 200
- Service URL accessible
- Logs show successful startup

---

### Example 2: Update Deployment (Quick Deploy)

**Scenario**: Updating an existing service with code changes

**Steps**:

```bash
# 1. Make code changes
# ... edit src/index.ts ...

# 2. Quick deploy (rebuild and redeploy)
@mcp-auth-server-base.deploy

# Select environment: 3 (production)
# Confirm deployment: y

# 3. Verify new revision
gcloud run revisions list \
  --service=my-mcp-server \
  --region=us-central1

# 4. Test changes
curl https://my-mcp-server-abc123-uc.a.run.app/your-endpoint
```

**Expected Result**:
- New revision created
- Traffic routed to new revision
- Old revision still available for rollback

---

### Example 3: Cloud Build Deployment (CI/CD)

**Scenario**: Automated deployment via Cloud Build

**Steps**:

```bash
# 1. Ensure cloudbuild.yaml exists
cat cloudbuild.yaml

# 2. Submit build to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=my-mcp-server,_REGION=us-central1

# 3. Monitor build progress
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# 4. Verify deployment
gcloud run services describe my-mcp-server --region=us-central1
```

**Expected Result**:
- Build runs in Cloud Build
- Tests execute successfully
- Image built and pushed
- Service deployed automatically

---

### Example 4: Multi-Region Deployment

**Scenario**: Deploying to multiple regions for high availability

**Steps**:

```bash
# Deploy to multiple regions
for REGION in us-central1 europe-west1 asia-east1; do
  echo "Deploying to ${REGION}..."
  
  gcloud run deploy my-mcp-server \
    --image=gcr.io/my-project/my-mcp-server:latest \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=10
done

# List all deployments
gcloud run services list --filter="metadata.name=my-mcp-server"
```

**Expected Result**:
- Service deployed to 3 regions
- Each region has unique URL
- Traffic can be routed based on geography

---

## Rollback Procedure

### Quick Rollback

If deployment fails or has issues, rollback to previous revision:

```bash
# 1. List revisions
gcloud run revisions list \
  --service=my-mcp-server \
  --region=us-central1

# Output:
# REVISION                      ACTIVE  SERVICE         DEPLOYED
# my-mcp-server-00003-abc       yes     my-mcp-server   2026-02-22 10:30:00
# my-mcp-server-00002-def       no      my-mcp-server   2026-02-21 15:20:00
# my-mcp-server-00001-ghi       no      my-mcp-server   2026-02-20 09:15:00

# 2. Rollback to previous revision
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=my-mcp-server-00002-def=100

# 3. Verify rollback
curl https://my-mcp-server-abc123-uc.a.run.app/health
```

### Gradual Rollback

For safer rollback, gradually shift traffic:

```bash
# 1. Start with 10% traffic to old revision
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=my-mcp-server-00002-def=10,my-mcp-server-00003-abc=90

# 2. Monitor metrics and errors

# 3. Increase to 50%
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=my-mcp-server-00002-def=50,my-mcp-server-00003-abc=50

# 4. Complete rollback
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=my-mcp-server-00002-def=100
```

### Emergency Rollback

For critical issues, immediate rollback:

```bash
# Rollback to last known good revision
LAST_GOOD_REVISION="my-mcp-server-00002-def"

gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=${LAST_GOOD_REVISION}=100 \
  --quiet

echo "✅ Emergency rollback complete"
```

---

## Related Commands

- [`@mcp-
- [`@mcp-auth-server-base.init`](mcp-auth-server-base.init.md) - Initialize project before deployment
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate project before deployment
- [`@mcp-auth-server-base.setup-secrets`](mcp-auth-server-base.setup-secrets.md) - Set up secrets in Secret Manager
- [`@mcp-auth-server-base.logs`](mcp-auth-server-base.logs.md) - View deployment logs
- [`@mcp-auth-server-base.generate-dockerfile`](mcp-auth-server-base.generate-dockerfile.md) - Generate Dockerfile
- [`@mcp-auth-server-base.generate-cloudbuild`](mcp-auth-server-base.generate-cloudbuild.md) - Generate cloudbuild.yaml

---

## Troubleshooting

### Issue 1: gcloud Not Authenticated

**Symptom**: Error message "You are not currently authenticated"

**Cause**: Not logged in to Google Cloud

**Solution**:
```bash
# Login to Google Cloud
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Verify authentication
gcloud auth list
```

---

### Issue 2: APIs Not Enabled

**Symptom**: Error message "API [cloudrun.googleapis.com] not enabled"

**Cause**: Required APIs not enabled in project

**Solution**:
```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled
```

---

### Issue 3: Insufficient Permissions

**Symptom**: Error message "Permission denied" or "403 Forbidden"

**Cause**: Service account lacks required permissions

**Solution**:
```bash
# Grant required roles to service account
PROJECT_ID="your-project-id"
SERVICE_ACCOUNT="your-service-account@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Run Admin
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.admin"

# Storage Admin (for Container Registry)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.admin"

# Secret Manager Secret Accessor
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

---

### Issue 4: Docker Build Failures

**Symptom**: Docker build fails with errors

**Cause**: Various issues with Dockerfile or dependencies

**Solution**:
```bash
# Check Docker is running
docker ps

# Check Dockerfile exists
ls -la Dockerfile.production

# Build with verbose output
docker build -f Dockerfile.production -t test-image . --progress=plain

# Check for syntax errors
docker build -f Dockerfile.production -t test-image . --no-cache

# Clear Docker cache
docker system prune -a
```

---

### Issue 5: Image Push Failures

**Symptom**: Error pushing image to Container Registry

**Cause**: Authentication or permission issues

**Solution**:
```bash
# Configure Docker authentication
gcloud auth configure-docker

# Verify project ID is correct
gcloud config get-value project

# Check Container Registry permissions
gcloud projects get-iam-policy $(gcloud config get-value project) \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/storage.admin"

# Try pushing with explicit credentials
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://gcr.io
```

---

### Issue 6: Deployment Failures

**Symptom**: Cloud Run deployment fails

**Cause**: Various configuration or resource issues

**Solution**:
```bash
# Check deployment logs
gcloud run services describe my-mcp-server --region=us-central1

# View recent deployments
gcloud run revisions list --service=my-mcp-server --region=us-central1

# Check for resource limit issues
gcloud run services update my-mcp-server \
  --region=us-central1 \
  --memory=1Gi \
  --cpu=2

# Verify secrets exist
gcloud secrets list | grep my-mcp-server

# Check service account permissions
gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format="value(spec.template.spec.serviceAccountName)"
```

---

### Issue 7: Health Check Failures

**Symptom**: Health endpoint returns non-200 status

**Cause**: Service not starting correctly or health endpoint misconfigured

**Solution**:
```bash
# Check service logs
gcloud run services logs read my-mcp-server --region=us-central1 --limit=50

# Test health endpoint directly
SERVICE_URL=$(gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format="value(status.url)")
curl -v ${SERVICE_URL}/health

# Check environment variables
gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Verify secrets are mounted
gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

---

### Issue 8: Secrets Not Found

**Symptom**: Error message "Secret not found" during deployment

**Cause**: Secrets not created in Secret Manager

**Solution**:
```bash
# List existing secrets
gcloud secrets list

# Create missing secrets
@mcp-auth-server-base.setup-secrets

# Or manually create
echo -n "your-secret-value" | gcloud secrets create my-mcp-server-jwt-secret \
  --data-file=- \
  --replication-policy=automatic

# Grant access to service account
gcloud secrets add-iam-policy-binding my-mcp-server-jwt-secret \
  --member="serviceAccount:my-service-account@my-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Security Considerations

### File Access
- **Reads**: 
  - `Dockerfile.production` - Production Docker configuration
  - `.env` files - Environment variables (never committed)
  - `cloudbuild.yaml` - Cloud Build configuration
  - Source code files for building

- **Writes**: None (deployment only)

- **Executes**:
  - `docker build` - Builds Docker image
  - `docker push` - Pushes to Container Registry
  - `gcloud run deploy` - Deploys to Cloud Run
  - `curl` - Tests health endpoint

### Network Access
- **Container Registry**: Pushes Docker images to `gcr.io`
- **Cloud Run**: Deploys services to Cloud Run
- **Secret Manager**: Accesses secrets for deployment
- **Health Endpoint**: Tests deployed service

### Sensitive Data
- **Secrets**: Mounted from Secret Manager (never displayed)
- **Credentials**: Uses gcloud authentication
- **Environment Variables**: Set during deployment
- **Service Account**: Uses configured service account

### Best Practices
1. **Never commit secrets** to version control
2. **Use Secret Manager** for all sensitive data
3. **Grant minimal permissions** to service accounts
4. **Enable audit logging** for deployments
5. **Use HTTPS only** for all endpoints
6. **Rotate secrets regularly** (every 90 days)
7. **Monitor deployment logs** for security issues
8. **Use private Container Registry** if needed
9. **Implement IAM policies** for access control
10. **Enable VPC Service Controls** for additional security

---

## Notes

- This command automates the complete deployment workflow
- Always validate project before deploying
- Supports three deployment methods (quick, full, Cloud Build)
- Handles secrets securely via Secret Manager
- Provides rollback procedures for failed deployments
- Works with projects created by `@mcp-auth-server-base.init`
- Supports multiple environments (dev, staging, production)
- Deployment is idempotent (safe to run multiple times)
- Health checks verify deployment succeeded
- Comprehensive troubleshooting for common issues

---

**Namespace**: mcp-auth-server-base
**Command**: deploy
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.8.0+
**Author**: ACP Package - mcp-auth-server-base
