# SQL Client MCP Server - Threat Model

**Version:** 1.2.2  
**Date:** February 2026  
**Status:** For AppSec Review

---

## 1. Introduction

### 1.1 Purpose

This threat model answers four questions:
1. What are we working on?
2. What can go wrong?
3. What are we going to do about it?
4. Did we do a good job?

### 1.2 Project Background

SQL Client MCP is a local Model Context Protocol (MCP) server that enables AI assistants (Kiro, Claude Desktop) to execute SQL queries on PostgreSQL and Amazon Redshift databases. It runs entirely on the user's local machine as a stdio-based process.

### 1.3 Service Overview

The server provides AI assistants with tools to:
- Execute SQL queries against PostgreSQL/Redshift databases
- Browse database schemas, tables, and columns
- Load custom schema documentation (presets) for context

### 1.4 Security Tenets

1. **Database credentials never leave the local machine** - All authentication happens locally; database credentials are passed via environment variables (Direct mode) or received from AWS API responses (IAM/Secrets Manager modes) and never persisted to disk by the server.

2. **AWS credentials are managed by AWS SDK** - The MCP server code never reads, stores, or handles AWS credentials directly. The AWS SDK manages credentials internally via its credential chain.

3. **Database permissions are the primary access control** - The server executes queries with the permissions of the configured database user; it does not implement additional query filtering.

4. **User controls all configuration** - The user explicitly configures which databases to connect to and which authentication method to use.

### 1.5 Assumptions

| ID | Assumption | Comments |
|----|------------|----------|
| A-01 | The user's local machine is trusted | Server runs as a local process with user's permissions |
| A-02 | The MCP client (Kiro, Claude Desktop) is trusted | Client controls server lifecycle and tool invocation |
| A-03 | AWS IAM authentication works correctly | For IAM/Secrets Manager auth methods |
| A-04 | TLS implementations in node-postgres are secure | Using well-audited pg library |
| A-05 | Database-level permissions are correctly configured | Primary access control mechanism |

---

## 2. System Architecture

### 2.1 High Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    User's Local Machine                          │
│                                                                  │
│  ┌──────────────┐    stdio     ┌─────────────────────────────┐  │
│  │  MCP Client  │◄────────────►│   SQL Client MCP Server     │  │
│  │  (Kiro)      │              │                             │  │
│  └──────────────┘              │  ┌───────────────────────┐  │  │
│                                │  │ MCP Protocol Handler  │  │  │
│                                │  │ (JSON-RPC over stdio) │  │  │
│                                │  └───────────┬───────────┘  │  │
│                                │              │              │  │
│                                │  ┌───────────▼───────────┐  │  │
│                                │  │    Tool Handlers      │  │  │
│                                │  └───────────┬───────────┘  │  │
│                                │              │              │  │
│                                │  ┌───────────▼───────────┐  │  │
│                                │  │  PostgreSQL Driver    │  │  │
│                                │  │  (node-postgres/pg)   │  │  │
│                                │  └───────────┬───────────┘  │  │
│                                └──────────────┼──────────────┘  │
└───────────────────────────────────────────────┼─────────────────┘
                                                │ TLS/SSL
                                                ▼
                                  ┌─────────────────────────┐
                                  │  PostgreSQL / Redshift  │
                                  │       Database          │
                                  └─────────────────────────┘
```

### 2.2 Data Flow Diagram

```
                                    TRUST BOUNDARY
                                         │
    ┌─────────┐      ┌─────────┐        │        ┌─────────┐
    │  User   │      │   MCP   │        │        │   AWS   │
    │         │─────►│  Client │        │        │  APIs   │
    └─────────┘      └────┬────┘        │        └────┬────┘
                          │             │             │
                     stdio│             │             │ HTTPS
                          ▼             │             ▼
                    ┌───────────┐       │       ┌───────────┐
                    │    MCP    │       │       │ Redshift  │
                    │  Server   │───────┼──────►│ GetCreds  │
                    │ (Process) │       │       │ API       │
                    └─────┬─────┘       │       └───────────┘
                          │             │
                     TLS  │             │
                          ▼             │
                    ┌───────────┐       │
                    │ Database  │◄──────┘
                    │  Server   │
                    └───────────┘

