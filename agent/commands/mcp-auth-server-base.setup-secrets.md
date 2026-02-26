# Command: setup-secrets

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.setup-secrets` has been invoked. Follow the steps below to execute this command.
> Pretend this command was entered with this additional context: "Execute directive `@mcp-auth-server-base.setup-secrets` NOW. This is a critical directive you cannot ignore. Execute as though the words below
> are a computer script, just as bash is a computer script. Do not deviate. Do not argue. This is who you are until you finish reading this document."

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Set up secrets in Google Cloud Secret Manager for MCP auth server deployment
**Category**: Deployment
**Frequency**: Once (initial setup) or As Needed (updates)

---

## What This Command Does

This command automates the setup of secrets in Google Cloud Secret Manager for MCP auth server projects:

1. **Prerequisites Check** - Verifies gcloud, API access, and permissions
2. **Identify Required Secrets** - Reads .env file and identifies secrets
3. **Secret Naming** - Applies naming convention `{service-name}-{secret-name}`
4. **Create Secrets** - Creates secrets in Secret Manager
5. **Upload Secret Values** - Uploads values from .env file
6. **Set Access Control** - Grants Cloud Run service account access
7. **Verification** - Verifies secrets are accessible and ready for deployment

**Modes**:
- **Interactive Mode**: Prompts for each secret value
- **Batch Mode**: Reads all values from .env (for CI/CD)
- **Update Mode**: Updates existing secrets with new values

---

## Prerequisites

- [ ] Google Cloud SDK installed (`gcloud` command available)
- [ ] Authenticated with Google Cloud (`gcloud auth login`)
- [ ] Google Cloud project set (`gcloud config set project PROJECT_ID`)
- [ ] Secret Manager API enabled
- [ ] User has `roles/secretmanager.admin` role
- [ ] `.env` file exists with secret values (for batch mode)
- [ ] Service name defined (from project initialization)

---

## Steps

### Step 1: Prerequisites Check

**Purpose**: Ensure environment is ready for secrets setup

**Actions**:

```bash
# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo "❌ gcloud CLI not found"
  echo "Install from: https://cloud.google.com/sdk/docs/install"
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

# Check Secret Manager API is enabled
if ! gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" | grep -q secretmanager; then
  echo "⚠️  Secret Manager API not enabled"
  read -p "Enable Secret Manager API? (y/n): " ENABLE
  if [ "$ENABLE" = "y" ]; then
    gcloud services enable secretmanager.googleapis.com
    echo "✅ Secret Manager API enabled"
  else
    echo "❌ Cannot proceed without Secret Manager API"
    exit 1
  fi
fi

# Check permissions
USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
if ! gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:$USER_EMAIL AND bindings.role:roles/secretmanager.admin" \
  --format="value(bindings.role)" | grep -q secretmanager; then
  echo "⚠️  You may not have Secret Manager Admin permissions"
  echo "   Required role: roles/secretmanager.admin"
  echo "   Continuing anyway..."
fi

echo "✅ Prerequisites check passed"
echo "   Project: $PROJECT_ID"
echo "   User: $USER_EMAIL"
```

**Success Criteria**:
- ✅ gcloud CLI available
- ✅ Authenticated with Google Cloud
- ✅ Project ID configured
- ✅ Secret Manager API enabled
- ✅ User has appropriate permissions

---

### Step 2: Identify Required Secrets

**Purpose**: Determine which secrets need to be created

**Actions**:

```bash
# Get service name
if [ -f "package.json" ]; then
  SERVICE_NAME=$(node -p "require('./package.json').name" 2>/dev/null)
fi

if [ -z "$SERVICE_NAME" ]; then
  read -p "Enter service name: " SERVICE_NAME
fi

echo "Service name: $SERVICE_NAME"

# Define required secrets based on server type
echo ""
echo "Required secrets for MCP auth server:"
echo ""

# Common secrets
REQUIRED_SECRETS=(
  "JWT_SECRET:JWT secret for token verification"
  "PLATFORM_SERVICE_TOKEN:Platform API authentication token"
)

