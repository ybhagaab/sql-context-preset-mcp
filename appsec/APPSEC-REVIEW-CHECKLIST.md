# SQL Client MCP Server - AppSec Review Checklist

**Server ID:** `sql-client-mcp`  
**Version:** 1.3.0  
**Talos Engagement:** `b31119a8-2de4-4c05-89ae-970645a84236`  
**Review Status:** `review_requested`  
**Sign-off Required:** Mar 20, 2026

---

## 1. Review Package Contents

| Document | Location | Status |
|----------|----------|--------|
| Application Overview | [APPLICATION-OVERVIEW.md](APPLICATION-OVERVIEW.md) | ✅ Complete |
| System Design | [../docs/SYSTEM-DESIGN.md](../docs/SYSTEM-DESIGN.md) | ✅ Complete |
| Threat Model | [../docs/THREAT-MODEL.md](../docs/THREAT-MODEL.md) | ✅ Complete |
| Data Elements | [DATA-ELEMENTS.md](DATA-ELEMENTS.md) | ✅ Complete |
| Security Properties | [SECURITY-PROPERTIES.md](SECURITY-PROPERTIES.md) | ✅ Complete |
| User Documentation | [../README.md](../README.md) | ✅ Complete |

---

## 2. Application Summary

| Aspect | Details |
|--------|---------|
| **Type** | Local MCP server (CLI tool) |
| **Deployment** | User's local machine only |
| **Communication** | stdio (stdin/stdout) - no network listeners |
| **Users** | Single user (person running the tool) |
| **Data Storage** | None - no local persistence |
| **Authentication** | Direct, IAM, or Secrets Manager |

---

## 3. Security Review Questions

### 3.1 Network Exposure

**Q: Does the application expose any network endpoints?**

A: **No.** The server communicates exclusively via stdio (stdin/stdout). There are no HTTP servers, WebSocket listeners, or any other network endpoints.

### 3.2 Credential Management

**Q: How are credentials handled?**

A: Credentials are:
- Passed via environment variables (standard CLI practice)
- Held in memory only during process lifetime
- Never written to disk by the server
- Never logged or included in error messages
- Cleared when process terminates

For IAM authentication, temporary credentials are:
- Obtained via `redshift:GetClusterCredentials`
- Valid for 15 minutes
- Cached for 14 minutes (1 minute safety margin)
- Auto-refreshed on expiration

### 3.3 Data Persistence

**Q: What data does the application store?**

A: **None.** The server does not persist any data to disk. All data (credentials, queries, results) is held in memory only and cleared when the process terminates.

### 3.4 SQL Injection

**Q: How is SQL injection prevented?**

A: 
- **Metadata tools** (list_tables, describe_table) use parameterized queries
- **Table name validation** uses regex pattern matching via Zod schemas
- **User queries** (run_query) execute user-provided SQL directly - this is by design
- **Primary mitigation** is database-level permissions (recommend read-only users)

### 3.5 Input/Output Validation

**Q: How are tool inputs and outputs validated?**

A: All tool inputs and outputs are validated using Zod schemas:

**Input Validation:**
- SQL queries: max length 100K, no null bytes
- Table/schema names: regex validation, max length 128 chars
- Sample limits: integer 1-1000
- Preset names: alphanumeric with dashes/underscores

**Output Validation:**
- Query results: max 10,000 rows, non-negative row counts
- Response text: max 1MB, sanitized for hidden characters

**Response Sanitization:**
- Control characters (U+0000-U+001F) stripped
- Zero-width characters (U+200B-U+200F) stripped
- Bidirectional text controls (U+202A-U+202E) stripped
- Private use area characters stripped
- Unicode tag characters stripped

**Implementation:** `src/validation/schemas.ts` and `src/validation/sanitizer.ts`

### 3.6 AI-Specific Risks

**Q: How are AI-specific risks (prompt injection) addressed?**

A:
- Database permissions are the primary control
- Recommend read-only database users for AI-assisted queries
- Query results returned as text (not re-executed)
- MCP client provides user approval for tool invocations
- Database-level `statement_timeout` recommended

### 3.7 Confused Deputy

**Q: Is the application vulnerable to Confused Deputy attacks?**