Legend:
─────► Data flow
│      Trust boundary
```

### 2.3 Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| MCP Protocol Layer | @modelcontextprotocol/sdk | JSON-RPC message handling |
| Database Driver | pg (node-postgres) | PostgreSQL wire protocol |
| AWS SDK | @aws-sdk/client-* | IAM auth, Secrets Manager |
| Preset Loader | Custom | Load schema documentation |

---

## 3. APIs / Tools

| Tool | Method | Mutating | Callable From | Authorized Callers |
|------|--------|----------|---------------|-------------------|
| run_query | Execute | Yes | MCP Client | Local user via MCP client |
| list_schemas | Read | No | MCP Client | Local user via MCP client |
| list_tables | Read | No | MCP Client | Local user via MCP client |
| describe_table | Read | No | MCP Client | Local user via MCP client |
| get_sample_data | Read | No | MCP Client | Local user via MCP client |
| connection_status | Read | No | MCP Client | Local user via MCP client |
| get_schema_context | Read | No | MCP Client | Local user via MCP client |
| list_presets | Read | No | MCP Client | Local user via MCP client |

---

## 4. Assets

| Asset Name | Asset Usage | Data Type | Handled By | Comments |
|------------|-------------|-----------|------------|----------|
| Database credentials | Authentication to database | Secrets | MCP Server | Read from env vars OR parsed from AWS API responses |
| AWS credentials | IAM/Secrets Manager auth | Secrets | AWS SDK | Managed internally by SDK credential chain - never exposed to MCP code |
| Database connection | Active TCP/TLS connection | Connection | MCP Server | Pooled, reused |
| Query results | Data returned from database | Customer Data | MCP Server | Passed to MCP client, not persisted |
| Schema presets | Documentation files | Configuration | MCP Server | Loaded from local/S3/HTTP |
| IAM temp DB credentials | Redshift temporary auth | Secrets | MCP Server | Received from GetClusterCredentials API, cached 14 min |

### 4.1 Credential Handling Responsibility

**Important distinction:** There are two types of credentials with different handling:

| Credential Type | Handled By | MCP Server Role |
|-----------------|------------|-----------------|
| **AWS Credentials** (Access Key, Secret Key, Session Token) | AWS SDK | Not handled - SDK manages via credential chain |
| **Database Credentials** (username, password) | MCP Server | Reads from env vars OR parses from AWS API responses |

**AWS SDK manages internally (never exposed to MCP server code):**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- AWS profile credentials (`~/.aws/credentials`)
- IAM role credentials (EC2, ECS, Lambda)
- Web identity tokens

**MCP Server handles database credentials only:**
- **Direct mode:** Reads `SQL_USER`, `SQL_PASSWORD` from environment variables
- **IAM mode:** Receives temp DB credentials from `GetClusterCredentials` API response, caches in `iamCredentialsCache`
- **Secrets Manager mode:** Parses username/password from `GetSecretValue` API response JSON

---

## 5. Threat Actors

| Actor | Description | Capability |
|-------|-------------|------------|
| TA-01 | Network attacker | Can intercept network traffic between server and database |
| TA-02 | Prompt injection attacker | Can craft malicious prompts to manipulate AI into generating harmful SQL |
| TA-03 | Malicious preset author | Can create preset files with misleading content or injection payloads |
| TA-04 | Local attacker | Has access to user's machine (out of scope - machine is trusted) |
| TA-05 | Indirect prompt injection | Can embed malicious instructions in data that AI reads (e.g., database content, preset files) |

---

## 6. Threats

| ID | Priority | Threat | STRIDE | Affected Assets | Mitigations | Status |
|----|----------|--------|--------|-----------------|-------------|--------|
| T-001 | High | A network attacker intercepts database traffic, leading to disclosure of credentials or query data | Information Disclosure | Database credentials, Query results | M-001, M-002 | Mitigated |
| T-002 | High | A network attacker modifies database traffic in transit, leading to query tampering | Tampering | Query results | M-001, M-002 | Mitigated |
| T-003 | Medium | A malicious AI prompt attempts SQL injection via run_query, leading to unauthorized data access or modification | Elevation of Privilege | Database | M-003, M-004, M-013 | Accepted Risk |
| T-004 | Medium | Database credentials exposed in environment variables are read by another process | Information Disclosure | Database credentials | M-005 | Accepted Risk |
| T-005 | Low | A malicious preset file contains misleading schema information, leading to incorrect queries | Spoofing | Schema presets | M-006 | Mitigated |
| T-006 | Medium | IAM temporary DB credentials are cached in memory and could be accessed if memory is dumped | Information Disclosure | IAM temp DB credentials | M-007 | Accepted Risk |
| T-007 | Low | Database connection pool exhaustion via rapid tool calls | Denial of Service | Database connection | M-008 | Mitigated |
| T-008 | Medium | Man-in-the-middle attack on S3/HTTP preset loading | Tampering | Schema presets | M-009 | Mitigated |
| T-009 | Low | Query results contain sensitive data that is logged | Information Disclosure | Query results | M-010 | Mitigated |
| T-010 | Medium | Weak SSL/TLS configuration allows downgrade attacks | Information Disclosure | Data in transit | M-011 | Mitigated |
| T-011 | Low | Table name injection in get_sample_data tool | Elevation of Privilege | Database | M-012 | Mitigated |

### 6.1 AI-Specific Threats

| ID | Priority | Threat | STRIDE | Affected Assets | Mitigations | Status |
|----|----------|--------|--------|-----------------|-------------|--------|
| T-AI-001 | High | **Direct Prompt Injection (SQL)**: An attacker crafts a prompt that tricks the AI into generating malicious SQL (DROP TABLE, data exfiltration, privilege escalation) | Elevation of Privilege | Database | M-003, M-004, M-013 | Accepted Risk |
| T-AI-002 | High | **Indirect Prompt Injection via Query Results**: Malicious data stored in the database contains instructions that, when returned to the AI, cause it to execute harmful follow-up queries | Elevation of Privilege | Database, Query results | M-003, M-004, M-014 | Accepted Risk |
| T-AI-003 | Medium | **Indirect Prompt Injection via Presets**: A malicious preset file contains hidden instructions that manipulate the AI's behavior when loaded via get_schema_context | Tampering | Schema presets, Database | M-006, M-015 | Mitigated |
| T-AI-004 | Medium | **Data Exfiltration via AI**: An attacker uses prompt injection to make the AI query sensitive tables and include the data in its response to the user | Information Disclosure | Database | M-003, M-004 | Accepted Risk |
| T-AI-005 | Medium | **Blind SQL Injection via AI**: An attacker uses the AI to perform time-based or error-based blind SQL injection to infer database structure or data | Information Disclosure | Database | M-003, M-004 | Accepted Risk |
| T-AI-006 | Low | **AI-Assisted Reconnaissance**: An attacker uses the AI to systematically enumerate database schemas, tables, and columns to plan further attacks | Information Disclosure | Database schema | M-003, M-016 | Accepted Risk |
| T-AI-007 | Medium | **Denial of Service via AI**: An attacker prompts the AI to generate resource-intensive queries (cartesian joins, recursive CTEs) that overload the database | Denial of Service | Database | M-003, M-017 | Partially Mitigated |

---

## 7. Mitigations

### 7.1 System Specific Mitigations

| ID | Mitigation | Threats | Status | Evidence |
|----|------------|---------|--------|----------|
| M-001 | TLS encryption enabled by default (SQL_SSL_MODE=require) | T-001, T-002 | Implemented | [src/index.ts - buildSSLConfig()](../src/index.ts) |
| M-002 | Support for verify-ca and verify-full SSL modes with certificate validation | T-001, T-002, T-010 | Implemented | [src/index.ts - buildSSLConfig()](../src/index.ts) |
| M-003 | Database-level permissions control what queries can execute (least privilege) | T-003, T-AI-001 to T-AI-007 | Implemented | Database configuration (external) |
| M-004 | MCP client provides user approval for tool invocations | T-003, T-AI-001 to T-AI-006 | Implemented | MCP client responsibility |
| M-005 | Credentials passed via environment variables (standard CLI practice), not persisted to disk | T-004 | Implemented | No file I/O for credentials |
| M-006 | User controls preset sources via explicit configuration | T-005, T-AI-003 | Implemented | SQL_CONTEXT_* env vars |
| M-007 | IAM credentials have 15-minute expiry, auto-refreshed | T-006 | Implemented | [src/index.ts - getIAMCredentials()](../src/index.ts) |
| M-008 | Single connection pool with lazy initialization | T-007 | Implemented | [src/index.ts - ensureConnection()](../src/index.ts) |
| M-009 | S3 uses AWS SDK with SigV4; HTTPS required for URL presets | T-008 | Implemented | [src/presets/index.ts](../src/presets/index.ts) |
| M-010 | Query results sent to stdout only, errors to stderr without sensitive data | T-009 | Implemented | No logging of query results |
| M-011 | Configurable SSL modes including verify-full for highest security | T-010 | Implemented | SQL_SSL_MODE configuration |
| M-012 | Table name validation via regex pattern | T-011 | Implemented | [src/index.ts - get_sample_data handler](../src/index.ts) |

### 7.2 AI-Specific Mitigations

| ID | Mitigation | Threats | Status | Evidence |
|----|------------|---------|--------|----------|
| M-013 | **Read-only database user recommended**: Documentation recommends configuring database user with SELECT-only permissions for AI-assisted queries | T-003, T-AI-001, T-AI-004 | Documented | [README.md](../README.md) |
| M-014 | **Query results are not automatically re-executed**: AI must explicitly call run_query for each query; results are returned as text, not as executable commands | T-AI-002 | By Design | MCP protocol design |
| M-015 | **Presets are documentation only**: Preset content is returned as text context, not executed as code or SQL | T-AI-003 | By Design | [src/presets/index.ts](../src/presets/index.ts) |
| M-016 | **Schema browsing tools use parameterized queries**: list_tables, describe_table use parameterized queries preventing injection | T-AI-006 | Implemented | [src/index.ts](../src/index.ts) |
| M-017 | **Database-level query timeouts**: Recommend configuring statement_timeout on database to limit long-running queries | T-AI-007 | Documented | Database configuration (external) |

### 7.3 Accepted Risks

| ID | Risk | Rationale | Recommended User Action | Owner |
|----|------|-----------|------------------------|-------|
| AR-001 | SQL injection via run_query (T-003, T-AI-001) | By design - the tool executes user/AI-provided SQL. This is the core functionality. | Configure database user with least-privilege (SELECT only for read-only use cases) | Service Team |
| AR-002 | Database credentials in environment variables (T-004) | Standard practice for CLI tools. Alternative auth methods (IAM, Secrets Manager) available for sensitive environments. | Use IAM or Secrets Manager auth for production databases | Service Team |
| AR-003 | Memory-resident DB credentials (T-006) | Credentials cleared on process termination. Local machine is trusted per A-01. AWS credentials are managed by AWS SDK, not MCP server. | N/A | Service Team |
| AR-004 | AI-generated malicious queries (T-AI-001 to T-AI-007) | The server is a tool that executes SQL; it cannot distinguish between legitimate and malicious queries. The AI model and MCP client are responsible for query safety. | Use read-only database users; enable database audit logging; review AI-generated queries before execution | Service Team |
| AR-005 | Indirect prompt injection via query results (T-AI-002) | Query results may contain attacker-controlled data. The AI model must be resilient to prompt injection in data. | This is an AI model responsibility, not server-side | Service Team |

---

## 8. Security Controls Summary

### 8.1 Authentication

| Method | Mechanism | Credential Storage | MCP Server Handles |
|--------|-----------|-------------------|-------------------|
| Direct | Username/password from env vars | Memory only | ✅ DB credentials from `SQL_USER`, `SQL_PASSWORD` |
| IAM | AWS SDK credential chain → Redshift GetClusterCredentials | AWS SDK (internal) → memory cache (14 min) | ✅ Temp DB credentials from API response only |
| Secrets Manager | AWS SDK credential chain → GetSecretValue | AWS SDK (internal) → memory (per request) | ✅ DB credentials parsed from JSON response only |

**Note:** AWS credentials (Access Key, Secret Key, Session Token) are managed entirely by the AWS SDK. The MCP server code never reads, stores, or handles AWS credentials directly - it only receives database credentials from AWS API responses.

### 8.2 Authorization

| Layer | Control |
|-------|---------|
| MCP Client | User approval for tool invocations |
| Database | GRANT/REVOKE permissions on database user |
| AWS IAM | IAM policies for GetClusterCredentials, GetSecretValue |

### 8.3 Data Protection

| Data State | Protection |
|------------|------------|
| In Transit (to database) | TLS 1.2+ (configurable modes) |
| In Transit (to AWS) | HTTPS with SigV4 |
| At Rest | Not applicable (no local persistence) |
| In Memory | Cleared on process termination |

### 8.4 Audit Trail

| System | Events |
|--------|--------|
| AWS CloudTrail | GetClusterCredentials, GetSecretValue API calls |
| Database Audit Logs | Query execution (if enabled on database) |
| S3 Access Logs | Preset file access (if enabled on bucket) |

---

## 9. AI Security Considerations

This section addresses security considerations specific to AI-assisted database access.

### 9.1 Attack Surface Unique to AI Tools

Unlike traditional database clients, this MCP server introduces an AI model into the query generation pipeline:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───►│    AI    │───►│   MCP    │───►│ Database │
│  Prompt  │    │  Model   │    │  Server  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │
              Prompt Injection
              Attack Vector
```