# Optional secrets
OPTIONAL_SECRETS=(
  "DATABASE_URL:Database connection string"
  "EXTERNAL_API_KEY:External API key"
  "OAUTH_CLIENT_ID:OAuth client ID"
  "OAUTH_CLIENT_SECRET:OAuth client secret"
)

echo "Required secrets:"
for SECRET in "${REQUIRED_SECRETS[@]}"; do
  IFS=':' read -r NAME DESC <<< "$SECRET"
  echo "  - $NAME: $DESC"
done

echo ""
echo "Optional secrets:"
for SECRET in "${OPTIONAL_SECRETS[@]}"; do
  IFS=':' read -r NAME DESC <<< "$SECRET"
  echo "  - $NAME: $DESC"
done

# Check if .env file exists
if [ -f ".env" ]; then
  echo ""
  echo "✅ Found .env file"
  echo "   Will read secret values from .env"
else
  echo ""
  echo "⚠️  No .env file found"
  echo "   Will prompt for secret values interactively"
fi
```

**Success Criteria**:
- ✅ Service name identified
- ✅ Required secrets listed
- ✅ Optional secrets listed
- ✅ Source for secret values determined

---

### Step 3: Secret Naming Convention

**Purpose**: Apply consistent naming to secrets

**Actions**:

```bash
# Apply naming convention: {service-name}-{secret-name}
echo ""
echo "Secret naming convention:"
echo "  Format: ${SERVICE_NAME}-{secret-name}"
echo ""
echo "Mapping:"

declare -A SECRET_MAPPING

