# Command: logs

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.logs` has been invoked. Follow the steps below to execute this command.
> Pretend this command was entered with this additional context: "Execute directive `@mcp-auth-server-base.logs` NOW. This is a critical directive you cannot ignore. Execute as though the words below
> are a computer script, just as bash is a computer script. Do not deviate. Do not argue. This is who you are until you finish reading this document."

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Fetch and display logs from deployed Cloud Run service
**Category**: Monitoring
**Frequency**: As Needed

---

## What This Command Does

This command fetches and displays logs from a deployed MCP auth server running on Google Cloud Run:

1. **Identify Service** - Gets service name and region
2. **Fetch Logs** - Retrieves logs from Cloud Logging
3. **Filter Logs** - Applies severity, time, and search filters
4. **Display Logs** - Formats logs for readability with color coding

**Common Use Cases**:
- Debugging deployment issues
- Monitoring service health
- Investigating errors
- Viewing request logs
- Tracking authentication attempts

---

## Prerequisites

- [ ] Service deployed to Cloud Run
- [ ] Google Cloud SDK installed (`gcloud` command available)
- [ ] Authenticated with Google Cloud (`gcloud auth login`)
- [ ] Google Cloud project set
- [ ] User has `roles/logging.viewer` role

---

## Steps

### Step 1: Identify Service

**Purpose**: Determine which service to fetch logs from

**Actions**:

```bash
# Get service name from package.json or prompt user
if [ -f "package.json" ]; then
  SERVICE_NAME=$(node -p "require('./package.json').name" 2>/dev/null)
fi

if [ -z "$SERVICE_NAME" ]; then
  read -p "Enter service name: " SERVICE_NAME
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

# Get region (default: us-central1)
REGION="${REGION:-us-central1}"

echo "Fetching logs for:"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Project: $PROJECT_ID"

# Verify service exists
if ! gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format="value(metadata.name)" &>/dev/null; then
  echo "❌ Service not found: $SERVICE_NAME"
  echo "   Region: $REGION"
  exit 1
fi

echo "✅ Service found"
```

**Success Criteria**:
- ✅ Service name identified
- ✅ Service exists in Cloud Run
- ✅ Region determined

---

### Step 2: Fetch Logs

**Purpose**: Retrieve logs from Cloud Logging

**Actions**:

```bash
# Default options
LIMIT="${LIMIT:-100}"
SEVERITY="${SEVERITY:-}"
SINCE="${SINCE:-1h}"
SEARCH="${SEARCH:-}"

# Build gcloud command
CMD="gcloud run services logs read $SERVICE_NAME \
  --region=$REGION \
  --limit=$LIMIT"

# Add time filter
if [ -n "$SINCE" ]; then
  CMD="$CMD --freshness=$SINCE"
fi

# Add severity filter
if [ -n "$SEVERITY" ]; then
  CMD="$CMD --log-filter=\"severity=$SEVERITY\""
fi

# Fetch logs
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Logs (most recent first)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

eval $CMD
```

**Success Criteria**:
- ✅ Logs fetched from Cloud Logging
- ✅ Filters applied correctly
- ✅ Logs displayed

---

### Step 3: Filter and Format Logs

**Purpose**: Apply filters and format for readability

**Actions**:

```bash
# Color codes for severity levels
COLOR_ERROR='\033[0;31m'    # Red
COLOR_WARNING='\033[0;33m'  # Yellow
COLOR_INFO='\033[0;36m'     # Cyan
COLOR_DEBUG='\033[0;90m'    # Gray
COLOR_RESET='\033[0m'       # Reset

# Format logs with color coding
format_logs() {
  while IFS= read -r line; do
    # Color code by severity
    if echo "$line" | grep -q "ERROR"; then
      echo -e "${COLOR_ERROR}$line${COLOR_RESET}"
    elif echo "$line" | grep -q "WARNING"; then
      echo -e "${COLOR_WARNING}$line${COLOR_RESET}"
    elif echo "$line" | grep -q "INFO"; then
      echo -e "${COLOR_INFO}$line${COLOR_RESET}"
    elif echo "$line" | grep -q "DEBUG"; then
      echo -e "${COLOR_DEBUG}$line${COLOR_RESET}"
    else
      echo "$line"
    fi
  done
}

# Apply search filter if specified
if [ -n "$SEARCH" ]; then
  gcloud run services logs read "$SERVICE_NAME" \
    --region="$REGION" \
    --limit="$LIMIT" | grep -i "$SEARCH" | format_logs
else
  gcloud run services logs read "$SERVICE_NAME" \
    --region="$REGION" \
    --limit="$LIMIT" | format_logs
