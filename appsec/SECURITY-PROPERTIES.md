# Design Inspector - Security Properties Configuration

**Diagram:** Local MCP Server- SQL  
**Purpose:** Checkbox configuration for each system component  
**Last Updated:** February 17, 2026

---

## Quick Reference Table

| Component | Auth | Authz | Data@Rest | Data-in-Transit | Network | SQL Injection | CSRF | XSS | Tamper | Input Val | Output Val |
|-----------|------|-------|-----------|-----------------|---------|---------------|------|-----|--------|-----------|------------|
| **SQL Client MCP Server** | ❌ | ❌ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **PostgreSQL Driver (pg)** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

Legend: ✅ Yes | ❌ No/N/A | ⚠️ Partial

---

## 1. SQL Client MCP Server

**Component ID:** `mcp-server`  
**Role:** MCP protocol handler, tool execution, credential management

### Security Properties to CHECK ✅

| Property | Check? | Reason |
|----------|--------|--------|
| has data-in-transit protection | ✅ YES | TLS to database (via pg driver) |
| has data tamper protection | ✅ YES | TLS digital signatures |
| has network-level access control | ✅ YES | No network listeners - stdio only |
| uses SQL injection prevention | ⚠️ PARTIAL | Parameterized metadata queries |
| has input validation | ✅ YES | Zod schema validation on all tool inputs |
| has output validation | ✅ YES | Zod schema validation on all tool outputs |
| has response sanitization | ✅ YES | Hidden character stripping |
| has response size limits | ✅ YES | Configurable max rows/length |

### Security Properties to LEAVE UNCHECKED ❌

| Property | Check? | Reason |
|----------|--------|--------|
| has authentication control | ❌ NO | Delegates to database |
| has authorization control | ❌ NO | Delegates to database |
| has data-at-rest protection | ❌ N/A | No persistence (memory only) |
| uses CSRF protection | ❌ N/A | Not a web application (stdio) |
| uses XSS protection | ❌ N/A | Not a web application (JSON) |

### Tamper Protection Selection
- ✅ **digital signature** (TLS certificate validation)

### SQL Injection Prevention Note

Mark as **PARTIAL** because:
- ✅ Parameterized queries for metadata tools (`list_tables`, `describe_table`)
- ✅ Table name regex validation: `/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/`
- ❌ `run_query` tool executes arbitrary SQL (by design - core functionality)

**Primary mitigation:** Database-level permissions (recommend read-only users)

### Network Access Control Note

Mark as **YES** because:
- ✅ No HTTP server, no WebSocket, no TCP listeners
- ✅ Communication via stdio only (stdin/stdout)
- ✅ Process isolation - runs as user's local process
- ✅ Cannot be accessed remotely

---

## 2. PostgreSQL Driver (pg)

**Component ID:** `pg-driver`  
**Role:** Database connection, TLS encryption, query execution

### Security Properties to CHECK ✅

| Property | Check? | Reason |
|----------|--------|--------|
| has data-in-transit protection | ✅ YES | TLS 1.2+ to database |
| has data tamper protection | ✅ YES | TLS digital signatures |
| uses SQL injection prevention | ✅ YES | Supports parameterized queries |

### Security Properties to LEAVE UNCHECKED ❌

| Property | Check? | Reason |
|----------|--------|--------|
| has authentication control | ❌ NO | Passes credentials to database |
| has authorization control | ❌ NO | Database enforces permissions |
| has data-at-rest protection | ❌ N/A | No persistence |
| has network-level access control | ❌ NO | Connects to configured host |
| uses CSRF protection | ❌ N/A | Not a web application |
| uses XSS protection | ❌ N/A | Not a web application |

### Tamper Protection Selection
- ✅ **digital signature** (TLS certificate validation)

### TLS Configuration Options

| SSL Mode | Encryption | Certificate Validation | Default |
|----------|------------|------------------------|---------|
| `disable` | None | None | No |
| `require` | TLS 1.2+ | Skip verification | **Yes** |
| `verify-ca` | TLS 1.2+ | CA certificate | No |
| `verify-full` | TLS 1.2+ | CA + hostname | No |

---

## 3. External Systems (Annotations)

These are marked as annotations in Design Inspector - security properties not applicable.

### 3.1 MCP Client (Kiro/Claude)
- **Type:** External System (annotation)
- **Security:** Managed by MCP client vendor

### 3.2 PostgreSQL / Redshift Database
- **Type:** External System (annotation)
- **Security:** Managed by database administrator

### 3.3 AWS IAM
- **Type:** External System (annotation)
- **Security:** AWS managed service

### 3.4 AWS Secrets Manager
- **Type:** External System (annotation)
- **Security:** AWS managed service

### 3.5 AWS S3
- **Type:** External System (annotation)
- **Security:** AWS managed service

---

## Why CSRF/XSS Don't Apply

