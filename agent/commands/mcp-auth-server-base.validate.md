# Command: validate

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.validate` has been invoked. Follow the steps below to execute this command.
> Pretend this command was entered with this additional context: "Execute directive `@mcp-auth-server-base.validate` NOW. This is a critical directive you cannot ignore. Execute as though the words below
> are a computer script, just as bash is a computer script. Do not deviate. Do not argue. This is who you are until you finish reading this document."

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Validate MCP auth server project using hybrid automated + LLM-assisted approach
**Category**: Quality Assurance
**Frequency**: After init, before deploy, during development

---

## Arguments

**CLI-Style Arguments** (optional):
- `--level <quick|standard|full>` - Validation level (default: quick)
- `--skip-tests` - Skip test execution (faster validation)
- `--skip-docker` - Skip Docker validation
- `--verbose` or `-v` - Show detailed output

**Natural Language Arguments**:
- `@mcp-auth-server-base.validate quick` - Run quick validation
- `@mcp-auth-server-base.validate full` - Run full validation including Docker
- `@mcp-auth-server-base.validate standard --verbose` - Standard with detailed output
- `@mcp-auth-server-base.validate full --skip-docker` - Full validation without Docker

**Argument Mapping**:
The agent infers validation level and options from context. Keywords like "quick", "standard", "full", "verbose", "skip tests", "skip docker" are automatically detected and mapped to appropriate script flags.

---

## What This Command Does

The `@mcp-auth-server-base.validate` command uses a **hybrid validation approach** combining automated script checks with LLM-assisted security analysis:

**Automated Validation** (via [`agent/scripts/mcp-auth-server-base.validate.sh`](../scripts/mcp-auth-server-base.validate.sh)):
- File structure and dependencies (60+ checks)
- Configuration syntax validation
- TypeScript compilation
- Build process and tests
- Docker and Cloud Build configuration
- npm security audit

**LLM-Assisted Analysis** (your role as agent):
- Deep security review of authentication logic
- Context-aware vulnerability assessment
- Logic flaw detection that automated tools miss
- Nuanced risk analysis of npm audit results
- Custom remediation recommendations
- Security best practices guidance

This hybrid approach leverages the strengths of both: scripts for fast, deterministic checks; LLMs for deep, context-aware analysis that understands business logic and security implications.

**Validation Levels**:

1. **Quick** (~30s): Files, deps, config, TypeScript
2. **Standard** (~2-3m): Quick + build + tests + LLM security review
3. **Full** (~5-10m): Standard + Docker + comprehensive LLM analysis

---

## Prerequisites

- [ ] MCP auth server project initialized (via `@mcp-auth-server-base.init`)
- [ ] Node.js installed (v18+)
- [ ] npm or yarn package manager
- [ ] (Optional) Docker for full validation
- [ ] Running from project root directory

---

## Steps

### Step 1: Determine Validation Level

**Actions**:
1. Check user's message for validation level keywords: "quick", "standard", "full"
2. Check for flags: `--skip-tests`, `--skip-docker`, `--verbose`
3. Default to **Quick** if not specified
4. Confirm with user if ambiguous

**Validation Levels**:

| Level | Duration | Automated Checks | LLM Analysis | Use Case |
|-------|----------|------------------|--------------|----------|
| Quick | ~30s | Files, deps, config, TS | Basic review | Rapid dev feedback |
| Standard | ~2-3m | Quick + build + tests | Security review | Pre-commit |
| Full | ~5-10m | Standard + Docker | Deep analysis | Pre-deployment |

**Expected Outcome**: Validation level determined

---

### Step 2: Execute Validation Script

**Actions**:
1. Navigate to project root (if not already there)
2. Execute validation script with appropriate level and flags:

```bash
# Quick validation (default)
./agent/scripts/mcp-auth-server-base.validate.sh quick

# Standard validation
./agent/scripts/mcp-auth-server-base.validate.sh standard

