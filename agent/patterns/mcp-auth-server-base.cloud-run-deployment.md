# Cloud Run Deployment Pattern

**Pattern**: mcp-auth-server-base.cloud-run-deployment
**Category**: Deployment
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines Google Cloud Run deployment configuration for MCP auth-wrapped servers, covering service configuration, scaling, resource allocation, networking, and monitoring. Cloud Run provides serverless container deployment with automatic scaling and pay-per-use pricing.

**Key Principles**:
- Serverless container deployment
- Automatic scaling (0 to N instances)
- Pay only for actual usage
- HTTPS endpoints by default
- Integrated with Cloud Logging and Monitoring

---

## Core Concepts

### Cloud Run Service

A Cloud Run service is a containerized application that:
- Scales automatically based on traffic
- Scales to zero when not in use
- Provides HTTPS endpoints
- Integrates with IAM for authentication
- Supports custom domains

### Scaling Behavior

```
Traffic → Cloud Run → Instances
  0 req  →    0 instances (scale to zero)
  1 req  →    1 instance  (cold start)
100 req  →    5 instances (auto-scale)
  0 req  →    0 instances (scale down)
```

---

## Implementation

### 1. Basic Deployment

```bash
# Deploy to Cloud Run
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated
```

### 2. Complete Deployment Configuration

```bash
# Deploy with full configuration
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:v1.0.0 \
  --region=us-central1 \
  --platform=managed \
  \
  # Access control
  --allow-unauthenticated \
  \
  # Resource limits
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  \
  # Scaling
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  \
  # Environment variables
  --set-env-vars=NODE_ENV=production,PORT=8080 \
  \
  # Secrets from Secret Manager
  --update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest \
  --update-secrets=DATABASE_URL=my-mcp-server-database-url:latest \
  \
  # Labels
  --labels=app=mcp-server,env=production \
  \
  # Service account
  --service-account=my-mcp-server@my-project.iam.gserviceaccount.com
```

### 3. YAML Service Configuration

```yaml
# service.yaml

apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-mcp-server
  labels:
    app: mcp-server
    env: production
spec:
  template:
    metadata:
      annotations:
        # Scaling
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        # CPU allocation
        run.googleapis.com/cpu-throttling: "true"
        # Startup probe
        run.googleapis.com/startup-cpu-boost: "true"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 60
      serviceAccountName: my-mcp-server@my-project.iam.gserviceaccount.com
      
      containers:
      - image: gcr.io/my-project/my-mcp-server:v1.0.0
        ports:
        - name: http1
          containerPort: 8080
        
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "8080"
        - name: SERVICE_NAME
          value: my-mcp-server
        
        # Secrets from Secret Manager
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: my-mcp-server-jwt-secret
              key: latest
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: my-mcp-server-database-url
              key: latest
        
        resources:
          limits:
            memory: 512Mi
            cpu: "1"
        
        # Liveness probe
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        
        # Startup probe
        startupProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 0
          periodSeconds: 1
          timeoutSeconds: 3
          failureThreshold: 30

  traffic:
  - percent: 100
    latestRevision: true
```

### 4. Deploy from YAML

```bash
# Deploy using YAML configuration
gcloud run services replace service.yaml \
  --region=us-central1 \
  --platform=managed
```

### 5. Multi-Region Deployment

```bash
#!/bin/bash
# scripts/deploy-multi-region.sh

REGIONS=("us-central1" "europe-west1" "asia-east1")
SERVICE_NAME="my-mcp-server"
IMAGE="gcr.io/my-project/${SERVICE_NAME}:latest"

for REGION in "${REGIONS[@]}"; do
  echo "Deploying to ${REGION}..."
  gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE} \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=10
done

echo "✅ Deployed to all regions"
```

---

## Examples

### Example 1: Development Deployment

```bash
# Deploy development version
gcloud run deploy my-mcp-server-dev \
  --image=gcr.io/my-project/my-mcp-server:dev \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars=NODE_ENV=development,LOG_LEVEL=debug
```

### Example 2: Production with Custom Domain