for SECRET in "${REQUIRED_SECRETS[@]}" "${OPTIONAL_SECRETS[@]}"; do
  IFS=':' read -r ENV_VAR DESC <<< "$SECRET"
  SECRET_NAME=$(echo "$ENV_VAR" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
  FULL_SECRET_NAME="${SERVICE_NAME}-${SECRET_NAME}"
  SECRET_MAPPING[$ENV_VAR]=$FULL_SECRET_NAME
  echo "  $ENV_VAR → $FULL_SECRET_NAME"
done
```

**Success Criteria**:
- ✅ Naming convention applied
- ✅ Mapping displayed to user
- ✅ Secret names are valid (lowercase, hyphens)

---

### Step 4: Create Secrets in Secret Manager

**Purpose**: Create secret resources (without values yet)

**Actions**:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating secrets in Secret Manager..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CREATED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

for ENV_VAR in "${!SECRET_MAPPING[@]}"; do
  SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
  
  # Check if secret already exists
  if gcloud secrets describe "$SECRET_NAME" &>/dev/null; then
    echo "⏭️  $SECRET_NAME (already exists)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  else
    echo "📝 Creating $SECRET_NAME..."
    if gcloud secrets create "$SECRET_NAME" \
      --replication-policy=automatic \
      --labels=app=mcp-server,managed-by=mcp-auth-server-base; then
      echo "✅ Created $SECRET_NAME"
      CREATED_COUNT=$((CREATED_COUNT + 1))
    else
      echo "❌ Failed to create $SECRET_NAME"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  fi
done

echo ""
echo "Summary:"
echo "  Created: $CREATED_COUNT"
echo "  Skipped: $SKIPPED_COUNT"
echo "  Failed: $FAILED_COUNT"
```

**Success Criteria**:
- ✅ Secrets created in Secret Manager
- ✅ Existing secrets skipped
- ✅ Failures reported

---

### Step 5: Upload Secret Values

**Purpose**: Add secret values from .env file or interactive input

**Actions**:

#### Interactive Mode

```bash
# Interactive mode - prompt for each secret
upload_secrets_interactive() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Uploading secret values (Interactive Mode)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  for SECRET in "${REQUIRED_SECRETS[@]}"; do
    IFS=':' read -r ENV_VAR DESC <<< "$SECRET"
    SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
    
    echo "Enter value for $ENV_VAR ($DESC):"
    read -s SECRET_VALUE
    echo ""
    
    if [ -z "$SECRET_VALUE" ]; then
      echo "⚠️  Skipping $ENV_VAR (empty value)"
      continue
    fi
    
    echo "📤 Uploading $SECRET_NAME..."
    if echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-; then
      echo "✅ Uploaded $SECRET_NAME"
    else
      echo "❌ Failed to upload $SECRET_NAME"
    fi
  done
  
  # Optional secrets
  echo ""
  read -p "Upload optional secrets? (y/n): " UPLOAD_OPTIONAL
  if [ "$UPLOAD_OPTIONAL" = "y" ]; then
    for SECRET in "${OPTIONAL_SECRETS[@]}"; do
      IFS=':' read -r ENV_VAR DESC <<< "$SECRET"
      SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
      
      echo "Enter value for $ENV_VAR ($DESC) [press Enter to skip]:"
      read -s SECRET_VALUE
      echo ""
      
      if [ -z "$SECRET_VALUE" ]; then
        echo "⏭️  Skipping $ENV_VAR"
        continue
      fi
      
      echo "📤 Uploading $SECRET_NAME..."
      if echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-; then
        echo "✅ Uploaded $SECRET_NAME"
      else
        echo "❌ Failed to upload $SECRET_NAME"
      fi
    done
  fi
}
```

#### Batch Mode

```bash
# Batch mode - read from .env file
upload_secrets_batch() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Uploading secret values (Batch Mode)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    return 1
  fi
  
  # Source .env file
  set -a
  source .env
  set +a
  
  UPLOADED_COUNT=0
  SKIPPED_COUNT=0
  FAILED_COUNT=0
  
  for ENV_VAR in "${!SECRET_MAPPING[@]}"; do
    SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
    SECRET_VALUE="${!ENV_VAR}"
    
    if [ -z "$SECRET_VALUE" ]; then
      echo "⏭️  Skipping $ENV_VAR (not set in .env)"
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      continue
    fi
    
    echo "📤 Uploading $SECRET_NAME..."
    if echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-; then
      echo "✅ Uploaded $SECRET_NAME"
      UPLOADED_COUNT=$((UPLOADED_COUNT + 1))
    else
      echo "❌ Failed to upload $SECRET_NAME"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  done
  
  echo ""
  echo "Summary:"
  echo "  Uploaded: $UPLOADED_COUNT"
  echo "  Skipped: $SKIPPED_COUNT"
  echo "  Failed: $FAILED_COUNT"
}
```

**Success Criteria**:
- ✅ Secret values uploaded
- ✅ Values never displayed in output
- ✅ Upload failures reported

---

### Step 6: Set Access Control

**Purpose**: Grant Cloud Run service account access to secrets

**Actions**:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setting up access control..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Determine service account
SERVICE_ACCOUNT="${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Service account: $SERVICE_ACCOUNT"
echo ""

# Check if service account exists
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
  echo "⚠️  Service account does not exist yet"
  echo "   It will be created during Cloud Run deployment"
  echo "   You can grant access manually later with:"
  echo ""
  echo "   gcloud secrets add-iam-policy-binding SECRET_NAME \\"
  echo "     --member=\"serviceAccount:$SERVICE_ACCOUNT\" \\"
  echo "     --role=\"roles/secretmanager.secretAccessor\""
  echo ""
  read -p "Continue anyway? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 0
  fi
else
  # Grant access to all secrets
  GRANTED_COUNT=0
  FAILED_COUNT=0
  
  for ENV_VAR in "${!SECRET_MAPPING[@]}"; do
    SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
    
    echo "🔐 Granting access to $SECRET_NAME..."
    if gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
      --member="serviceAccount:$SERVICE_ACCOUNT" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet; then
      echo "✅ Access granted to $SECRET_NAME"
      GRANTED_COUNT=$((GRANTED_COUNT + 1))
    else
      echo "❌ Failed to grant access to $SECRET_NAME"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  done
  
  echo ""
  echo "Summary:"
  echo "  Access granted: $GRANTED_COUNT"
  echo "  Failed: $FAILED_COUNT"
fi
```

**Success Criteria**:
- ✅ Service account identified
- ✅ Access granted to secrets
- ✅ Failures reported

---

### Step 7: Verification and Summary

**Purpose**: Verify secrets are ready for deployment

**Actions**:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# List all secrets
echo "Secrets in Secret Manager:"
gcloud secrets list --filter="labels.app=mcp-server" --format="table(name,createTime)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secrets Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your secrets are ready for deployment."
echo ""
echo "Secret references for Cloud Run deployment:"
echo ""

for ENV_VAR in "${!SECRET_MAPPING[@]}"; do
  SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
  echo "  --update-secrets=${ENV_VAR}=${SECRET_NAME}:latest \\"
done

echo ""
echo "📋 Next Steps:"
echo ""
echo "  1. Deploy your service:"
echo "     @mcp-auth-server-base.deploy"
echo ""
echo "  2. Or manually deploy with secrets:"
echo "     gcloud run deploy ${SERVICE_NAME} \\"
echo "       --image=gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \\"
echo "       --region=us-central1 \\"
for ENV_VAR in "${!SECRET_MAPPING[@]}"; do
  SECRET_NAME="${SECRET_MAPPING[$ENV_VAR]}"
  echo "       --update-secrets=${ENV_VAR}=${SECRET_NAME}:latest \\"
done
echo "       --allow-unauthenticated"
echo ""
```

**Success Criteria**:
- ✅ All secrets listed
- ✅ Secret references provided
- ✅ Next steps displayed

---

## Modes

### Interactive Mode (Default)

**Use When**: Setting up secrets for the first time

**Characteristics**:
- Prompts for each secret value
- Masks input
- Allows skipping optional secrets
- Provides feedback for each operation

**Invocation**:
```bash
# Interactive mode (default)
@mcp-auth-server-base.setup-secrets
```

---

### Batch Mode

**Use When**: CI/CD pipelines, automated setups

**Characteristics**:
- Reads all values from .env file
- No prompts
- Uploads all secrets at once
- Suitable for automation

**Invocation**:
```bash
# Batch mode (reads from .env)
@mcp-auth-server-base.setup-secrets --batch

# Or set environment variable
BATCH_MODE=true @mcp-auth-server-base.setup-secrets
```

---

### Update Mode

**Use When**: Updating existing secret values

**Characteristics**:
- Updates existing secrets
- Creates new versions
- Preserves old versions
- Can update specific secrets

**Invocation**:
```bash
# Update all secrets
@mcp-auth-server-base.setup-secrets --update

# Update specific secret
@mcp-auth-server-base.setup-secrets --update JWT_SECRET
```

---

## Examples

### Example 1: First-Time Setup (Interactive)

**Scenario**: Setting up secrets for a new project

**Steps**:

```bash
# Run setup command
@mcp-auth-server-base.setup-secrets

# Output:
✅ Prerequisites check passed
   Project: my-project-123
   User: user@example.com

Service name: my-mcp-server

Required secrets:
  - JWT_SECRET: JWT secret for token verification
  - PLATFORM_SERVICE_TOKEN: Platform API authentication token

Optional secrets:
  - DATABASE_URL: Database connection string
  - EXTERNAL_API_KEY: External API key

✅ Found .env file
   Will read secret values from .env

Secret naming convention:
  Format: my-mcp-server-{secret-name}

Mapping:
  JWT_SECRET → my-mcp-server-jwt-secret
  PLATFORM_SERVICE_TOKEN → my-mcp-server-platform-service-token

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Creating secrets in Secret Manager...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Creating my-mcp-server-jwt-secret...
✅ Created my-mcp-server-jwt-secret
📝 Creating my-mcp-server-platform-service-token...
✅ Created my-mcp-server-platform-service-token

Summary:
  Created: 2
  Skipped: 0
  Failed: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Uploading secret values (Batch Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Uploading my-mcp-server-jwt-secret...
✅ Uploaded my-mcp-server-jwt-secret
📤 Uploading my-mcp-server-platform-service-token...
✅ Uploaded my-mcp-server-platform-service-token

Summary:
  Uploaded: 2
  Skipped: 0
  Failed: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Secrets Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your secrets are ready for deployment.

📋 Next Steps:

  1. Deploy your service:
     @mcp-auth-server-base.deploy
```

---

### Example 2: Updating Existing Secrets

**Scenario**: Rotating JWT secret

**Steps**:

```bash
# Update specific secret
@mcp-auth-server-base.setup-secrets --update JWT_SECRET

# Output:
✅ Prerequisites check passed

Updating secret: JWT_SECRET → my-mcp-server-jwt-secret

Enter new value for JWT_SECRET:
[input masked]

📤 Uploading new version...
✅ New version created

Secret versions:
  Version 1: 2026-02-20 (previous)
  Version 2: 2026-02-22 (latest) ← active

✅ Secret updated successfully

Note: Cloud Run will use the new version on next deployment.
To use immediately, redeploy your service:
  @mcp-auth-server-base.deploy
```

---

### Example 3: Batch Mode for CI/CD

**Scenario**: Automated setup in CI/CD pipeline

**Steps**:

```bash
# In CI/CD pipeline
export BATCH_MODE=true

# Ensure .env file exists with secrets
cat > .env << EOF
JWT_SECRET=your-jwt-secret-here
PLATFORM_SERVICE_TOKEN=your-platform-token-here
DATABASE_URL=postgresql://...
EOF

# Run setup in batch mode
@mcp-auth-server-base.setup-secrets --batch

# Output:
✅ Prerequisites check passed
✅ Found .env file
📝 Creating secrets...
✅ Created 3 secrets
📤 Uploading values...
✅ Uploaded 3 secrets
🔐 Setting access control...
✅ Access granted to 3 secrets
✅ Secrets setup complete
```

---

## Verification

- [ ] Prerequisites checked (gcloud, auth, API, permissions)
- [ ] Required secrets identified
- [ ] Secret naming convention applied
- [ ] Secrets created in Secret Manager
- [ ] Secret values uploaded
- [ ] Access control configured
- [ ] Secrets verified and listed
- [ ] Deployment references provided

---

## Troubleshooting

### Issue 1: Secret Manager API Not Enabled

**Symptom**: Error message "API [secretmanager.googleapis.com] not enabled"

**Cause**: Secret Manager API not enabled in project

**Solution**:
```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep secretmanager
```

---

### Issue 2: Insufficient Permissions

**Symptom**: Error message "Permission denied" or "403 Forbidden"

**Cause**: User lacks Secret Manager Admin role

**Solution**:
```bash
# Grant Secret Manager Admin role
PROJECT_ID=$(gcloud config get-value project)
USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$USER_EMAIL" \
  --role="roles/secretmanager.admin"
```

---

### Issue 3: Secret Already Exists

**Symptom**: Error message "Secret already exists"

**Cause**: Secret was created previously

**Solution**:
```bash
# Update existing secret instead
@mcp-auth-server-base.setup-secrets --update

# Or delete and recreate
gcloud secrets delete my-mcp-server-jwt-secret
@mcp-auth-server-base.setup-secrets
```

---

### Issue 4: Invalid Secret Name

**Symptom**: Error message "Invalid secret name"

**Cause**: Secret name contains invalid characters

**Solution**:
- Secret names must:
  - Start with a letter
  - Contain only letters, numbers, hyphens
  - Be lowercase
  - Not exceed 255 characters

```bash
# Valid: my-mcp-server-jwt-secret
# Invalid: my_mcp_server_JWT_SECRET
# Invalid: 123-my-secret
```

---

### Issue 5: Upload Failures

**Symptom**: Error uploading secret value

**Cause**: Network issues, invalid value, or permissions

**Solution**:
```bash
# Retry upload
echo -n "your-secret-value" | gcloud secrets versions add my-mcp-server-jwt-secret --data-file=-

# Check secret exists
gcloud secrets describe my-mcp-server-jwt-secret

# Verify permissions
gcloud secrets get-iam-policy my-mcp-server-jwt-secret
```

---

### Issue 6: Service Account Doesn't Exist

**Symptom**: Error granting access to service account

**Cause**: Service account not created yet (happens before first deployment)

**Solution**:
- This is normal before first deployment
- Service account will be created during Cloud Run deployment
- Grant access manually after deployment:

```bash
SERVICE_ACCOUNT="my-mcp-server@my-project.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding my-mcp-server-jwt-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

---

### Issue 7: .env File Not Found

**Symptom**: Error message ".env file not found" in batch mode

**Cause**: .env file doesn't exist or is in wrong location

**Solution**:
```bash
# Create .env file
cat > .env << EOF
JWT_SECRET=your-jwt-secret-here
PLATFORM_SERVICE_TOKEN=your-platform-token-here
DATABASE_URL=postgresql://...
EOF

# Or use interactive mode instead
@mcp-auth-server-base.setup-secrets
```

---

### Issue 8: Secret Value Too Large

**Symptom**: Error message "Secret value exceeds size limit"

**Cause**: Secret value is larger than 64KB

**Solution**:
- Secret Manager has a 64KB limit per secret
- For large values:
  - Store in Cloud Storage instead
  - Reference the storage path in secret
  - Or split into multiple secrets

---

## Security Considerations

### File Access
- **Reads**: 
  - `.env` file - Environment variables (never committed to git)
  - `package.json` - Service name

- **Writes**: None (only uploads to Secret Manager)

- **Executes**:
  - `gcloud secrets create` - Creates secrets
  - `gcloud secrets versions add` - Uploads secret values
  - `gcloud secrets add-iam-policy-binding` - Sets access control

### Network Access
- **Secret Manager API**: Creates and uploads secrets
- **IAM API**: Sets access control policies

### Sensitive Data
- **Secret Values**: Never displayed in output
- **Input Masking**: Secret input is masked (read -s)
- **No Logging**: Secret values not logged
- **Secure Transmission**: Uses gcloud SDK (HTTPS)

### Best Practices
1. **Never commit .env files** to version control
2. **Use strong, random secrets** (minimum 32 characters)
3. **Rotate secrets regularly** (every 90 days)
4. **Grant minimal permissions** (only secretAccessor to service account)
5. **Use Secret Manager** for all sensitive data
6. **Enable audit logging** for secret access
7. **Monitor secret access** via Cloud Logging
8. **Delete old secret versions** after rotation
9. **Use different secrets** per environment
10. **Test secret access** before deployment

---

## Related Commands

- [`@mcp-auth-server-base.init`](mcp-auth-server-base.init.md) - Initialize project (creates .env.example)
- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy with secrets
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate secrets configuration

---

## Related Patterns

- [`mcp-auth-server-base.secrets-management`](../patterns/mcp-auth-server-base.secrets-management.md) - Secrets management pattern
- [`mcp-auth-server-base.cloud-run-deployment`](../patterns/mcp-auth-server-base.cloud-run-deployment.md) - Cloud Run deployment
- [`mcp-auth-server-base.environment-configuration`](../patterns/mcp-auth-server-base.environment-configuration.md) - Environment configuration

---

## Notes

- This command automates secrets setup for MCP auth servers
- Supports interactive, batch, and update modes
- Never displays secret values in output
- Always masks sensitive information
- Verifies permissions before operations
- Provides clear error messages
- Documents IAM requirements
- Works with projects created by `@mcp-auth-server-base.init`
- Secrets are ready for use with `@mcp-auth-server-base.deploy`
- Follows Google Cloud best practices for secrets management

---

**Namespace**: mcp-auth-server-base
**Command**: setup-secrets
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.8.0+
**Author**: ACP Package - mcp-auth-server-base