# Full validation
./agent/scripts/mcp-auth-server-base.validate.sh full

# With flags
./agent/scripts/mcp-auth-server-base.validate.sh standard --verbose
./agent/scripts/mcp-auth-server-base.validate.sh full --skip-docker
```

3. Capture script output and exit code:
   - Exit 0 = Success (all checks passed)
   - Exit 1 = Failure (critical issues)
   - Exit 2 = Warning (non-critical issues)

**What the Script Does**:
The validation script performs 60+ automated checks across 10 categories:
- File Structure (18 checks)
- Dependencies (7 checks)
- Configuration Files (8 checks)
- Environment Variables (7 checks)
- TypeScript Compilation
- Build Process (standard/full)
- Tests (standard/full)
- Authentication Configuration
- Docker Configuration (full only)
- Cloud Build Configuration (full only)

The script provides color-coded output, comprehensive reports, and automatic remediation suggestions.

**Expected Outcome**: Script executed, results captured

---

### Step 3: Analyze Script Results

**Actions**:
1. Review the validation summary from script output
2. Identify critical failures (red ✗)
3. Identify warnings (yellow ⚠)
4. Note informational messages (blue ℹ)
5. Extract key metrics:
   - Total checks performed
   - Checks passed/failed/warned
   - Success rate percentage

**What to Look For**:

**Critical Failures** (block deployment):
- Missing required files or dependencies
- TypeScript compilation errors
- Build failures
- Test failures
- .env not in .gitignore (security risk)
- Missing auth configuration

**Warnings** (should address):
- Placeholder values in .env
- Weak JWT secrets
- Missing optional files
- Docker configuration issues
- Test coverage below threshold

**Expected Outcome**: Clear understanding of automated check results

---

### Step 4: Perform LLM-Assisted Security Review

**Purpose**: Use your LLM capabilities to perform deep security analysis that automated tools cannot detect

**This is where YOU add unique value beyond the script!**

#### 4.1 Review Authentication Implementation

**Actions**:
1. Read [`src/index.ts`](src/index.ts) and auth provider files
2. Analyze JWT validation logic for vulnerabilities:
   - Algorithm confusion attacks (accepting "none" algorithm)
   - Missing token expiration checks
   - Improper signature verification
   - Timing attack vulnerabilities in token comparison
3. Check error handling (no information leakage)
4. Verify proper token caching and invalidation

**Example Analysis**:
```typescript
// Read the auth provider implementation
// Look for patterns like:

// ❌ BAD: Accepts any algorithm
jwt.verify(token, secret);

// ✅ GOOD: Specifies allowed algorithms
jwt.verify(token, secret, { algorithms: ['HS256'] });

// ❌ BAD: No expiration check
const payload = jwt.decode(token);

// ✅ GOOD: Verifies expiration
jwt.verify(token, secret, { maxAge: '1h' });
```

#### 4.2 Review Authorization Logic

**Actions**:
1. Analyze how user permissions are checked
2. Look for privilege escalation vulnerabilities
3. Check for insecure direct object references
4. Verify proper user isolation in multi-tenant scenarios
5. Review token resolver logic (if dynamic server)

**Example Issues to Detect**:
- User A can access User B's data by changing IDs
- Missing authorization checks on sensitive operations
- Improper user context propagation
- Race conditions in credential fetching

#### 4.3 Review Secret Management

**Actions**:
1. Search source code for hardcoded secrets:
   ```bash
   # Look for patterns like:
   grep -r "password.*=.*['\"]" src/
   grep -r "api[_-]key.*=.*['\"]" src/
   grep -r "secret.*=.*['\"]" src/
   ```

2. Check for secrets in comments or debug code
3. Verify secrets are loaded from environment variables
4. Check for secrets in error messages or logs
5. Confirm .env is in .gitignore (script checks this, but verify)

**Example Issues**:
```typescript
// ❌ BAD: Hardcoded secret
const secret = "my-secret-key-12345";

