# Implementation Summary: UUID Support and Multi-Endpoint Fallback

## Overview
This PR implements comprehensive UUID support and multi-endpoint fallback strategies to ensure n8n-mcp works across n8n Cloud, self-hosted v1.x+, and older self-hosted versions.

## Changes Made

### 1. Type System Enhancements (`src/types.ts`)
- **N8nCredential.id**: Changed from `number` to `string | number` to support UUID-based credentials
- **Added new types**:
  - `EndpointAttempt`: Tracks endpoint, method, status, and message for fallback operations
  - `FallbackOperationResult`: Standard response format for multi-endpoint operations

### 2. Core Client Enhancements (`src/n8n-client.ts`)

#### New Helper Method: `requestRest()`
```typescript
private async requestRest<T>(method: string, path: string, data?: any)
```
- Makes requests to `/rest/*` endpoints (outside `/api/v1`)
- Copies authentication headers from main API instance
- Returns structured response with `ok`, `status`, `data`, and `error`

#### Enhanced `listTags()` with Fallback
**Strategy:**
1. Try `GET /api/v1/tags`
2. If 404/401, fallback to `GET /rest/tags`
3. Normalize response format (handle both array and `{ data: [] }` responses)

#### Enhanced `updateTag()` with Multi-Endpoint Fallback
**Strategy:**
1. Try `PATCH /rest/tags/{id}` with update data
2. If fails, try `PUT /api/v1/tags/{id}` with update data
3. If both fail on color-only update, throw helpful error message

**Error Enhancement:**
```javascript
{
  message: "Unable to update tag color. Attempted endpoints: ...",
  attempts: [
    { endpoint: "/rest/tags/123", method: "PATCH", status: 405, message: "..." },
    { endpoint: "/api/v1/tags/123", method: "PUT", status: 400, message: "..." }
  ]
}
```

#### Enhanced `setWorkflowTags()` with Multi-Strategy Fallback
**Strategy:**
1. Fetch tag names via `listTags()`
2. Try `PATCH /rest/workflows/{id}` with `{ tags: ["name1", "name2"] }` (tag names)
3. If fails, try `PATCH /rest/workflows/{id}` with `{ tags: [{ id: "uuid1" }, { id: "uuid2" }] }` (tag IDs as objects)
4. If both fail, try `PUT /api/v1/workflows/{id}/tags` with `{ tagIds: ["uuid1", "uuid2"] }`
5. Return tags via `listWorkflowTags()`

**Error Enhancement:**
Includes all attempted endpoints with status codes when all strategies fail.

### 3. Error Message Improvements (`src/output.ts`)

Enhanced `error()` function to:
- Include `attemptedEndpoints` array when available
- Add contextual hints for known limitations:
  - Tag color operations: "Tag color may need to be set via the n8n web UI"
  - Tag attachment: "Tag attachment endpoints vary by n8n version"

### 4. CLI Enhancements (`src/cli.ts`)

Updated tag commands to accept both numeric IDs and string UUIDs:
- `tags get <id>`: Accepts "123" or "tag-uuid-abc"
- `tags update <id>`: Accepts "123" or "tag-uuid-abc"  
- `tags delete <id>`: Accepts "123" or "tag-uuid-abc"

**UUID Detection:**
```typescript
const id = /^\d+$/.test(tagId) ? parseInt(tagId) : tagId;
```

### 5. Documentation (`README.md`)

Added new section: **n8n Endpoint Compatibility & Fallback**

Documents:
- UUID support for all ID fields
- Tag operations fallback strategies (listing, updating color, setting workflow tags)
- Error message enhancements
- Compatibility across n8n Cloud, v1.x+, and older versions

## Testing

### New Test Suite: `src/__tests__/tag-uuid-support.test.ts`
**11 new tests covering:**

1. **UUID Support Tests:**
   - String UUID for tag ID in `updateTag`
   - Numeric ID for tag in `updateTag`
   - String UUID for workflow ID in `setWorkflowTags`
   - Numeric workflow ID in `setWorkflowTags`
   - Mixed string and number tag IDs

