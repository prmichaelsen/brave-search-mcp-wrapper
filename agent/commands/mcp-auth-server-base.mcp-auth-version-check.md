# Command: mcp-auth-version-check

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.mcp-auth-version-check` has been invoked. Follow the steps below to execute this command.

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Check current @prmichaelsen/mcp-auth version against latest available version
**Category**: Maintenance
**Frequency**: Periodically

---

## What This Command Does

This command checks if updates are available for the @prmichaelsen/mcp-auth library:

1. **Detects current version** from package.json
2. **Fetches latest version** from npm registry
3. **Compares versions** and shows update availability
4. **Displays changelog** for new versions
5. **Highlights breaking changes** if major version update

**Use this when**:
- Checking for library updates
- Planning upgrades
- Investigating new features
- Checking for security fixes

---

## Prerequisites

- [ ] Project initialized with package.json
- [ ] @prmichaelsen/mcp-auth installed
- [ ] Internet connection available
- [ ] npm or node available

---

## Steps

### 1. Detect Current Version

Read the current mcp-auth version from package.json.

**Actions**:
```bash
# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').dependencies['@prmichaelsen/mcp-auth']" 2>/dev/null || echo "not installed")

# Clean version (remove ^ or ~ prefix)
CURRENT_VERSION=$(echo $CURRENT_VERSION | sed 's/[\^~]//g')

echo "Current version: $CURRENT_VERSION"
```

**Expected Outcome**: Current version identified

**Troubleshooting**:
- If "not installed": Package not in dependencies
- If version has ^: Semantic versioning prefix (remove it)

### 2. Fetch Latest Version

Query npm registry for latest version.

**Actions**:
```bash
# Get latest version from npm
LATEST_VERSION=$(npm view @prmichaelsen/mcp-auth version 2>/dev/null || echo "unknown")

echo "Latest version: $LATEST_VERSION"
```

**Expected Outcome**: Latest version retrieved

**Troubleshooting**:
- If "unknown": Network error or package not found
- If timeout: npm registry slow, try again

### 3. Compare Versions

Compare current and latest versions.

**Actions**:
```bash
# Compare versions
if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo "✅ Up to date"
elif [ "$CURRENT_VERSION" = "not installed" ]; then
  echo "⚠️  Package not installed"
else
  echo "📦 Update available: $CURRENT_VERSION → $LATEST_VERSION"
  
  # Determine update type
  CURRENT_MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
  LATEST_MAJOR=$(echo $LATEST_VERSION | cut -d. -f1)
  
  if [ "$CURRENT_MAJOR" != "$LATEST_MAJOR" ]; then
    echo "⚠️  MAJOR version update (breaking changes possible)"
  else
    echo "✅ Minor/patch update (backward compatible)"
  fi
fi
```

**Expected Outcome**: Version comparison displayed

### 4. Display Changelog

Show relevant changelog entries for new versions.

**Actions**:
```bash
# Fetch changelog from npm or GitHub
npm view @prmichaelsen/mcp-auth --json | jq -r '.readme' | grep -A 20 "## \[$LATEST_VERSION\]"

# Or fetch from GitHub
curl -s https://raw.githubusercontent.com/prmichaelsen/mcp-auth/main/CHANGELOG.md | grep -A 20 "## \[$LATEST_VERSION\]"
```

**Expected Outcome**: Changelog displayed

**Format**:
```
## [2.0.0] - 2026-02-20

### Added
- New feature X
- New feature Y

### Changed
- BREAKING: Changed API for Z