The AI model is the primary attack surface for prompt injection attacks. The MCP server itself does not interpret or filter SQL - it executes what the AI generates.

### 9.2 Defense in Depth Strategy

| Layer | Control | Responsibility |
|-------|---------|----------------|
| 1. User | Review AI-generated queries before approval | User |
| 2. MCP Client | Tool invocation approval UI | MCP Client (Kiro) |
| 3. AI Model | Prompt injection resistance | AI Model Provider |
| 4. MCP Server | Parameterized queries for metadata tools | This Server |
| 5. Database | Least-privilege permissions, query timeouts | Database Admin |
| 6. Audit | Database audit logging, CloudTrail | Database Admin |

### 9.3 Recommended Security Configuration

For production or sensitive databases:

1. **Use a read-only database user**
   ```sql
   CREATE USER ai_reader WITH PASSWORD '...';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_reader;
   ```

2. **Enable query timeouts**
   ```sql
   ALTER USER ai_reader SET statement_timeout = '30s';
   ```

3. **Enable database audit logging**
   - PostgreSQL: `log_statement = 'all'`
   - Redshift: Enable audit logging to S3

4. **Use IAM authentication** (for Redshift)
   - Provides CloudTrail audit trail
   - Temporary credentials with automatic rotation

5. **Restrict schema access**
   ```sql
   REVOKE ALL ON SCHEMA sensitive_schema FROM ai_reader;
   ```