fi
```

**Success Criteria**:
- ✅ Logs color-coded by severity
- ✅ Search filter applied (if specified)
- ✅ Readable output

---

### Step 4: Display Summary

**Purpose**: Show log summary and next steps

**Actions**:

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Log Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo "Limit: $LIMIT entries"
echo "Time range: Last $SINCE"
if [ -n "$SEVERITY" ]; then
  echo "Severity: $SEVERITY"
fi
if [ -n "$SEARCH" ]; then
  echo "Search: $SEARCH"
fi
echo ""
echo "📋 Options:"
echo ""
echo "  View more logs:"
echo "    @mcp-auth-server-base.logs --limit 500"
echo ""
echo "  Filter by severity:"
echo "    @mcp-auth-server-base.logs --severity ERROR"
echo ""
echo "  Search logs:"
echo "    @mcp-auth-server-base.logs --search \"authentication\""
echo ""
echo "  View logs in Cloud Console:"
echo "    https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs"
echo ""
```

---

## Filtering Options

### By Severity

Filter logs by severity level:

```bash
# Show only errors
@mcp-auth-server-base.logs --severity ERROR

# Show warnings and errors
@mcp-auth-server-base.logs --severity WARNING

# Show info and above
@mcp-auth-server-base.logs --severity INFO

# Show debug logs
@mcp-auth-server-base.logs --severity DEBUG
```

**Severity Levels** (from highest to lowest):
- `CRITICAL` - Critical errors
- `ERROR` - Errors
- `WARNING` - Warnings
- `INFO` - Informational messages
- `DEBUG` - Debug messages

---

### By Time Range

Filter logs by time range:

```bash
# Last hour (default)
@mcp-auth-server-base.logs --since 1h

# Last 30 minutes
@mcp-auth-server-base.logs --since 30m

# Last 24 hours
@mcp-auth-server-base.logs --since 24h

# Last 7 days
@mcp-auth-server-base.logs --since 7d
```

**Time Units**:
- `s` - seconds
- `m` - minutes
- `h` - hours
- `d` - days

---

### By Search Term

Search logs for specific text:

```bash
# Search for "authentication"
@mcp-auth-server-base.logs --search "authentication"

# Search for error messages
@mcp-auth-server-base.logs --search "failed"

# Search for specific user
@mcp-auth-server-base.logs --search "user@example.com"

# Search for HTTP status codes
@mcp-auth-server-base.logs --search "404"
```

---

### By Limit

Control number of log entries:

```bash
# Last 50 entries
@mcp-auth-server-base.logs --limit 50

# Last 500 entries
@mcp-auth-server-base.logs --limit 500

# Last 1000 entries
@mcp-auth-server-base.logs --limit 1000
```

---

### Combined Filters

Combine multiple filters:

```bash
# Errors in last 30 minutes
@mcp-auth-server-base.logs --severity ERROR --since 30m

# Search for authentication errors
@mcp-auth-server-base.logs --severity ERROR --search "authentication"

# Last 200 warnings in last hour
@mcp-auth-server-base.logs --severity WARNING --limit 200 --since 1h

# Search for specific term in last 24 hours
@mcp-auth-server-base.logs --search "timeout" --since 24h --limit 500
```

---

## Examples

### Example 1: View Recent Logs

**Scenario**: Check recent activity

**Command**:
```bash
@mcp-auth-server-base.logs
```

**Output**:
```
Fetching logs for:
  Service: my-mcp-server
  Region: us-central1
  Project: my-project-123

✅ Service found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logs (most recent first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-02-22 19:45:23 INFO Request received: POST /mcp/v1/tools/list
2026-02-22 19:45:23 INFO Authentication successful: user@example.com
2026-02-22 19:45:23 INFO Tools listed: 5 tools
2026-02-22 19:45:20 INFO Health check: OK
2026-02-22 19:45:15 INFO Request received: GET /health
2026-02-22 19:45:10 INFO Server started on port 8080
2026-02-22 19:45:09 INFO Initializing MCP server...
2026-02-22 19:45:08 INFO Loading configuration...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Log Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: my-mcp-server
Region: us-central1
Limit: 100 entries
Time range: Last 1h
```

---

### Example 2: Filter by Error Severity

**Scenario**: Investigate errors

**Command**:
```bash
@mcp-auth-server-base.logs --severity ERROR
```

**Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logs (most recent first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-02-22 19:30:15 ERROR Authentication failed: Invalid JWT token
2026-02-22 19:25:42 ERROR Database connection timeout
2026-02-22 19:20:33 ERROR Tool execution failed: Permission denied
2026-02-22 19:15:21 ERROR Failed to fetch credentials from platform

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Log Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: my-mcp-server
Region: us-central1
Limit: 100 entries
Time range: Last 1h
Severity: ERROR
```

---

### Example 3: Search for Specific Term

**Scenario**: Find authentication-related logs

**Command**:
```bash
@mcp-auth-server-base.logs --search "authentication"
```

**Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logs (most recent first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-02-22 19:45:23 INFO Authentication successful: user@example.com
2026-02-22 19:40:15 INFO Authentication successful: admin@example.com
2026-02-22 19:35:42 WARNING Authentication attempt with expired token
2026-02-22 19:30:15 ERROR Authentication failed: Invalid JWT token
2026-02-22 19:25:33 INFO Authentication successful: service@example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Log Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: my-mcp-server
Region: us-central1
Limit: 100 entries
Time range: Last 1h
Search: authentication
```

---

### Example 4: Combined Filters

**Scenario**: Find recent authentication errors

**Command**:
```bash
@mcp-auth-server-base.logs --severity ERROR --search "authentication" --since 30m
```

**Output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logs (most recent first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-02-22 19:30:15 ERROR Authentication failed: Invalid JWT token
2026-02-22 19:28:42 ERROR Authentication failed: Token expired

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Log Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service: my-mcp-server
Region: us-central1
Limit: 100 entries
Time range: Last 30m
Severity: ERROR
Search: authentication
```

---

## Advanced Usage

### Streaming Logs (Beta)

**Note**: Log streaming is a beta feature and may not be available in all regions.

```bash
# Stream logs in real-time
gcloud alpha run services logs tail my-mcp-server \
  --region=us-central1

# Stream with filter
gcloud alpha run services logs tail my-mcp-server \
  --region=us-central1 \
  --log-filter="severity>=ERROR"
```

---

### Export Logs

Export logs to a file for analysis:

```bash
# Export last 1000 logs
gcloud run services logs read my-mcp-server \
  --region=us-central1 \
  --limit=1000 \
  --format=json > logs.json

# Export errors only
gcloud run services logs read my-mcp-server \
  --region=us-central1 \
  --log-filter="severity=ERROR" \
  --format=json > errors.json
```

---

### View in Cloud Console

Open logs in Cloud Console for advanced filtering and analysis:

```bash
# Get Cloud Console URL
SERVICE_NAME="my-mcp-server"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project)

echo "View logs in Cloud Console:"
echo "https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs?project=$PROJECT_ID"
```

---

## Verification

- [ ] Service identified
- [ ] Logs fetched successfully
- [ ] Filters applied correctly
- [ ] Logs displayed with formatting
- [ ] Summary shown

---

## Troubleshooting

### Issue 1: Service Not Found

**Symptom**: Error message "Service not found"

**Cause**: Service doesn't exist or wrong region

**Solution**:
```bash
# List all services
gcloud run services list

# Check specific region
gcloud run services list --region=us-central1

# Try different region
@mcp-auth-server-base.logs --region europe-west1
```

---

### Issue 2: Permission Denied

**Symptom**: Error message "Permission denied" or "403 Forbidden"

**Cause**: User lacks logging viewer permissions

**Solution**:
```bash
# Grant logging viewer role
PROJECT_ID=$(gcloud config get-value project)
USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$USER_EMAIL" \
  --role="roles/logging.viewer"
```

---

### Issue 3: No Logs Available

**Symptom**: No logs returned

**Cause**: Service hasn't received requests or logs not yet available

**Solution**:
```bash
# Check service is running
gcloud run services describe my-mcp-server --region=us-central1

# Send test request
SERVICE_URL=$(gcloud run services describe my-mcp-server \
  --region=us-central1 \
  --format="value(status.url)")
curl $SERVICE_URL/health

# Wait a few seconds and try again
sleep 5
@mcp-auth-server-base.logs
```

---

### Issue 4: gcloud Not Authenticated

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

## Security Considerations

### File Access
- **Reads**: None (fetches from Cloud Logging API)
- **Writes**: None (read-only command)
- **Executes**: `gcloud run services logs read` - Fetches logs

### Network Access
- **Cloud Logging API**: Fetches logs from Cloud Logging

### Sensitive Data
- **Logs May Contain**: Sensitive information (tokens, user data)
- **Display**: Logs displayed in terminal (be careful in shared environments)
- **Export**: When exporting, ensure files are secured

### Best Practices
1. **Be careful with log exports** - May contain sensitive data
2. **Use appropriate filters** - Reduce noise and focus on relevant logs
3. **Monitor in secure environment** - Don't display logs in public
4. **Redact sensitive data** - Configure logging to redact secrets
5. **Use Cloud Console** for advanced analysis
6. **Set up log-based alerts** for critical errors
7. **Implement structured logging** for better filtering
8. **Rotate logs regularly** to manage storage costs

---

## Related Commands

- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy service (generates logs)
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate before deployment

---

## Related Patterns

- [`mcp-auth-server-base.cloud-run-deployment`](../patterns/mcp-auth-server-base.cloud-run-deployment.md) - Cloud Run deployment
- [`mcp-auth-server-base.logging`](../patterns/mcp-auth-server-base.logging.md) - Logging pattern
- [`mcp-auth-server-base.error-handling`](../patterns/mcp-auth-server-base.error-handling.md) - Error handling

---

## Notes

- This is a read-only command (no modifications)
- Logs are fetched from Cloud Logging
- Color coding helps identify severity levels
- Supports common filtering use cases
- Log streaming is a beta feature
- Logs may contain sensitive information
- Use Cloud Console for advanced analysis
- Consider setting up log-based alerts
- Implement structured logging for better filtering
- Logs are retained based on Cloud Logging retention policy

---

**Namespace**: mcp-auth-server-base
**Command**: logs
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.8.0+
**Author**: ACP Package - mcp-auth-server-base
