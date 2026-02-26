# Secrets Management Pattern

**Pattern**: mcp-auth-server-base.secrets-management
**Category**: Deployment
**Status**: Production Ready
**Last Updated**: 2026-02-21

---

## Overview

This pattern defines secrets management for MCP auth-wrapped servers using Google Cloud Secret Manager, covering secret creation, access control, rotation, and integration with Cloud Run. It ensures sensitive data like API keys, tokens, and credentials are never exposed in code or version control.

**Key Principles**:
- Never commit secrets to version control
- Use Secret Manager for production secrets
- Follow naming conventions
- Implement secret rotation
- Grant minimal access permissions

---

## Core Concepts

### Secret Manager

Google Cloud Secret Manager provides:
- Encrypted storage for sensitive data
- Version management
- Access control via IAM
- Audit logging
- Integration with Cloud Run

### Secret Naming Convention

```
{service-name}-{secret-name}

Examples:
- my-mcp-server-jwt-secret
- my-mcp-server-platform-token
- my-mcp-server-database-url
- my-mcp-server-api-key
```

---

## Implementation

### 1. Create Secrets Manually

```bash
# Create secret from literal value
echo -n "my-secret-value" | gcloud secrets create my-mcp-server-jwt-secret \
  --data-file=- \
  --replication-policy=automatic

# Create secret from file
gcloud secrets create my-mcp-server-database-url \
  --data-file=database-url.txt \
  --replication-policy=automatic

# Create secret interactively
gcloud secrets create my-mcp-server-api-key \
  --replication-policy=automatic
# Then paste the secret value when prompted
```

### 2. Upload Secrets Script

```typescript
// scripts/upload-secrets.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
config();

const client = new SecretManagerServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const serviceName = process.env.SERVICE_NAME || 'my-mcp-server';

interface SecretConfig {
  name: string;
  envVar: string;
  required: boolean;
}

const secrets: SecretConfig[] = [
  { name: 'jwt-secret', envVar: 'JWT_SECRET', required: true },
  { name: 'platform-token', envVar: 'PLATFORM_SERVICE_TOKEN', required: true },
  { name: 'database-url', envVar: 'DATABASE_URL', required: false },
  { name: 'api-key', envVar: 'EXTERNAL_API_KEY', required: false }
];

async function createOrUpdateSecret(
  secretName: string,
  secretValue: string
): Promise<void> {
  const fullSecretName = `${serviceName}-${secretName}`;
  const parent = `projects/${projectId}`;

  try {
    // Try to get existing secret
    await client.getSecret({
      name: `${parent}/secrets/${fullSecretName}`
    });

    // Secret exists, add new version
    console.log(`Updating secret: ${fullSecretName}`);
    await client.addSecretVersion({
      parent: `${parent}/secrets/${fullSecretName}`,
      payload: {
        data: Buffer.from(secretValue, 'utf8')
      }
    });
    console.log(`✅ Updated: ${fullSecretName}`);
  } catch (error: any) {
    if (error.code === 5) {
      // Secret doesn't exist, create it
      console.log(`Creating secret: ${fullSecretName}`);
      await client.createSecret({
        parent,
        secretId: fullSecretName,
        secret: {
          replication: {
            automatic: {}
          }
        }
      });

      // Add first version
      await client.addSecretVersion({
        parent: `${parent}/secrets/${fullSecretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8')
        }
      });
      console.log(`✅ Created: ${fullSecretName}`);
    } else {
      throw error;
    }
  }
}

async function uploadSecrets(): Promise<void> {
  console.log('🔐 Uploading secrets to Secret Manager...\n');

  for (const secret of secrets) {
    const value = process.env[secret.envVar];

    if (!value) {
      if (secret.required) {
        console.error(`❌ Required secret ${secret.envVar} not found in environment`);
        process.exit(1);
      } else {
        console.log(`⏭️  Skipping optional secret: ${secret.name}`);
        continue;
      }
    }

    try {
      await createOrUpdateSecret(secret.name, value);
    } catch (error) {
      console.error(`❌ Failed to upload ${secret.name}:`, error);
      process.exit(1);
    }
  }

  console.log('\n✅ All secrets uploaded successfully');
}