### 9.4 What This Server Does NOT Do

To set clear expectations for AppSec review:

| Capability | Status | Rationale |
|------------|--------|-----------|
| SQL query filtering/sanitization | Not implemented | By design - tool executes arbitrary SQL |
| Query allowlisting | Not implemented | Would break legitimate use cases |
| AI prompt analysis | Not implemented | AI model responsibility |
| Rate limiting | Not implemented | Local single-user tool |
| Query result filtering | Not implemented | Would break legitimate use cases |

### 9.5 Comparison with Traditional SQL Clients

| Aspect | Traditional SQL Client | AI-Assisted MCP Server |
|--------|----------------------|------------------------|
| Query source | Human types SQL | AI generates SQL from natural language |
| Injection risk | User error | Prompt injection attacks |
| Query review | User sees query before execution | User may approve without reviewing |
| Attack surface | Network, credentials | Network, credentials, AI model |

### 9.6 Confused Deputy Analysis

The "Confused Deputy" threat applies to server-side AI systems that have elevated privileges and serve multiple users. This section analyzes how the local MCP server design addresses this threat pattern.

#### Why Confused Deputy Does NOT Apply

```
SERVER-SIDE AI (Confused Deputy Risk):
  User A ──┐                    ┌─► Customer A Data
           │    ┌───────────┐   │
  User B ──┼───►│ AI System │───┼─► Customer B Data  ← CROSS-CUSTOMER RISK
           │    │ (elevated │   │
  User C ──┘    │ privileges)│   └─► Customer C Data
                └───────────┘

LOCAL MCP SERVER (This Design):
  ┌──────────┐    ┌───────────┐    ┌─────────────────┐
  │  User    │───►│ AI + MCP  │───►│ Database        │
  │ (single) │    │ (user's   │    │ (user's creds)  │
  └──────────┘    │ creds)    │    └─────────────────┘
                  └───────────┘
  
  No privilege elevation - AI uses SAME permissions as user
```