### Fixed
- Bug fix A
```

### 5. Highlight Breaking Changes

If major version update, highlight breaking changes.

**Actions**:
```bash
# Extract breaking changes
BREAKING_CHANGES=$(curl -s https://raw.githubusercontent.com/prmichaelsen/mcp-auth/main/CHANGELOG.md | grep -A 50 "## \[$LATEST_VERSION\]" | grep -E "BREAKING|Breaking|breaking")

if [ -n "$BREAKING_CHANGES" ]; then
  echo ""
  echo "⚠️  BREAKING CHANGES DETECTED:"
  echo "$BREAKING_CHANGES"
  echo ""
  echo "Review migration guide before updating"
fi
```

**Expected Outcome**: Breaking changes highlighted

### 6. Display Update Command

Show command to update if update available.

**Actions**:
```
If update available:
  To update, run:
    @mcp-auth-server-base.mcp-auth-version-update

  Or manually:
    npm install @prmichaelsen/mcp-auth@latest
    npm install
```

**Expected Outcome**: Update instructions displayed

---

## Verification

- [ ] Current version detected
- [ ] Latest version fetched
- [ ] Versions compared
- [ ] Changelog displayed (if update available)
- [ ] Breaking changes highlighted (if major update)
- [ ] Update command shown (if update available)

---

## Expected Output

### When Up to Date

```
🔍 Checking @prmichaelsen/mcp-auth Version

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Version: 1.5.2
Latest Version:  1.5.2

✅ You are up to date!

No updates available.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### When Update Available (Minor/Patch)

```
🔍 Checking @prmichaelsen/mcp-auth Version

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Version: 1.5.2
Latest Version:  1.6.0

📦 Update Available!

Update Type: Minor (backward compatible)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changelog for 1.6.0:

## [1.6.0] - 2026-02-20

### Added
- New caching mechanism for auth providers
- Support for custom token extractors

### Fixed
- Memory leak in token validation
- CORS preflight handling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To update:
  @mcp-auth-server-base.mcp-auth-version-update

Or manually:
  npm install @prmichaelsen/mcp-auth@1.6.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### When Major Update Available

```
🔍 Checking @prmichaelsen/mcp-auth Version

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Version: 1.5.2
Latest Version:  2.0.0

📦 Update Available!

Update Type: ⚠️  MAJOR (breaking changes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changelog for 2.0.0:

## [2.0.0] - 2026-02-20

### Changed
- BREAKING: wrapServer API changed
  - Old: wrapServer(server, { authProvider })
  - New: wrapServer(server, { auth: { provider } })

- BREAKING: AuthProvider interface updated
  - authenticate() now returns Promise<AuthResult>
  - AuthResult includes userId and metadata

### Migration Guide
1. Update wrapServer calls to use new API
2. Update AuthProvider implementations
3. Update tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  BREAKING CHANGES DETECTED

This is a major version update with breaking changes.
Review the migration guide carefully before updating.

To update:
  @mcp-auth-server-base.mcp-auth-version-update

Migration Guide:
  https://github.com/prmichaelsen/mcp-auth/blob/main/MIGRATION.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Examples

### Example 1: Check When Up to Date

**Context**: Running periodic version check

**Invocation**: `@mcp-auth-server-base.mcp-auth-version-check`

**Result**:
```
Current: 1.5.2
Latest: 1.5.2
✅ Up to date
```

### Example 2: Minor Update Available

**Context**: New minor version released

**Invocation**: `@mcp-auth-server-base.mcp-auth-version-check`

**Result**:
```
Current: 1.5.2
Latest: 1.6.0
📦 Update available (minor)
Changelog: [shows new features and fixes]
Command: @mcp-auth-server-base.mcp-auth-version-update
```

### Example 3: Major Update with Breaking Changes

**Context**: Major version released

**Invocation**: `@mcp-auth-server-base.mcp-auth-version-check`

**Result**:
```
Current: 1.5.2
Latest: 2.0.0
⚠️  MAJOR update (breaking changes)
Breaking changes: [lists breaking changes]
Migration guide: [link to guide]
Warning: Review carefully before updating
```

---

## Troubleshooting

### Issue 1: Package not installed

**Symptom**: Error "@prmichaelsen/mcp-auth not found in package.json"

**Cause**: Package not installed

**Solution**:
```bash
# Install mcp-auth
npm install @prmichaelsen/mcp-auth

# Verify installation
npm list @prmichaelsen/mcp-auth
```

### Issue 2: Network error

**Symptom**: Error "Cannot fetch latest version"

**Cause**: No internet connection or npm registry unavailable

**Solution**:
```bash
# Check internet connection
ping registry.npmjs.org

# Try again later
# Or check manually: https://www.npmjs.com/package/@prmichaelsen/mcp-auth
```

### Issue 3: npm command not found

**Symptom**: Error "npm: command not found"

**Cause**: Node.js/npm not installed

**Solution**:
```bash
# Install Node.js (includes npm)
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS:
brew install node

# Verify:
node --version
npm --version
```

### Issue 4: Changelog not found

**Symptom**: Cannot fetch changelog

**Cause**: GitHub API rate limit or repository moved

**Solution**:
```bash
# Check manually on GitHub
open https://github.com/prmichaelsen/mcp-auth/blob/main/CHANGELOG.md

# Or on npm
npm view @prmichaelsen/mcp-auth
```

---

## Related Commands

- [`@mcp-auth-server-base.mcp-auth-version-update`](mcp-auth-server-base.mcp-auth-version-update.md) - Update to latest version
- [`@mcp-auth-server-base.validate`](mcp-auth-server-base.validate.md) - Validate after update
- [`@acp.version-check`](acp.version-check.md) - Check ACP version

---

## Related Patterns

- None (maintenance command)

---

## Notes

- **Read-only**: This command only checks, doesn't modify anything
- **Safe**: Can run anytime without side effects
- **Network**: Requires internet to fetch latest version
- **Changelog**: Fetched from GitHub or npm
- **Breaking Changes**: Automatically detected from major version bump
- **Recommendation**: Run periodically to stay current

---

**Namespace**: mcp-auth-server-base
**Command**: mcp-auth-version-check
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active
**Compatibility**: ACP 3.7.0+
**Author**: mcp-auth-server-base Package
