# Command: mcp-auth-version-update

> **🤖 Agent Directive**: If you are reading this file, the command `@mcp-auth-server-base.mcp-auth-version-update` has been invoked. Follow the steps below to execute this command.

**Namespace**: mcp-auth-server-base
**Version**: 1.0.0
**Created**: 2026-02-22
**Last Updated**: 2026-02-22
**Status**: Active

---

**Purpose**: Update @prmichaelsen/mcp-auth to the latest version with migration support
**Category**: Maintenance
**Frequency**: When Updates Available

---

## What This Command Does

This command updates the @prmichaelsen/mcp-auth library to the latest version:

1. **Checks current version** and latest version
2. **Updates package.json** with new version
3. **Runs npm install** to install update
4. **Shows migration guide** if breaking changes
5. **Verifies update** succeeded

**Use this when**:
- `@mcp-auth-server-base.mcp-auth-version-check` reports update available
- Wanting to get latest features
- Fixing security vulnerabilities
- Staying current with library

---

## Prerequisites

- [ ] Project initialized with package.json
- [ ] @prmichaelsen/mcp-auth installed
- [ ] Internet connection available
- [ ] Changes committed (recommended for easy rollback)

---

## Steps

### 1. Run Version Check

Check what version update is available.

**Actions**:
```bash
# Run version check first
@mcp-auth-server-base.mcp-auth-version-check
```

**Expected Outcome**: Update availability confirmed

### 2. Backup Current Version

Record current version for rollback.

**Actions**:
```bash
# Save current version
CURRENT_VERSION=$(node -p "require('./package.json').dependencies['@prmichaelsen/mcp-auth']")
echo "Current version: $CURRENT_VERSION"

# Recommend git commit
git status
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Uncommitted changes detected. Recommend committing first for easy rollback."
fi
```

**Expected Outcome**: Current version saved

### 3. Update package.json

Update the version in package.json.

**Actions**:
```bash
# Update to latest
npm install @prmichaelsen/mcp-auth@latest

# Or update to specific version
npm install @prmichaelsen/mcp-auth@2.0.0
```

**Expected Outcome**: package.json updated

**Verification**:
```bash
# Verify new version
NEW_VERSION=$(node -p "require('./package.json').dependencies['@prmichaelsen/mcp-auth']")
echo "Updated to: $NEW_VERSION"
```

### 4. Check for Breaking Changes

If major version update, display migration guide.

**Actions**:
```bash
# Determine if major update
CURRENT_MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1 | sed 's/[\^~]//g')
NEW_MAJOR=$(echo $NEW_VERSION | cut -d. -f1 | sed 's/[\^~]//g')

if [ "$CURRENT_MAJOR" != "$NEW_MAJOR" ]; then
  echo "⚠️  MAJOR VERSION UPDATE"
  echo "Breaking changes may require code updates"
  
  # Fetch migration guide
  curl -s https://raw.githubusercontent.com/prmichaelsen/mcp-auth/main/MIGRATION.md
fi
```

**Expected Outcome**: Migration guide displayed (if major update)

### 5. Update Code (if needed)

For breaking changes, guide user through code updates.

**Actions**:
Based on breaking changes, provide update instructions:

**Example: API Change**
```
Breaking Change: wrapServer API changed

Old Code:
  wrapServer(server, { authProvider })

New Code:
  wrapServer(server, { auth: { provider: authProvider } })

Files to Update:
  • src/index.ts

Would you like me to update these files automatically? (y/n)
```

**If yes**: Update files automatically
**If no**: Show manual update instructions

**Expected Outcome**: Code updated or instructions provided

### 6. Verify Update

Verify the update succeeded and code still works.

**Actions**:
```bash
# Type check
npm run type-check

# Build
npm run build

# Run tests
npm test || true
```

**Expected Outcome**: Verification passed

### 7. Display Summary

Show what was updated and next steps.

**Actions**:
```
✅ Update Complete

Version: 1.5.2 → 2.0.0

Files Modified:
  ✓ package.json (version updated)
  ✓ package-lock.json (dependencies updated)
  ✓ src/index.ts (API updated for breaking changes)

Verification:
  ✓ TypeScript compiles
  ✓ Build succeeds
  ✓ Tests pass

Next Steps:
  1. Test locally:
     npm run dev

  2. Run validation:
     @mcp-auth-server-base.validate

  3. Deploy updated version:
     @mcp-auth-server-base.deploy

  4. Monitor for issues:
     @mcp-auth-server-base.logs
```

**Expected Outcome**: Summary displayed

---

## Verification

- [ ] Version check run
- [ ] Current version backed up
- [ ] package.json updated
- [ ] npm install completed
- [ ] Breaking changes handled
- [ ] Code updated (if needed)
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] Tests pass

---

## Expected Output

### Minor/Patch Update

```
🔄 Updating @prmichaelsen/mcp-auth

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Version Check

Current: 1.5.2
Latest:  1.6.0
Type:    Minor (backward compatible)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2: Updating package.json

✓ Running npm install @prmichaelsen/mcp-auth@1.6.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3: Verifying Update

✓ TypeScript compiles
✓ Build succeeds
✓ Tests pass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Update Complete!

Version: 1.5.2 → 1.6.0

Next: Test locally and redeploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Major Update with Breaking Changes

```
🔄 Updating @prmichaelsen/mcp-auth

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Version Check

Current: 1.5.2
Latest:  2.0.0
Type:    ⚠️  MAJOR (breaking changes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2: Updating package.json

✓ Running npm install @prmichaelsen/mcp-auth@2.0.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3: Handling Breaking Changes

⚠️  Breaking Change Detected:

wrapServer API changed:
  Old: wrapServer(server, { authProvider })
  New: wrapServer(server, { auth: { provider: authProvider } })

Files to Update:
  • src/index.ts

Update automatically? (y/n): y

✓ Updated src/index.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 4: Verifying Update

✓ TypeScript compiles
✓ Build succeeds
✓ Tests pass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Update Complete!

Version: 1.5.2 → 2.0.0

Files Modified:
  ✓ package.json
  ✓ package-lock.json
  ✓ src/index.ts (API updated)

Next Steps:
  1. Test thoroughly locally
  2. Run full validation
  3. Deploy to staging first
  4. Monitor for issues

Migration Guide:
  https://github.com/prmichaelsen/mcp-auth/blob/main/MIGRATION.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Verification

- [ ] Version check run
- [ ] package.json updated
- [ ] npm install completed
- [ ] Breaking changes handled
- [ ] Code updated
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] Tests pass

---

**Next Task**: task-21-test-all-commands.md