#### Compliance with Confused Deputy Mitigations

| Requirement | Applicability | Implementation |
|-------------|---------------|----------------|
| Pass authenticated context outside model execution | N/A - single user | Credentials are in env vars, not model context |
| Use FAS/impersonation to scope to caller | N/A - already scoped | User's own credentials used directly |
| Don't let model control auth context | ✅ Required | Credentials in env vars, immutable by model |
| Filter model output for unauthorized data | N/A - single user | No cross-user data to filter |
| Independent downstream authentication | ✅ Required | Database enforces its own auth |
| Security-isolate model from auth infrastructure | ✅ Required | Credentials never passed through MCP protocol |

#### Key Design Properties

1. **No Privilege Elevation**: The MCP server has no credentials of its own. It uses only the credentials the user explicitly provides via environment variables.

2. **No Multi-Tenancy**: This is a single-user, local tool. There is no "other customer's data" that could be accessed.

3. **Credentials Outside Model Context**: Database credentials are:
   - Passed via environment variables (not MCP messages)
   - Never included in prompts or model context
   - Not controllable by model output

4. **Database Enforces Authorization**: Every query is authenticated and authorized by the database using the configured credentials, independent of the AI model.

#### What This Design Does NOT Protect Against

| Scenario | Protected? | Rationale |
|----------|------------|-----------|
| AI accessing other users' data | N/A | Single-user tool |
| AI accessing data user has permission for | No | By design - this is the tool's purpose |
| AI generating harmful queries (DROP, DELETE) | Partial | Mitigated by recommending read-only DB users |
| User being tricked into approving bad queries | No | User responsibility; MCP client shows queries |