```bash
# Deploy production with custom domain
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:v1.0.0 \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10

# Map custom domain
gcloud run domain-mappings create \
  --service=my-mcp-server \
  --domain=mcp.example.com \
  --region=us-central1
```

### Example 3: Authenticated Service

```bash
# Deploy with IAM authentication
gcloud run deploy my-mcp-server-private \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1 \
  --platform=managed \
  --no-allow-unauthenticated \
  --memory=512Mi

# Grant access to specific service account
gcloud run services add-iam-policy-binding my-mcp-server-private \
  --region=us-central1 \
  --member=serviceAccount:client@my-project.iam.gserviceaccount.com \
  --role=roles/run.invoker
```

### Example 4: Blue-Green Deployment

```bash
# Deploy new version without traffic
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:v2.0.0 \
  --region=us-central1 \
  --platform=managed \
  --no-traffic \
  --tag=v2

# Test new version at: https://v2---my-mcp-server-xxx.run.app

# Gradually shift traffic
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-revisions=LATEST=10,v1=90

# Full cutover
gcloud run services update-traffic my-mcp-server \
  --region=us-central1 \
  --to-latest
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: No Resource Limits

**Wrong**:
```bash
gcloud run deploy my-app \
  --image=gcr.io/my-project/my-app
  # ❌ No memory/CPU limits
```

**Correct**:
```bash
gcloud run deploy my-app \
  --image=gcr.io/my-project/my-app \
  --memory=512Mi \
  --cpu=1  # ✅ Explicit limits
```

### ❌ Anti-Pattern 2: Hardcoded Secrets

**Wrong**:
```bash
gcloud run deploy my-app \
  --set-env-vars=JWT_SECRET=my-secret-key  # ❌ Secret exposed
```

**Correct**:
```bash
gcloud run deploy my-app \
  --update-secrets=JWT_SECRET=my-app-jwt-secret:latest  # ✅ From Secret Manager
```

### ❌ Anti-Pattern 3: No Min Instances for Production

**Wrong**:
```bash
# Production service with cold starts
gcloud run deploy my-app \
  --min-instances=0  # ❌ Cold starts on every request
```

**Correct**:
```bash
# Production service with warm instances
gcloud run deploy my-app \
  --min-instances=1  # ✅ Always warm
  --max-instances=10
```

### ❌ Anti-Pattern 4: Allowing Unauthenticated for Internal Services

**Wrong**:
```bash
# Internal service exposed publicly
gcloud run deploy internal-api \
  --allow-unauthenticated  # ❌ Public access
```

**Correct**:
```bash
# Internal service with IAM
gcloud run deploy internal-api \
  --no-allow-unauthenticated  # ✅ IAM required
```

---

## Testing

### Test Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format='value(status.url)')

# Test health endpoint
curl ${SERVICE_URL}/health

# Test with authentication
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  ${SERVICE_URL}/api/data
```

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Load test
ab -n 1000 -c 10 ${SERVICE_URL}/health

# Or use hey
hey -n 1000 -c 10 ${SERVICE_URL}/health
```

### Monitor Deployment

```bash
# Watch logs
gcloud run services logs read my-mcp-server \
  --region=us-central1 \
  --limit=50 \
  --format=json

# Stream logs
gcloud run services logs tail my-mcp-server \
  --region=us-central1
```

---

## Best Practices

1. **Set Resource Limits**: Always specify memory and CPU
2. **Use Secrets Manager**: Never hardcode secrets
3. **Enable Health Checks**: Implement /health endpoint
4. **Set Appropriate Timeout**: Match your longest request
5. **Use Min Instances**: Keep 1+ warm for production
6. **Tag Revisions**: Use tags for testing new versions
7. **Monitor Metrics**: Watch latency, errors, and costs
8. **Use Service Accounts**: Grant minimal permissions
9. **Enable Logging**: Use structured logging
10. **Set Concurrency**: Tune based on your workload

---

## Scaling Configuration

### Concurrency

```bash
# Set concurrent requests per instance
gcloud run deploy my-app \
  --concurrency=80  # Default: 80, Max: 1000