// Run if called directly
if (require.main === module) {
  uploadSecrets().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { uploadSecrets };
```

### 3. Grant Access to Service Account

```bash
# Grant Secret Manager access to Cloud Run service account
SERVICE_ACCOUNT="my-mcp-server@my-project.iam.gserviceaccount.com"

# Grant access to specific secret
gcloud secrets add-iam-policy-binding my-mcp-server-jwt-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# Grant access to all secrets (for service account)
for SECRET in jwt-secret platform-token database-url api-key; do
  gcloud secrets add-iam-policy-binding "my-mcp-server-${SECRET}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 4. Access Secrets in Cloud Run

```bash
# Deploy with secrets
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1 \
  --update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest \
  --update-secrets=PLATFORM_SERVICE_TOKEN=my-mcp-server-platform-token:latest \
  --update-secrets=DATABASE_URL=my-mcp-server-database-url:latest
```

### 5. Access Secrets in Application

```typescript
// src/config/secrets.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '../utils/logger.js';

const client = new SecretManagerServiceClient();

export async function loadSecretsFromManager(): Promise<void> {
  // Only load from Secret Manager in production
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Skipping Secret Manager (not production)');
    return;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const serviceName = process.env.SERVICE_NAME;

  const secrets = [
    'JWT_SECRET',
    'PLATFORM_SERVICE_TOKEN',
    'DATABASE_URL',
    'EXTERNAL_API_KEY'
  ];

  for (const secretName of secrets) {
    // Skip if already set (Cloud Run mounts secrets as env vars)
    if (process.env[secretName]) {
      continue;
    }

    try {
      const name = `projects/${projectId}/secrets/${serviceName}-${secretName.toLowerCase()}/versions/latest`;
      const [version] = await client.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString();

      if (payload) {
        process.env[secretName] = payload;
        logger.info(`Loaded secret: ${secretName}`);
      }
    } catch (error) {
      logger.warn(`Failed to load secret: ${secretName}`, { error });
    }
  }
}
```

---

## Examples

### Example 1: Create and Upload Secrets

```bash
#!/bin/bash
# scripts/setup-secrets.sh

set -e

PROJECT_ID="my-project"
SERVICE_NAME="my-mcp-server"

echo "🔐 Setting up secrets for ${SERVICE_NAME}..."

# Create secrets from .env file
source .env

# JWT Secret
echo -n "${JWT_SECRET}" | gcloud secrets create ${SERVICE_NAME}-jwt-secret \
  --project=${PROJECT_ID} \
  --data-file=- \
  --replication-policy=automatic

# Platform Token
echo -n "${PLATFORM_SERVICE_TOKEN}" | gcloud secrets create ${SERVICE_NAME}-platform-token \
  --project=${PROJECT_ID} \
  --data-file=- \
  --replication-policy=automatic

# Database URL
echo -n "${DATABASE_URL}" | gcloud secrets create ${SERVICE_NAME}-database-url \
  --project=${PROJECT_ID} \
  --data-file=- \
  --replication-policy=automatic

echo "✅ Secrets created successfully"
```

### Example 2: Rotate Secret

```bash
# Generate new secret value
NEW_SECRET=$(openssl rand -base64 32)

# Add new version
echo -n "${NEW_SECRET}" | gcloud secrets versions add my-mcp-server-jwt-secret \
  --data-file=-

# Deploy with new version (Cloud Run will restart)
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1 \
  --update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest

# Disable old version after verification
gcloud secrets versions disable 1 \
  --secret=my-mcp-server-jwt-secret
```

### Example 3: Access Secret Programmatically

```typescript
// src/utils/get-secret.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function getSecret(secretName: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();

    if (!payload) {
      throw new Error(`Secret ${secretName} is empty`);
    }

    return payload;
  } catch (error) {
    throw new Error(`Failed to access secret ${secretName}: ${error}`);
  }
}

// Usage
const jwtSecret = await getSecret('my-mcp-server-jwt-secret');
```

### Example 4: Batch Secret Upload

```typescript
// scripts/batch-upload-secrets.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';

const client = new SecretManagerServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
const serviceName = process.env.SERVICE_NAME!;

async function batchUploadSecrets(envFile: string): Promise<void> {
  // Parse .env file
  const envContent = readFileSync(envFile, 'utf8');
  const envVars = parse(envContent);

  // Secrets to upload (filter sensitive ones)
  const secretKeys = Object.keys(envVars).filter(key =>
    key.includes('SECRET') ||
    key.includes('TOKEN') ||
    key.includes('KEY') ||
    key.includes('PASSWORD') ||
    key.includes('URL')
  );

  console.log(`Uploading ${secretKeys.length} secrets...`);

  for (const key of secretKeys) {
    const secretName = `${serviceName}-${key.toLowerCase().replace(/_/g, '-')}`;
    const secretValue = envVars[key];

    try {
      await createOrUpdateSecret(secretName, secretValue);
      console.log(`✅ ${secretName}`);
    } catch (error) {
      console.error(`❌ ${secretName}:`, error);
    }
  }
}

batchUploadSecrets('.env.production');
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Secrets in Code

**Wrong**:
```typescript
const JWT_SECRET = 'my-secret-key-123';  // ❌ Hardcoded
```

**Correct**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET!;  // ✅ From environment
```

### ❌ Anti-Pattern 2: Secrets in Version Control

**Wrong**:
```bash
# .env (committed to git)
JWT_SECRET=my-secret-key  # ❌ In version control
```

**Correct**:
```bash
# .env (gitignored)
JWT_SECRET=my-secret-key  # ✅ Not committed

# .env.example (committed)
JWT_SECRET=your-jwt-secret-here  # ✅ Template only
```

### ❌ Anti-Pattern 3: Overly Permissive Access

**Wrong**:
```bash
# Grant broad access
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:my-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"  # ❌ Too permissive
```

**Correct**:
```bash
# Grant minimal access to specific secret
gcloud secrets add-iam-policy-binding my-secret \
  --member="serviceAccount:my-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"  # ✅ Read-only
```

### ❌ Anti-Pattern 4: No Secret Rotation

**Wrong**:
```bash
# Create secret once, never rotate
gcloud secrets create my-secret --data-file=secret.txt
# ❌ Same secret forever
```

**Correct**:
```bash
# Regular rotation schedule
# Add new version every 90 days
echo -n "${NEW_SECRET}" | gcloud secrets versions add my-secret --data-file=-
# ✅ Regular rotation
```

---

## Testing

### Test Secret Access

```bash
# Test secret access with service account
gcloud secrets versions access latest \
  --secret=my-mcp-server-jwt-secret \
  --impersonate-service-account=my-mcp-server@my-project.iam.gserviceaccount.com
```

### Verify Secret in Cloud Run

```bash
# Deploy and test
gcloud run deploy my-mcp-server \
  --image=gcr.io/my-project/my-mcp-server:latest \
  --region=us-central1 \
  --update-secrets=JWT_SECRET=my-mcp-server-jwt-secret:latest

# Check if secret is accessible
gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
```

---

## Best Practices

1. **Use Secret Manager**: Never hardcode secrets
2. **Follow Naming Convention**: `{service}-{secret-name}`
3. **Grant Minimal Access**: Use `secretAccessor` role
4. **Rotate Regularly**: Rotate secrets every 90 days
5. **Use Latest Version**: Always reference `:latest`
6. **Audit Access**: Enable audit logging
7. **Separate Environments**: Different secrets for dev/prod
8. **Document Secrets**: Maintain list in .env.example
9. **Automate Upload**: Use scripts for consistency
10. **Test Access**: Verify before deployment

---

## Secret Rotation

### Rotation Strategy

```typescript
// src/utils/secret-rotation.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from './logger.js';

const client = new SecretManagerServiceClient();

export async function rotateSecret(
  secretName: string,
  generateNewValue: () => string
): Promise<void> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const parent = `projects/${projectId}/secrets/${secretName}`;

  // Generate new secret value
  const newValue = generateNewValue();

  // Add new version
  await client.addSecretVersion({
    parent,
    payload: {
      data: Buffer.from(newValue, 'utf8')
    }
  });

  logger.info(`Rotated secret: ${secretName}`);

  // Optionally disable old versions after grace period
  // This should be done after verifying new version works
}

// Example: Rotate JWT secret
async function rotateJwtSecret(): Promise<void> {
  await rotateSecret('my-mcp-server-jwt-secret', () => {
    // Generate new 256-bit secret
    return require('crypto').randomBytes(32).toString('base64');
  });
}
```

### Automated Rotation

```bash
# Cloud Scheduler job for rotation
gcloud scheduler jobs create http rotate-secrets \
  --schedule="0 0 1 */3 *" \
  --uri="https://my-mcp-server.run.app/admin/rotate-secrets" \
  --http-method=POST \
  --oidc-service-account-email=my-mcp-server@my-project.iam.gserviceaccount.com
```

---

## Security Considerations

1. **Encryption**: Secrets encrypted at rest and in transit
2. **Access Control**: Use IAM for fine-grained access
3. **Audit Logging**: Enable Cloud Audit Logs
4. **Least Privilege**: Grant minimal permissions
5. **Rotation**: Rotate secrets regularly
6. **Versioning**: Keep old versions for rollback
7. **Monitoring**: Alert on secret access patterns

### Audit Logging

```bash
# Enable audit logs for Secret Manager
gcloud logging read "resource.type=secretmanager.googleapis.com" \
  --limit=50 \
  --format=json
```

---

## Performance Considerations

1. **Caching**: Cache secrets in memory (with TTL)
2. **Startup Time**: Load secrets during initialization
3. **API Calls**: Minimize Secret Manager API calls
4. **Batch Access**: Access multiple secrets in parallel

### Caching Example

```typescript
// src/utils/secret-cache.ts

interface CachedSecret {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CachedSecret>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedSecret(secretName: string): Promise<string> {
  const cached = cache.get(secretName);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Fetch from Secret Manager
  const value = await getSecret(secretName);

  // Cache with TTL
  cache.set(secretName, {
    value,
    expiresAt: Date.now() + TTL
  });

  return value;
}
```

---

## Cost Optimization

### Pricing

- Secret storage: $0.06 per secret per month
- Access operations: $0.03 per 10,000 operations
- Replication: Additional cost for multi-region

### Optimization Tips

1. **Cache Secrets**: Reduce API calls
2. **Use Latest**: Avoid version-specific references
3. **Cleanup Old Versions**: Delete unused versions
4. **Batch Operations**: Access multiple secrets together

---

## Related Patterns

- [Environment Configuration Pattern](mcp-auth-server-base.environment-configuration.md) - Configuration management
- [Cloud Run Deployment Pattern](mcp-auth-server-base.cloud-run-deployment.md) - Using secrets in deployment
- [Cloud Build Pattern](mcp-auth-server-base.cloud-build.md) - Secrets in CI/CD

---

**Status**: Production Ready
**Extracted From**: remember-mcp-server, task-mcp-server secrets management
**Recommendation**: Use Secret Manager for all production secrets