#### Conclusion

The local MCP server design is **not vulnerable to the Confused Deputy attack** because:
1. It operates in a single-user context with no privilege elevation
2. The AI model cannot access any data the user couldn't access directly
3. Credentials are managed outside the model execution environment
4. The database independently enforces authorization

For server-side/multi-tenant deployments (like `sql-client-mcp-online`), the Confused Deputy mitigations would be required.

---

## 10. Out of Scope

The following are explicitly out of scope for this threat model:

| Item | Rationale |
|------|-----------|
| Compromised local machine | Server inherits user's trust level (A-01) |
| Malicious MCP client | Client is trusted (A-02) |
| Database server vulnerabilities | External system, not controlled by this service |
| AWS service vulnerabilities | Covered by AWS security (A-03) |
| node-postgres library vulnerabilities | Covered by dependency management |

---

## 11. Security Test Cases

| ID | Mitigation | Test Case | Type | Status |
|----|------------|-----------|------|--------|
| ST-001 | M-001 | Verify TLS is enabled by default | Manual | Planned |
| ST-002 | M-002 | Verify certificate validation in verify-full mode | Manual | Planned |
| ST-003 | M-007 | Verify IAM credentials refresh after 14 minutes | Manual | Planned |
| ST-004 | M-010 | Verify no credentials in stderr output | Manual | Planned |
| ST-005 | M-012 | Verify table name regex rejects injection attempts | Unit | Planned |
| ST-006 | M-016 | Verify list_tables uses parameterized queries | Code Review | Implemented |
| ST-007 | M-016 | Verify describe_table uses parameterized queries | Code Review | Implemented |

### 11.1 AI-Specific Test Cases

