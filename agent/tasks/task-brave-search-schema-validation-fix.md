# Task: Fix Brave Search MCP Tool Schema Validation

**Status**: Not Started  
**Priority**: High  
**Estimated Time**: 2-3 hours  
**Created**: 2026-02-19  
**Dependencies**: brave-search-mcp-wrapper deployed and working  

---

## Problem Statement

The Brave Search MCP wrapper is deployed and working correctly:
- ✅ JWT authentication working
- ✅ API key resolution working
- ✅ Server creation working
- ✅ Tools exposed correctly (6 tools)
- ✅ MCP protocol responses valid

However, the platform's MCP client fails to parse the tool schemas with this error:

```
Error compiling schema, function code: const schema0 = scope.schema[0]...
[Chat] Failed to fetch tools from server { error: { provider: 'brave-search', error: {} } }
```

### Root Cause

The platform's schema validator (likely using AJV or similar) expects a specific JSON schema format, but Brave Search tools return complex nested schemas that fail validation.

**Example problematic schema structure**:
```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "properties": {  // ← Nested "properties" causes issues
            "type": "object",
            "properties": {
              "url": { "type": "string", "format": "uri" },
              "width": { "type": "integer", "exclusiveMinimum": 0 },
              "height": { "type": "integer", "exclusiveMinimum": 0 }
            },
            "required": ["url", "width", "height"]
          }
        }
      }
    }
  }
}
```

The validator is trying to compile this schema but failing on the nested structure.

---

## Solution Overview

**Recommended Solution:** Remove `outputSchema` from Brave Search MCP wrapper tool definitions.

**Rationale:**
- ✅ Simplest fix (change wrapper, not platform)
- ✅ outputSchema is optional in MCP spec
- ✅ Not needed for tool execution (only inputSchema matters)
- ✅ Prevents validation errors in MCP SDK
- ✅ No platform code changes needed