**CSRF (Cross-Site Request Forgery):**
- Applies to: Web forms with cookie-based authentication
- This server: stdio-based communication, no HTTP, no cookies
- Result: Not applicable

**XSS (Cross-Site Scripting):**
- Applies to: Web UIs that render user input as HTML
- This server: Returns JSON data via stdout, no HTML rendering
- Result: Not applicable

---

## Why Auth Control is Unchecked

**Design Decision:** Authentication delegated to database

**Reasons:**
1. Local tool - user already authenticated to their machine
2. Database credentials provided via environment variables
3. Database enforces authentication independently
4. IAM authentication provides AWS-level auth when used

**Access Control Flow:**
```
User → MCP Client → MCP Server (no auth) → Database (authenticates)
```

The server passes credentials to the database, which performs authentication.

---

## Security Properties Checklist for Design Inspector

### SQL Client MCP Server

```
☑ has data-in-transit protection
☑ has data tamper protection  
☑ has network-level access control
☑ uses SQL injection prevention (PARTIAL)
☐ has authentication control
☐ has authorization control
☐ has data-at-rest protection
☐ uses CSRF protection
☐ uses XSS protection
```

**Tamper Protection:** digital signature

### PostgreSQL Driver (pg)

```
☑ has data-in-transit protection
☑ has data tamper protection
☑ uses SQL injection prevention
☐ has authentication control
☐ has authorization control
☐ has data-at-rest protection
☐ has network-level access control
☐ uses CSRF protection
☐ uses XSS protection
```

**Tamper Protection:** digital signature

---

## Security Test Cases

| ID | Test | Component | Status |
|----|------|-----------|--------|
| ST-001 | TLS enabled by default | pg-driver | ✅ Default `require` |
| ST-002 | No network listeners | mcp-server | ✅ stdio only |
| ST-003 | Credentials not logged | mcp-server | ✅ Verified |
| ST-004 | Table name regex validation | mcp-server | ✅ Implemented |
| ST-005 | Parameterized metadata queries | mcp-server | ✅ Implemented |
| ST-006 | IAM credential refresh | mcp-server | ✅ 14 min cache |
| ST-007 | Query results not logged | mcp-server | ✅ Verified |
| ST-008 | Certificate validation in verify-full | pg-driver | ✅ Supported |
| ST-009 | Zod input schema validation | mcp-server | ✅ All 8 tools |
| ST-010 | Zod output schema validation | mcp-server | ✅ QueryResultSchema |
| ST-011 | Hidden character stripping | mcp-server | ✅ sanitizer.ts |
| ST-012 | Response size limits | mcp-server | ✅ MAX_ROWS=10000, MAX_RESPONSE_LENGTH=1MB |
| ST-013 | Control character removal | mcp-server | ✅ U+0000-U+001F stripped |
| ST-014 | Unicode smuggling prevention | mcp-server | ✅ Zero-width chars stripped |
| ST-015 | Semantic validation (positive limits) | mcp-server | ✅ MIN_SAMPLE_LIMIT=1 |

---

## Zod Validation Implementation

### Input Validation Schemas

All tool inputs are validated using Zod schemas before processing:

| Tool | Schema | Validations |
|------|--------|-------------|
| `run_query` | `RunQueryInputSchema` | SQL length ≤100K, no null bytes |
| `list_tables` | `ListTablesInputSchema` | Schema name regex, length ≤128 |
| `describe_table` | `DescribeTableInputSchema` | Table name regex, length ≤128 |
| `get_sample_data` | `GetSampleDataInputSchema` | Table regex, limit 1-1000 |
| `get_schema_context` | `GetSchemaContextInputSchema` | Preset name regex, length ≤256 |
| `list_schemas` | N/A | No user input |
| `connection_status` | N/A | No user input |
| `list_presets` | N/A | No user input |

### Output Validation Schemas

| Schema | Purpose | Limits |
|--------|---------|--------|
| `QueryResultSchema` | Query results | rows ≤10000, rowCount ≥0, executionTime ≥0 |
| `McpResponseSchema` | MCP response format | text ≤1MB, content array 1-10 items |

### Response Sanitization

Characters stripped from all responses:
- Control characters (U+0000-U+001F except whitespace)
- Zero-width characters (U+200B-U+200F)
- Bidirectional text controls (U+202A-U+202E)
- Private use area (U+E000-U+F8FF)
- Tag characters (U+E0000-U+E007F)
- Variation selectors (U+FE00-U+FE0F)

### Configuration Limits

```typescript
LIMITS = {
  MAX_ROWS: 10000,
  MAX_RESPONSE_LENGTH: 1_000_000, // 1MB
  MAX_SQL_LENGTH: 100_000,
  MAX_TABLE_NAME_LENGTH: 128,
  MAX_SCHEMA_NAME_LENGTH: 128,
  MAX_PRESET_NAME_LENGTH: 256,
  MAX_SAMPLE_LIMIT: 1000,
  MIN_SAMPLE_LIMIT: 1,
}
```