// ✅ GOOD: From environment
const secret = process.env.JWT_SECRET;

// ❌ BAD: Secret in error message
throw new Error(`Auth failed with key: ${apiKey}`);

// ✅ GOOD: No secret exposure
throw new Error('Authentication failed');
```

#### 4.4 Review Input Validation

**Actions**:
1. Check for SQL injection vulnerabilities (if using database)
2. Look for command injection risks
3. Verify proper sanitization of user inputs
4. Check for path traversal vulnerabilities
5. Analyze for XSS risks in any output

**Example Patterns to Flag**:
```typescript
// ❌ BAD: SQL injection risk
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ GOOD: Parameterized query
db.query('SELECT * FROM users WHERE id = ?', [userId]);

// ❌ BAD: Command injection risk
exec(`ls ${userInput}`);

// ✅ GOOD: Validated input
if (!/^[a-zA-Z0-9_-]+$/.test(userInput)) throw new Error('Invalid input');
```

#### 4.5 Analyze npm Audit Results

**Actions**:
1. Review npm audit output from script (if full validation)
2. For each vulnerability, assess:
   - Is the vulnerable code path actually used?
   - Is it exploitable in this specific context?
   - What's the actual risk level?
3. Provide nuanced recommendations beyond `npm audit fix`

**Example Nuanced Analysis**:
```
npm audit reports:
- lodash: Prototype Pollution (High)

LLM Analysis:
✅ Low actual risk: lodash is only used in build scripts, not in 
   runtime code. Not exploitable in production deployment.
   
Recommendation: Update lodash in next maintenance cycle, but not 
blocking for deployment.

vs.

- jsonwebtoken: Algorithm confusion (Critical)

LLM Analysis:
❌ High actual risk: jsonwebtoken is used for authentication in 
   production. This vulnerability allows attackers to bypass 
   authentication by using "none" algorithm.
   
Recommendation: IMMEDIATE UPDATE REQUIRED. Block deployment until 
fixed. Update to jsonwebtoken@9.0.0+ which fixes this issue.
```

#### 4.6 Review Error Handling

**Actions**:
1. Check for information disclosure in error messages
2. Verify errors don't expose stack traces in production
3. Look for unhandled promise rejections
4. Check for proper logging without sensitive data

**Example Issues**:
```typescript
// ❌ BAD: Exposes internal details
catch (err) {
  res.status(500).json({ error: err.stack });
}

// ✅ GOOD: Generic error in production
catch (err) {
  logger.error(err); // Log internally
  res.status(500).json({ error: 'Internal server error' });
}
```

#### 4.7 Generate Security Report

**Actions**:
Create a comprehensive security report with your findings:

```
🔒 LLM-Assisted Security Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Authentication Security:
✅ JWT validation properly implemented with algorithm whitelist
✅ Token expiration checked (1 hour max age)
✅ Strong secret (64 characters, properly randomized)
⚠️  Consider adding token refresh mechanism for long-lived sessions
⚠️  Token caching lacks invalidation on user logout

Authorization Security:
✅ User isolation properly implemented via userId in JWT
✅ No privilege escalation paths found
❌ CRITICAL: Missing authorization check in DELETE /data/:id endpoint
   → Any authenticated user can delete any data by changing ID

Secret Management:
✅ No hardcoded secrets found in source code
✅ .env properly excluded from git
✅ Secrets loaded from environment variables
⚠️  JWT_SECRET should be rotated regularly (add to ops runbook)

Input Validation:
✅ User inputs properly sanitized
✅ No SQL injection vulnerabilities (using parameterized queries)
⚠️  Path parameter in GET /files/:path not validated
   → Potential path traversal vulnerability

Error Handling:
✅ No sensitive data in error messages
✅ Stack traces disabled in production (NODE_ENV check)
✅ Proper error logging without secrets