A: **No.** This is a single-user local tool:
- No privilege elevation (uses user's own credentials)
- No multi-tenancy
- Credentials managed outside model context (environment variables)
- Database enforces authorization independently

---

## 4. Threat Model Summary

### 4.1 Key Threats Identified

| ID | Threat | Severity | Status |
|----|--------|----------|--------|
| T-001 | Network interception of database traffic | High | Mitigated (TLS default) |
| T-002 | Database traffic tampering | High | Mitigated (TLS default) |
| T-003 | SQL injection via run_query | Medium | Accepted Risk |
| T-004 | Credential exposure in env vars | Medium | Accepted Risk |
| T-AI-001 | Direct prompt injection (SQL) | High | Accepted Risk |
| T-AI-002 | Indirect prompt injection via results | High | Accepted Risk |

### 4.2 Accepted Risks

| Risk | Rationale | Mitigation |
|------|-----------|------------|
| SQL injection via run_query | Core functionality - executes user/AI SQL | Database permissions |
| Credentials in env vars | Standard CLI practice | IAM/Secrets Manager available |
| AI-generated malicious queries | Cannot distinguish legitimate from malicious | Read-only DB users |

---

## 5. Dependencies

| Package | Version | Purpose | Vulnerability Status |
|---------|---------|---------|---------------------|
| `@modelcontextprotocol/sdk` | ^1.25.4 | MCP protocol | ✅ No known vulnerabilities |
| `pg` | ^8.11.3 | PostgreSQL driver | ✅ No known vulnerabilities |
| `@aws-sdk/client-redshift` | ^3.490.0 | IAM auth | ✅ AWS official |
| `@aws-sdk/client-s3` | ^3.490.0 | S3 presets | ✅ AWS official |
| `@aws-sdk/client-secrets-manager` | ^3.490.0 | Secrets auth | ✅ AWS official |
| `zod` | ^3.23.8 | Input/output validation | ✅ No known vulnerabilities |

Run `npm audit` to verify current vulnerability status.

---

## 6. Agent Tool Checker (ATC) Scan

### 6.1 Scan Summary

| Metric | Value |
|--------|-------|
| Scan Date | February 17, 2026 |
| ATC Version | 1.0.361.0 |
| Overall Status | ✅ PASSED |
| Tools Analyzed | 8 |
| Checks Performed | 89 |
| Critical Findings | 0 |
| High Findings | 0 |
| Medium Findings | 0 |
| Low Findings | 0 |

### 6.2 Checks Performed

| Check | Status |
|-------|--------|
| metadata_context_overflow_server | ✅ No findings |
| name_exact_match | ✅ No findings |
| name_overlap | ✅ No findings |
| name_similarity | ✅ No findings |
| empty_description | ✅ No findings |
| metadata_token_overflow | ✅ No findings |
| command_injection | ✅ No findings |
| cross_server_call | ✅ No findings |
| capabilities_detection | ✅ No findings |
| sensitive_data_exposure | ✅ No findings |
| llm_poisoning_detection | ✅ No findings |
| llm_overreach_detection | ✅ No findings |

### 6.3 Shepherd Risks

No Shepherd risks required based on ATC scan results (0 findings).

Full scan results: [ATC-SCAN-RESULTS.md](ATC-SCAN-RESULTS.md)

---

## 7. Compliance

### 6.1 Shepherd Compliance

| Issue | Status | Notes |
|-------|--------|-------|
| IAM User Access Keys | ✅ N/A | Uses IAM roles, not user keys |
| Hardcoded Credentials | ✅ N/A | Credentials via env vars only |
| IAM Database Auth | ✅ Supported | `SQL_AUTH_METHOD=iam` |

### 6.2 Data Protection

| Requirement | Status |
|-------------|--------|
| Encryption in transit | ✅ TLS default |
| Encryption at rest | ✅ N/A (no storage) |
| Credential rotation | ✅ IAM auto-rotation |
| Audit logging | ✅ CloudTrail + DB logs |

---

## 8. Talos Submission Details

### 8.1 Engagement Information

- **Engagement ID:** `b31119a8-2de4-4c05-89ae-970645a84236`
- **URL:** https://talos.security.aws.a2z.com/#/talos/engagement/arn:aws:talos-engagement:engagement/b31119a8-2de4-4c05-89ae-970645a84236
- **Bindle ID:** `amzn1.bindle.resource.hue24zstnfvm2qxvxpkq`
- **Launch Date:** Feb 23, 2026
- **Sign-off Required:** Mar 20, 2026

### 8.2 Documents to Upload

1. ✅ APPLICATION-OVERVIEW.md
2. ✅ SYSTEM-DESIGN.md
3. ✅ THREAT-MODEL.md
4. ✅ DATA-ELEMENTS.md
5. ✅ SECURITY-PROPERTIES.md
6. ✅ ATC-SCAN-RESULTS.md (Agent Tool Checker scan)

### 8.3 Post-Review Actions

After security review approval:
1. Submit ticket to mark server as "Supported" in MCP Registry
2. Template: https://t.corp.amazon.com/create/templates/01707b13-1b89-4c84-8aa7-56c51254643d

---

## 9. Contact

For questions about this security review:
- **Repository:** https://code.amazon.com/packages/PostgreSQLMCP
- **Team:** Create a CR or contact via repository