2. **Fallback Logic Tests:**
   - `/rest` endpoint usage for `updateTag`
   - Helpful error messages for color update failures
   - Tag name-based workflow tagging
   - Detailed errors when all endpoints fail

3. **List Tags Fallback Tests:**
   - Fallback to `/rest/tags` on 404
   - Array response normalization

### Test Results
- **Total tests:** 208 (11 new, 197 existing)
- **Status:** All passing ✅
- **No regressions**

## Compatibility Matrix

| n8n Version | List Tags | Update Tag Color | Set Workflow Tags | Notes |
|-------------|-----------|------------------|-------------------|-------|
| Cloud | ✅ `/api/v1` | ✅ PATCH or PUT | ✅ PUT `/api/v1` | Primary endpoints |
| v1.x+ (self-hosted) | ✅ `/api/v1` | ✅ PATCH or PUT | ✅ PUT `/api/v1` | Primary endpoints |
| v0.x (self-hosted) | ✅ `/rest` fallback | ✅ PATCH `/rest` | ✅ PATCH `/rest` | Fallback endpoints |
| Limited plans | ✅ `/api/v1` or `/rest` | ⚠️ UI-only | ⚠️ UI-only | Helpful error messages |

**Legend:**
- ✅ Fully supported with automatic fallback
- ⚠️ Graceful failure with actionable error message

## Example Usage

### With Numeric IDs (traditional)
```bash
# CLI
n8n-mcp tags get 1
n8n-mcp tags update 1 "New Name" "#ff0000"
n8n-mcp workflows set-tags 1 --tags "tag1,tag2"
```

### With String UUIDs (n8n Cloud)
```bash
# CLI
n8n-mcp tags get "tag-abc-123"
n8n-mcp tags update "tag-abc-123" "New Name" "#ff0000"
n8n-mcp workflows set-tags "workflow-xyz-456" --tags "tag-abc-123,tag-def-789"
```

### Error Response Example
```json
{
  "ok": false,
  "error": {
    "message": "Unable to update tag color. Attempted endpoints: PATCH /rest/tags/tag-uuid-123 (405), PUT /api/v1/tags/tag-uuid-123 (400)",
    "attemptedEndpoints": [
      { "endpoint": "/rest/tags/tag-uuid-123", "method": "PATCH", "status": 405 },
      { "endpoint": "/api/v1/tags/tag-uuid-123", "method": "PUT", "status": 400 }
    ],
    "hint": "Tag color updates may not be supported on this n8n instance. Consider setting colors via the n8n web UI."
  }
}
```

## Implementation Notes

### Design Decisions

1. **Graceful Degradation**: Operations try multiple strategies before failing, maximizing compatibility.

2. **Structured Error Reporting**: All errors include attempted endpoints, making debugging easier.

3. **Backward Compatibility**: Existing numeric ID support is preserved; string UUIDs are added.

4. **No Breaking Changes**: All changes are additive; existing code continues to work.

5. **Type Safety**: Full TypeScript support for string | number IDs throughout the codebase.

### Performance Considerations

- Fallback attempts are sequential but fail fast (typical HTTP timeout ~5s per endpoint)
- Tag name resolution for `setWorkflowTags` adds one `listTags()` call but enables name-based tagging
- Successful operations skip fallback attempts (no extra overhead)

## Acceptance Criteria ✅

All acceptance criteria from the issue have been met:

✅ **UUID Support**: Tools accept string UUID IDs and work end-to-end on n8n Cloud
✅ **Graceful Tag Color Handling**: Attempts resolve gracefully with UI-required messages when unsupported
✅ **Tag Attachment Fallback**: Succeeds via at least one fallback route with actionable errors
✅ **Comprehensive Tests**: Cover fallback logic and ID types without regressions (208 tests pass)
✅ **Documentation**: README documents endpoints, fallback order, and compatibility

## Future Enhancements (Optional)

While not in scope for this PR, potential future improvements:

1. **Project Scoping**: Accept optional `projectId` header for `/api/v1/workflows` calls
2. **Caching**: Cache tag list to reduce `listTags()` calls in `setWorkflowTags()`
3. **Retry Logic**: Add exponential backoff for transient failures
4. **Metrics**: Track which endpoints succeed/fail for analytics