npm Audit Analysis:
✅ 3 moderate vulnerabilities in dev dependencies
   → Not exploitable in production (build-time only)
   → Safe to deploy, update in next maintenance cycle
⚠️  1 high vulnerability in axios@0.21.1
   → Used in platform API calls, exploitable
   → Update to axios@1.6.0+ before deployment

Docker Security:
✅ Running as non-root user (USER node)
✅ Minimal Alpine base image
✅ No secrets in Dockerfile
✅ Multi-stage build reduces attack surface

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIORITY FIXES (before deployment):

1. CRITICAL: Add authorization check to DELETE /data/:id
   File: src/index.ts:145
   Fix: Verify req.user.id === data.userId before deletion
   
2. HIGH: Update axios to 1.6.0+
   Command: npm install axios@latest
   
3. MEDIUM: Validate path parameter in GET /files/:path
   Fix: Add path.normalize() and check for '..' sequences

RECOMMENDED IMPROVEMENTS:

1. Implement token refresh mechanism
2. Add token invalidation on logout
3. Set up JWT secret rotation schedule
4. Add rate limiting to prevent brute force
5. Implement audit logging for security events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Outcome**: Comprehensive security analysis with actionable recommendations

---

### Step 5: Provide Consolidated Report

**Actions**:
1. Combine automated check results with LLM security analysis
2. Prioritize issues by severity:
   - **Critical**: Blocks deployment, immediate fix required
   - **High**: Should fix before deployment
   - **Medium**: Fix soon, document if deploying
   - **Low**: Address in next maintenance cycle
3. Provide specific remediation steps with code examples
4. Link to relevant patterns and documentation

**Report Format**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MCP Auth Server Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: my-mcp-server
Validation Level: standard
Date: 2026-02-22 19:22:00 UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTOMATED CHECKS (via script):

✅ File Structure (18/18 passed)
✅ Dependencies (7/7 passed)
✅ Configuration (8/8 passed)
⚠️  Environment (5/7 passed - 2 warnings)
✅ TypeScript (0 errors)
✅ Build (successful)
✅ Tests (15/15 passing, 87% coverage)
✅ Authentication Config (6/6 passed)