**Alternative Options** (if wrapper can't be changed):
1. **Update schema validator** to handle nested schemas
2. **Skip validation** for tool schemas (trust MCP servers)
3. **Use permissive validation** that allows additional properties
4. **Catch and log validation errors** without failing

---

## Implementation Steps

### Step 1: Remove outputSchema from Brave Search Wrapper (Recommended)

**Repository:** `/home/prmichaelsen/brave-search-mcp-wrapper`

**Files to Modify:**
- Tool definition files that include `outputSchema`
- Likely in `src/tools/` directory

**Changes:**
```typescript
// BEFORE
export const braveImageSearchTool = {
  name: 'brave_image_search',
  description: '...',
  inputSchema: { ... },
  outputSchema: { ... }  // ← Remove this
}

// AFTER
export const braveImageSearchTool = {
  name: 'brave_image_search',
  description: '...',
  inputSchema: { ... }
  // outputSchema removed
}
```

**Actions:**
- [ ] Remove `outputSchema` from all 6 tool definitions
- [ ] Keep `inputSchema` (required)
- [ ] Rebuild wrapper: `npm run build`
- [ ] Redeploy wrapper: `gcloud run deploy ...`
- [ ] Test with curl to verify tools still exposed
- [ ] Test in agentbase.me chat

**Verification:**
- [ ] Wrapper builds without errors
- [ ] Wrapper deploys successfully
- [ ] curl test shows tools without outputSchema
- [ ] agentbase.me discovers tools successfully

---

### Step 2 (Alternative): Platform-Side Fix - Locate Schema Validation Code

**Likely locations**:
- `src/lib/chat/mcp-client.ts` - MCP client implementation
- `src/lib/chat/schemas.ts` - Schema definitions
- `src/services/mcp-server-database.service.ts` - MCP server service

**Actions**:
- [ ] Find where `listTools()` is called
- [ ] Find where tool schemas are validated
- [ ] Identify the schema validation library (AJV, Zod, etc.)

### Step 2: Identify Validation Logic

**Search for**:
- `compiling schema`
- `validate0`
- `ajv` or `zod` imports
- Tool schema validation

**Example code to find**:
```typescript
// Likely something like:
const validate = ajv.compile(toolSchema);
if (!validate(data)) {
  throw new Error('Schema validation failed');
}
```

### Step 3: Implement Fix

**Option A: Skip Tool Schema Validation** (Recommended)
```typescript
// In listTools() or similar:
try {
  const tools = await mcpClient.listTools();
  // Don't validate tool schemas - trust the MCP server
  return tools;
} catch (error) {
  console.error('[MCP Client] Failed to list tools:', error);
  throw error;
}
```

**Option B: Use Try-Catch for Validation**
```typescript
try {
  const validate = ajv.compile(toolSchema);
  if (!validate(data)) {
    console.warn('[MCP Client] Schema validation failed, using anyway:', validate.errors);
  }
} catch (error) {
  console.warn('[MCP Client] Schema compilation failed, skipping validation:', error);
}
// Continue with tools regardless
return tools;
```

**Option C: Configure AJV for Permissive Validation**
```typescript
const ajv = new Ajv({
  strict: false,              // Allow unknown keywords
  validateFormats: false,     // Don't validate formats strictly
  allErrors: false,           // Stop on first error
  allowUnionTypes: true,      // Allow union types
  allowMatchingProperties: true
});
```

### Step 4: Test the Fix

**Test Steps**:
1. Deploy platform changes
2. Start a chat session in agentbase.me
3. Verify brave-search MCP server appears in available servers
4. Send a message that triggers a Brave search
5. Verify tools are listed and can be called

**Verification**:
- [ ] No schema validation errors in logs
- [ ] Tools list successfully
- [ ] Tools can be called
- [ ] Search results returned correctly

---

## Verification Checklist

- [ ] Located schema validation code
- [ ] Identified validation library and configuration
- [ ] Implemented fix (skip validation or make permissive)
- [ ] Tested with Brave Search MCP server
- [ ] Verified no regressions with other MCP servers (Instagram, Remember, etc.)
- [ ] Deployed to production
- [ ] End-to-end test successful

---

## Expected Outcome

After completing this task:
1. ✅ Platform can parse Brave Search tool schemas
2. ✅ Tools list successfully in chat interface
3. ✅ Users can call Brave Search tools
4. ✅ No schema validation errors
5. ✅ Pattern works for future MCP servers with complex schemas

---

## Files to Investigate

1. **`src/lib/chat/mcp-client.ts`** - MCP client implementation
2. **`src/lib/chat/schemas.ts`** - Schema definitions
3. **`src/lib/chat/chat-engine.ts`** - Chat engine that calls MCP client
4. **`src/services/mcp-server-database.service.ts`** - MCP server service

---

## Testing

### Manual Test
```bash
# In agentbase.me chat:
1. Start conversation
2. Type: "Search for TypeScript tutorials"
3. Should see Brave Search tool being called
4. Should get search results
```

### Check Logs
```bash
# Platform logs should show:
[Chat] [DEBUG] Calling listTools() { provider: 'brave-search' }
[Chat] [DEBUG] Tools listed successfully { provider: 'brave-search', count: 6 }
```

---

## Reference Information

### Wrapper Details
- **Service URL**: https://brave-search-mcp-wrapper-dit6gawkbq-uc.a.run.app
- **Status**: ✅ Working perfectly
- **Tools**: 6 (all exposed correctly)
- **Test**: Verified via curl - tools/list returns all 6 tools

### Error Details
```
Error compiling schema, function code: const schema0 = scope.schema[0]...
```

This error occurs when the platform tries to compile the tool's response schema for validation. The nested structure of Brave Search schemas breaks the validator.

### Tool Schema Example
Brave Search tools return schemas like:
```json
{
  "inputSchema": { ... },  // ← This validates fine
  "outputSchema": {        // ← This might be causing issues
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "properties": { ... }  // ← Nested properties
        }
      }
    }
  }
}
```

---

## Notes

- The wrapper is working correctly - this is purely a platform-side issue
- Other MCP servers (Instagram, Remember) might have simpler schemas that validate fine
- Brave Search schemas are more complex due to rich search result metadata
- Consider making schema validation optional or permissive for all MCP servers
- This will likely affect other MCP servers with complex schemas in the future

---

## Recommended Solution

**Skip tool schema validation entirely**:

```typescript
// In MCP client listTools():
async listTools(provider: string): Promise<Tool[]> {
  try {
    const response = await this.call(provider, 'tools/list');
    const tools = response.result.tools;
    
    // Don't validate tool schemas - trust the MCP server
    // MCP servers are responsible for their own schema correctness
    return tools;
    
  } catch (error) {
    console.error('[MCP Client] Failed to list tools:', error);
    throw error;
  }
}
```

**Rationale**:
- MCP servers are responsible for schema correctness
- Validation adds complexity without much benefit
- Allows platform to work with any MCP server
- Errors will surface when tools are actually called (better UX)

---

**Status**: Not Started  
**Priority**: High  
**Estimated Time**: 2-3 hours  
**Blocker**: Prevents Brave Search from being usable in chat  
**Wrapper Status**: ✅ Complete and working