```

**Guidelines**:
- CPU-bound: 10-50
- I/O-bound: 80-200
- Stateless: 200-1000

### Instance Scaling

```bash
# Configure scaling
gcloud run deploy my-app \
  --min-instances=1 \    # Warm instances
  --max-instances=100    # Scale limit
```

**Cost vs Performance**:
- `min=0`: Lowest cost, cold starts
- `min=1`: Balanced, no cold starts
- `min=3+`: High availability, higher cost

### CPU Allocation

```bash
# CPU always allocated (default)
gcloud run deploy my-app \
  --cpu=1 \
  --cpu-throttling

# CPU only during requests (cheaper)
gcloud run deploy my-app \
  --cpu=1 \
  --no-cpu-throttling
```

---

## Monitoring and Observability

### Cloud Monitoring Metrics

```bash
# View metrics in Cloud Console
# Metrics available:
- request_count
- request_latencies
- billable_instance_time
- container/cpu/utilization
- container/memory/utilization
```

### Custom Metrics

```typescript
// src/monitoring/metrics.ts

import { MetricServiceClient } from '@google-cloud/monitoring';

const client = new MetricServiceClient();

export async function recordCustomMetric(
  metricType: string,
  value: number
): Promise<void> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const projectPath = client.projectPath(projectId);

  const dataPoint = {
    interval: {
      endTime: {
        seconds: Date.now() / 1000
      }
    },
    value: {
      doubleValue: value
    }
  };

  const timeSeries = {
    metric: {
      type: `custom.googleapis.com/${metricType}`
    },
    resource: {
      type: 'cloud_run_revision',
      labels: {
        project_id: projectId,
        service_name: process.env.K_SERVICE,
        revision_name: process.env.K_REVISION
      }
    },
    points: [dataPoint]
  };

  await client.createTimeSeries({
    name: projectPath,
    timeSeries: [timeSeries]
  });
}
```

### Alerts

```bash
# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

---

## Performance Considerations

1. **Cold Start Time**: 1-3 seconds for Node.js
2. **Request Latency**: Add 100-200ms for cold starts
3. **Memory**: More memory = faster CPU
4. **Concurrency**: Higher = better utilization
5. **Region**: Deploy close to users

### Optimization Tips

```bash
# Faster cold starts
--memory=512Mi \           # More memory = faster CPU
--cpu=1 \                  # Dedicated CPU
--startup-cpu-boost=true   # Extra CPU during startup
```

---

## Security Considerations

1. **IAM**: Use service accounts with minimal permissions
2. **Secrets**: Store in Secret Manager
3. **HTTPS**: Enabled by default
4. **VPC**: Use VPC connector for private resources
5. **Binary Authorization**: Enforce signed images

### VPC Connector

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create my-connector \
  --region=us-central1 \
  --range=10.8.0.0/28

# Deploy with VPC access
gcloud run deploy my-app \
  --vpc-connector=my-connector \
  --vpc-egress=private-ranges-only
```

---

## Cost Optimization

### Pricing Model

```
Cost = (CPU time × CPU price) + (Memory time × Memory price) + (Requests × Request price)
```

### Optimization Strategies

1. **Scale to Zero**: Use `--min-instances=0` for dev/staging
2. **Right-Size Resources**: Don't over-provision
3. **CPU Throttling**: Enable for I/O-bound workloads
4. **Reduce Cold Starts**: Use `--min-instances=1` only when needed
5. **Monitor Usage**: Track billable instance time

---

## Related Patterns

- [Docker Multi-Stage Pattern](mcp-auth-server-base.docker-multistage.md) - Building images for Cloud Run
- [Cloud Build Pattern](mcp-auth-server-base.cloud-build.md) - Automated deployment
- [Secrets Management Pattern](mcp-auth-server-base.secrets-management.md) - Managing secrets
- [Health Check Pattern](mcp-auth-server-base.health-check.md) - Health endpoints

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server Cloud Run deployments
**Recommendation**: Use Cloud Run for serverless MCP server deployment