| ID | Mitigation | Test Case | Type | Status |
|----|------------|-----------|------|--------|
| ST-AI-001 | M-003 | Verify DROP TABLE fails with read-only user | Manual | Planned |
| ST-AI-002 | M-003 | Verify DELETE fails with read-only user | Manual | Planned |
| ST-AI-003 | M-003 | Verify UPDATE fails with read-only user | Manual | Planned |
| ST-AI-004 | M-014 | Verify query results are returned as text, not re-executed | Code Review | Implemented |
| ST-AI-005 | M-015 | Verify preset content is not executed as SQL | Code Review | Implemented |
| ST-AI-006 | M-017 | Verify long-running query is terminated by database timeout | Manual | Planned |

---

## 12. Dependencies

| Package | Version | Security Notes |
|---------|---------|----------------|
| @modelcontextprotocol/sdk | 1.0.0 | Anthropic-maintained |
| pg | ^8.11.3 | Well-audited PostgreSQL driver |
| @aws-sdk/client-redshift | ^3.490.0 | AWS official SDK |
| @aws-sdk/client-s3 | ^3.490.0 | AWS official SDK |
| @aws-sdk/client-secrets-manager | ^3.490.0 | AWS official SDK |

---

## 13. References

| # | Reference | Comments |
|---|-----------|----------|
| 1 | [System Design Document](./SYSTEM-DESIGN.md) | Architecture details |
| 2 | [MCP Specification](https://modelcontextprotocol.io/) | Protocol documentation |
| 3 | [node-postgres Documentation](https://node-postgres.com/) | Database driver |
| 4 | [AWS Redshift IAM Authentication](https://docs.aws.amazon.com/redshift/latest/mgmt/generating-user-credentials.html) | IAM auth flow |

---

## Appendix A: STRIDE Analysis by Component

### A.1 MCP Protocol Layer (stdio)

| STRIDE | Applicable | Analysis |
|--------|------------|----------|
| Spoofing | No | Local IPC, no network exposure |
| Tampering | No | Local IPC, process isolation |
| Repudiation | No | Local single-user context |
| Information Disclosure | No | Local IPC |
| Denial of Service | Low | Process can be killed by user |
| Elevation of Privilege | No | Runs as user's process |

### A.2 Database Connection

| STRIDE | Applicable | Analysis |
|--------|------------|----------|
| Spoofing | Yes | Mitigated by TLS certificate validation (M-002) |
| Tampering | Yes | Mitigated by TLS encryption (M-001) |
| Repudiation | Yes | Mitigated by database audit logs |
| Information Disclosure | Yes | Mitigated by TLS encryption (M-001) |
| Denial of Service | Low | Connection pooling (M-008) |
| Elevation of Privilege | Yes | Mitigated by database permissions (M-003) |

### A.3 AWS API Calls

| STRIDE | Applicable | Analysis |
|--------|------------|----------|
| Spoofing | No | SigV4 authentication |
| Tampering | No | HTTPS + SigV4 |
| Repudiation | No | CloudTrail logging |
| Information Disclosure | No | HTTPS encryption |
| Denial of Service | Low | AWS rate limiting |
| Elevation of Privilege | No | IAM policies |

### A.4 Preset Loading

| STRIDE | Applicable | Analysis |
|--------|------------|----------|
| Spoofing | Low | User controls sources (M-006) |
| Tampering | Yes | Mitigated by HTTPS/S3 SigV4 (M-009) |
| Repudiation | No | Not applicable |
| Information Disclosure | No | Presets are documentation |
| Denial of Service | Low | Presets loaded once at startup |
| Elevation of Privilege | No | Presets are read-only documentation |

---

## Appendix B: Data Classification

| Data | Classification | Handled By | Handling |
|------|---------------|------------|----------|
| Database credentials | Confidential | MCP Server | Env vars or AWS API responses, not logged |
| AWS credentials | Confidential | AWS SDK | SDK manages internally - never exposed to MCP code |
| Query SQL | Internal | MCP Server | Passed to database |
| Query results | Varies (customer data) | MCP Server | Returned to client, not persisted |
| Schema presets | Internal | MCP Server | Documentation only |
| Error messages | Internal | MCP Server | Logged to stderr, no credentials |