Automated Success Rate: 95% (67/69 checks passed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LLM SECURITY ANALYSIS:

❌ 1 Critical Issue Found
⚠️  3 High Priority Issues
ℹ️  5 Recommended Improvements

[Include detailed security report from Step 4.7]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEPLOYMENT READINESS:

❌ NOT READY FOR DEPLOYMENT

Critical issues must be fixed:
1. Missing authorization check in DELETE endpoint
2. Vulnerable axios version

Estimated fix time: 30 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:

1. Fix critical authorization issue:
   
   // In src/index.ts:145
   app.delete('/data/:id', async (req, res) => {
     const data = await db.getData(req.params.id);
     
     // Add this check:
     if (data.userId !== req.user.id) {
       return res.status(403).json({ error: 'Forbidden' });
     }
     
     await db.deleteData(req.params.id);
     res.status(204).send();
   });

2. Update axios:
   npm install axios@latest

3. Re-run validation:
   @mcp-auth-server-base.validate standard

4. Deploy when validation passes:
   @mcp-auth-server-base.deploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Outcome**: User has complete understanding of project health and clear action items

---

### Step 6: Suggest Next Actions

**Actions**:
Based on validation results, suggest appropriate next steps:

**If All Checks Passed**:
```
✅ Validation Complete - Project Ready!

Your MCP auth server passed all automated checks and security review.

Next steps:
  • Start development: npm run dev
  • Deploy to Cloud Run: @mcp-auth-server-base.deploy
  • View deployment logs: @mcp-auth-server-base.logs
```

**If Warnings Only**:
```
⚠️  Validation Passed with Warnings

Your project is functional but has non-critical issues.

Next steps:
  • Address warnings (see report above)
  • Re-run validation: @mcp-auth-server-base.validate
  • Deploy when ready: @mcp-auth-server-base.deploy
```

**If Critical Failures**:
```
❌ Validation Failed - Fix Required

Critical issues prevent deployment.

Next steps:
  • Fix critical issues (see priority fixes above)
  • Re-run validation: @mcp-auth-server-base.validate
  • Review patterns: agent/patterns/mcp-auth-server-base.*.md
```

**Expected Outcome**: User knows exactly what to do next

---

## Verification

- [ ] Validation script executed successfully
- [ ] Script results analyzed and understood
- [ ] LLM security review performed
- [ ] Security report generated with specific findings
- [ ] Issues prioritized by severity
- [ ] Remediation steps provided with code examples
- [ ] Consolidated report presented
- [ ] Next steps suggested
- [ ] User has clear action items

---

## Examples

### Example 1: Quick Validation During Development

**Context**: Developer made changes and wants rapid feedback

**Invocation**: `@mcp-auth-server-base.validate`

**Result**: 
- Script runs quick validation (~30s)
- Agent reviews results
- Reports: "All checks passed, no security concerns in changes"
- Suggests: "Continue development or run standard validation before commit"

---

### Example 2: Standard Validation Before Commit

**Context**: Ready to commit code, want thorough validation

**Invocation**: `@mcp-auth-server-base.validate standard`

**Result**:
- Script runs standard validation (~2-3m) including build and tests
- Agent performs security review of authentication code
- Finds: Placeholder JWT_SECRET, weak token expiration
- Provides: Specific fixes with code examples
- Suggests: "Fix issues then re-validate before committing"

---

### Example 3: Full Validation Before Production Deploy

**Context**: Preparing for production deployment

**Invocation**: `@mcp-auth-server-base.validate full`

**Result**:
- Script runs full validation (~5-10m) including Docker and security audit
- Agent performs comprehensive security analysis
- Finds: Critical authorization bug, vulnerable dependency
- Provides: Detailed remediation with priority ordering
- Blocks: "NOT READY - fix critical issues before deployment"

---

### Example 4: Validation with Verbose Output

**Context**: Validation failed, need detailed debugging info

**Invocation**: `@mcp-auth-server-base.validate standard --verbose`

**Result**:
- Script shows detailed output for all checks
- Agent analyzes verbose TypeScript errors
- Identifies: Missing type definitions causing compilation failure
- Provides: Exact commands to install missing @types packages
- Suggests: "Run npm install --save-dev @types/node @types/jest"

---

## Related Commands

- [`@mcp-auth-server-base.init`](mcp-auth-server-base.init.md) - Initialize project (run before validate)
- [`@mcp-auth-server-base.deploy`](mcp-auth-server-base.deploy.md) - Deploy to Cloud Run (run after validate passes)
- [`@mcp-auth-server-base.setup-secrets`](mcp-auth-server-base.setup-secrets.md) - Configure production secrets
- [`@mcp-auth-server-base.generate-dockerfile`](mcp-auth-server-base.generate-dockerfile.md) - Regenerate Docker files
- [`@mcp-auth-server-base.generate-cloudbuild`](mcp-auth-server-base.generate-cloudbuild.md) - Regenerate Cloud Build config

---

## Troubleshooting

### Issue 1: Script Permission Denied

**Symptom**: "Permission denied" when running validation script

**Cause**: Script not executable

**Solution**:
```bash
chmod +x agent/scripts/mcp-auth-server-base.validate.sh
./agent/scripts/mcp-auth-server-base.validate.sh quick
```

---

### Issue 2: Script Not Found

**Symptom**: "No such file or directory"

**Cause**: Running from wrong directory or script not installed

**Solution**:
```bash
# Ensure you're in project root
pwd

# Check if script exists
ls -la agent/scripts/mcp-auth-server-base.validate.sh

# If missing, reinstall package
@acp.package-install mcp-auth-server-base
```

---

### Issue 3: Many Validation Failures

**Symptom**: 20+ checks failing

**Cause**: Project not properly initialized or dependencies not installed

**Solution**:
```bash
# Reinstall dependencies
npm install

# If still failing, reinitialize project
@mcp-auth-server-base.init
```

---

### Issue 4: TypeScript Errors

**Symptom**: TypeScript compilation fails with type errors

**Cause**: Missing type definitions or actual code errors

**Solution**:
```bash
# Install common type definitions
npm install --save-dev @types/node @types/jest

# Run TypeScript to see detailed errors
npx tsc --noEmit

# Fix errors in source code based on messages
```

---

### Issue 5: Test Failures

**Symptom**: Tests fail during standard/full validation

**Cause**: Test code errors or outdated snapshots

**Solution**:
```bash
# Run tests with verbose output
npm test -- --verbose

# Update snapshots if needed
npm test -- -u

# Debug specific test
npm test -- src/failing-test.test.ts --watch
```

---

### Issue 6: Docker Build Fails

**Symptom**: Docker validation fails during full validation

**Cause**: Docker not running, Dockerfile errors, or build issues

**Solution**:
```bash
# Check Docker is running
docker info

# Regenerate Dockerfiles
@mcp-auth-server-base.generate-dockerfile

# Try manual build to see detailed errors
docker build -f Dockerfile.production .
```

---

### Issue 7: False Positive Security Warnings

**Symptom**: LLM flags code as vulnerable but it's actually safe

**Cause**: LLM lacks full context or misunderstands code

**Solution**:
- Provide additional context to LLM about why code is safe
- Add code comments explaining security considerations
- Document security decisions in design docs
- If truly safe, proceed with deployment but document reasoning

---

### Issue 8: npm Audit Shows Vulnerabilities

**Symptom**: Script reports security vulnerabilities from npm audit

**Cause**: Dependencies have known vulnerabilities

**Solution**:
```bash
# View detailed audit report
npm audit

# Attempt automatic fix
npm audit fix

# For unfixable issues, assess actual risk with LLM analysis
# LLM will determine if vulnerability is exploitable in your context
```

---

### Issue 9: Environment Variable Warnings

**Symptom**: Warnings about placeholder values in .env

**Cause**: Using example values instead of real secrets

**Solution**:
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env with real values
nano .env

# For production, use secrets management
@mcp-auth-server-base.setup-secrets
```

---

## Security Considerations

### Automated Script
- **Reads**: All project files (package.json, src/, etc.)
- **Writes**: None (read-only validation)
- **Executes**: npm commands, TypeScript compiler, build/test commands
- **Secrets**: Checks for .env existence and placeholders but NEVER reads or displays actual secret values

### LLM Analysis
- **Reads**: Source code files for security analysis
- **Analyzes**: Authentication logic, authorization patterns, input validation
- **Provides**: Security recommendations and remediation steps
- **Secrets**: May see code that loads secrets but should never display actual secret values in reports

**Security Note**: Both the script and LLM analysis are designed to be safe and non-destructive. They only read files and execute read-only commands. Neither will display actual secret values - they only check that secrets are properly configured.

---

## Notes

- **Hybrid Approach**: Combines fast automated checks with deep LLM analysis
- **Non-Destructive**: Validation is completely read-only
- **Color-Coded Output**: Script provides easy-to-scan results
- **Exit Codes**: 0 (success), 1 (critical failure), 2 (warnings)
- **LLM Value-Add**: Security analysis that understands context and business logic
- **Actionable**: Every issue includes specific remediation steps
- **Iterative**: Run validation frequently during development
- **Pre-Deployment**: Always run full validation before production deployment

---

**Namespace**: mcp-auth-server-base
**Command**: validate
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 1.1.0+
**Author**: ACP MCP Auth Server Base Package
