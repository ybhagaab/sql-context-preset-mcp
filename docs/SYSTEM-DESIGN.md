# SQL Client MCP Server - System Design Document

**Version:** 1.2.2  
**Date:** February 2026  
**Purpose:** Security Review Documentation

---

## 1. Executive Summary

SQL Client MCP is a local Model Context Protocol (MCP) server that enables AI assistants to execute SQL queries on PostgreSQL and Amazon Redshift databases. It runs as a stdio-based process on the user's local machine, communicating with MCP-compatible clients (e.g., Kiro, Claude Desktop).

**Key Characteristics:**
- Local execution only (no network server)
- Stdio-based communication (stdin/stdout)
- Single-user, single-tenant architecture
- Credentials never leave the local machine

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User's Local Machine                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     stdio      ┌──────────────────────────────┐   │
│  │  MCP Client  │◄──────────────►│     SQL Client MCP Server    │   │
│  │  (Kiro, etc) │                │                              │   │
│  └──────────────┘                │  ┌────────────────────────┐  │   │
│                                  │  │   MCP Protocol Layer   │  │   │
│                                  │  │  (JSON-RPC over stdio) │  │   │
│                                  │  └───────────┬────────────┘  │   │
│                                  │              │               │   │
│                                  │  ┌───────────▼────────────┐  │   │
│                                  │  │    Tool Handlers       │  │   │
│                                  │  │  - run_query           │  │   │
│                                  │  │  - list_schemas        │  │   │
│                                  │  │  - describe_table      │  │   │
│                                  │  │  - get_schema_context  │  │   │
│                                  │  └───────────┬────────────┘  │   │
│                                  │              │               │   │
│                                  │  ┌───────────▼────────────┐  │   │
│                                  │  │  PostgreSQL Driver     │  │   │
│                                  │  │  (node-postgres/pg)    │  │   │
│                                  │  └───────────┬────────────┘  │   │
│                                  └──────────────┼───────────────┘   │
│                                                 │                    │
└─────────────────────────────────────────────────┼────────────────────┘
                                                  │ TLS/SSL
                                                  ▼
                                    ┌─────────────────────────┐
                                    │   PostgreSQL/Redshift   │
                                    │       Database          │
                                    └─────────────────────────┘
```

---

## 3. Component Details

### 3.1 MCP Protocol Layer

**Technology:** `@modelcontextprotocol/sdk` v1.0.0

**Communication:**
- Transport: Standard I/O (stdin/stdout)
- Protocol: JSON-RPC 2.0
- No network listeners or HTTP endpoints

**Message Flow:**
1. MCP client spawns server process
2. Client sends JSON-RPC requests via stdin
3. Server processes and responds via stdout
4. Server logs errors to stderr (not exposed to client)

### 3.2 Database Connection Layer

**Technology:** `pg` (node-postgres) v8.11.3

**Connection Management:**
- Single connection pool per server instance
- Lazy initialization (connects on first query)
- Connection reuse for subsequent queries
- Automatic reconnection for IAM auth (credential refresh)

**Supported Databases:**
- PostgreSQL (all versions supported by pg driver)
- Amazon Redshift (via PostgreSQL wire protocol)

### 3.3 Schema Context Presets

**Purpose:** Load custom schema documentation to help AI understand database structure.

**Sources (in order of loading):**
1. `SQL_CONTEXT_DIR` - Local directory with .md/.json files
2. `SQL_CONTEXT_FILE` - Single local file
3. `SQL_CONTEXT_S3` - S3 bucket/prefix (async)
4. `SQL_CONTEXT_URL` - HTTP/HTTPS URL (async)

**File Formats:**
- Markdown (.md) - Free-form documentation
- JSON (.json) - Structured schema metadata

---

## 4. Authentication Methods

### 4.1 Direct Authentication (Default)

```
SQL_AUTH_METHOD=direct
```

| Variable | Required | Description |
|----------|----------|-------------|
| SQL_USER | Yes | Database username |
| SQL_PASSWORD | Yes | Database password |

**Security Considerations:**
- Credentials passed via environment variables
- Never written to disk by the server
- Visible in process environment (standard for CLI tools)

### 4.2 AWS IAM Authentication

```
SQL_AUTH_METHOD=iam
```

| Variable | Required | Description |
|----------|----------|-------------|
| SQL_USER | Yes | Redshift database user |
| SQL_CLUSTER_ID | Yes | Redshift cluster identifier |
| SQL_AWS_REGION | No | AWS region (default: us-east-1) |
| SQL_AWS_PROFILE | No | AWS credentials profile |

**Flow:**
1. Server calls `redshift:GetClusterCredentials` API
2. Receives temporary credentials (15-minute validity)
3. Credentials cached in memory (14-minute TTL)
4. Auto-refresh on expiration

**Required IAM Permissions:**
```json
{
  "Effect": "Allow",
  "Action": "redshift:GetClusterCredentials",
  "Resource": [
    "arn:aws:redshift:REGION:ACCOUNT:dbuser:CLUSTER/USER",
    "arn:aws:redshift:REGION:ACCOUNT:dbname:CLUSTER/DATABASE"
  ]
}
```

### 4.3 AWS Secrets Manager Authentication

```
SQL_AUTH_METHOD=secrets_manager
```

| Variable | Required | Description |
|----------|----------|-------------|
| SQL_SECRET_ID | Yes | Secret name or ARN |
| SQL_AWS_REGION | No | AWS region |
| SQL_AWS_PROFILE | No | AWS credentials profile |

**Expected Secret Format:**
```json
{
  "username": "db_user",
  "password": "db_password",
  "host": "optional-override",
  "port": 5439,
  "database": "optional-override"
}
```

**Required IAM Permissions:**
```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:SECRET_NAME-*"
}
```

---

## 5. Security Architecture

### 5.1 Credential Handling

| Aspect | Implementation |
|--------|----------------|
| Storage | Environment variables only (no disk persistence) |
| Transmission | Stdio (local IPC), TLS to database |
| Memory | Cleared on process termination |
| Logging | Credentials never logged (stderr for errors only) |

### 5.2 SSL/TLS Configuration

| Mode | Behavior |
|------|----------|
| `disable` | No encryption (for SSH tunnels) |
| `require` | TLS required, no cert verification (default) |
| `verify-ca` | TLS + CA certificate verification |
| `verify-full` | TLS + CA + hostname verification |

**Additional SSL Options:**
- `SQL_SSL_CA` - CA certificate file path
- `SQL_SSL_CERT` - Client certificate (mutual TLS)
- `SQL_SSL_KEY` - Client private key (mutual TLS)

### 5.3 SQL Injection Protection

**Built-in Protections:**
1. **Parameterized queries** for metadata operations (list_tables, describe_table)
2. **Table name validation** via regex: `/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/`
3. **Result limiting** - Sample data capped at user-specified limit

**User Query Execution (`run_query`):**
- Executes user-provided SQL directly (by design)
- No server-side sanitization (AI assistant responsibility)
- Database-level permissions are the primary control

### 5.4 Access Control Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Access Control Layers                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Local Process Isolation                            │
│  ├─ Server runs as user's local process                      │
│  ├─ No network listeners (stdio only)                        │
│  └─ Inherits user's filesystem/AWS permissions               │
│                                                              │
│  Layer 2: MCP Client Control                                 │
│  ├─ Client decides which tools to expose                     │
│  ├─ User approves tool invocations                           │
│  └─ Client can restrict available operations                 │
│                                                              │
│  Layer 3: Database Permissions                               │
│  ├─ Database user permissions (GRANT/REVOKE)                 │
│  ├─ Row-level security (if configured)                       │
│  └─ Schema-level access control                              │
│                                                              │
│  Layer 4: AWS IAM (for IAM/Secrets Manager auth)             │
│  ├─ IAM policies control credential access                   │
│  ├─ Resource-level permissions on clusters/secrets           │
│  └─ AWS CloudTrail audit logging                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Flow Diagrams

### 6.1 Query Execution Flow

```
┌──────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│   User   │    │ MCP Client  │    │ MCP Server  │    │ Database │
└────┬─────┘    └──────┬──────┘    └──────┬──────┘    └────┬─────┘
     │                 │                  │                 │
     │ "Run query X"   │                  │                 │
     │────────────────►│                  │                 │
     │                 │                  │                 │
     │                 │ JSON-RPC request │                 │
     │                 │ (run_query)      │                 │
     │                 │─────────────────►│                 │
     │                 │                  │                 │
     │                 │                  │ SQL over TLS    │
     │                 │                  │────────────────►│
     │                 │                  │                 │
     │                 │                  │◄────────────────│
     │                 │                  │   Result set    │
     │                 │                  │                 │
     │                 │◄─────────────────│                 │
     │                 │ JSON-RPC response│                 │
     │                 │ (formatted table)│                 │
     │                 │                  │                 │
     │◄────────────────│                  │                 │
     │ Display results │                  │                 │
     │                 │                  │                 │
```

### 6.2 IAM Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│ MCP Server  │    │ AWS STS     │    │ Redshift    │    │ Database │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └────┬─────┘
       │                  │                  │                 │
       │ AssumeRole (if   │                  │                 │
       │ using profile)   │                  │                 │
       │─────────────────►│                  │                 │
       │                  │                  │                 │
       │◄─────────────────│                  │                 │
       │ Temp credentials │                  │                 │
       │                  │                  │                 │
       │ GetClusterCredentials              │                 │
       │─────────────────────────────────────►                 │
       │                                     │                 │
       │◄────────────────────────────────────│                 │
       │ Temp DB credentials (15 min)        │                 │
       │                                     │                 │
       │ Connect with temp credentials                        │
       │──────────────────────────────────────────────────────►│
       │                                                       │
       │◄──────────────────────────────────────────────────────│
       │ Connection established                                │
       │                                                       │
```

---

## 7. Available Tools

| Tool | Description | Parameters | SQL Injection Risk |
|------|-------------|------------|-------------------|
| `run_query` | Execute arbitrary SQL | `sql` (string) | User-controlled (by design) |
| `list_schemas` | List database schemas | None | None (hardcoded query) |
| `list_tables` | List tables in schema | `schema` (string) | Low (parameterized) |
| `describe_table` | Get column info | `table` (string) | Low (parameterized) |
| `get_sample_data` | Preview table rows | `table`, `limit` | Medium (validated regex) |
| `connection_status` | Check connection | None | None (hardcoded query) |
| `get_schema_context` | Load preset docs | `preset` (string) | None (file lookup) |
| `list_presets` | List available presets | None | None |

---

## 8. Dependencies

### 8.1 Runtime Dependencies

| Package | Version | Purpose | Security Notes |
|---------|---------|---------|----------------|
| `@modelcontextprotocol/sdk` | 1.0.0 | MCP protocol implementation | Anthropic-maintained |
| `pg` | ^8.11.3 | PostgreSQL driver | Well-audited, widely used |
| `@aws-sdk/client-redshift` | ^3.490.0 | IAM auth for Redshift | AWS official SDK |
| `@aws-sdk/client-s3` | ^3.490.0 | S3 preset loading | AWS official SDK |
| `@aws-sdk/client-secrets-manager` | ^3.490.0 | Secrets Manager auth | AWS official SDK |

### 8.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.3 | Type checking |
| `ts-node` | ^10.9.2 | Development runtime |
| `@types/node` | ^20.10.6 | Node.js type definitions |
| `@types/pg` | ^8.10.9 | PostgreSQL type definitions |

---

## 9. Deployment Model

### 9.1 Installation Methods

1. **MCP Registry (Recommended)**
   ```bash
   aim mcp install sql-client-mcp
   ```

2. **Manual Installation**
   ```bash
   git clone <repository>
   cd mcp-server && npm install && npm run build
   ```

### 9.2 Runtime Configuration

**MCP Client Configuration (mcp.json):**
```json
{
  "mcpServers": {
    "sql-client": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SQL_HOST": "...",
        "SQL_DATABASE": "...",
        "SQL_AUTH_METHOD": "iam",
        "SQL_CLUSTER_ID": "...",
        "SQL_USER": "..."
      }
    }
  }
}
```

### 9.3 Process Lifecycle

1. MCP client spawns server process
2. Server initializes (no connections yet)
3. First tool call triggers database connection
4. Connection pooled for subsequent calls
5. SIGINT triggers graceful shutdown (connection release)

---

## 10. Threat Model

### 10.1 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRUSTED: User's Machine                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MCP Client Process                      │  │
│  │  - Controls tool invocation                                │  │
│  │  - User approval for operations                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ stdio                             │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    MCP Server Process                      │  │
│  │  - Executes SQL queries                                    │  │
│  │  - Manages credentials in memory                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────┘
                               │ TLS (Trust Boundary)
┌──────────────────────────────▼───────────────────────────────────┐
│                    EXTERNAL: Database Server                      │
│  - Enforces authentication                                        │
│  - Enforces authorization (GRANT/REVOKE)                          │
│  - Audit logging                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Identified Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Credential exposure in env vars | Medium | Standard practice for CLI tools; use IAM/Secrets Manager for sensitive environments |
| SQL injection via `run_query` | Medium | By design (user-controlled); rely on database permissions |
| Malicious preset files | Low | User controls preset sources; files are documentation only |
| Man-in-the-middle (database) | Medium | TLS enabled by default; verify-full mode available |
| Unauthorized database access | Low | Database-level auth required; IAM provides audit trail |

### 10.3 Out of Scope Threats

- Compromised user machine (server inherits user's trust level)
- Malicious MCP client (client controls server lifecycle)
- Database server vulnerabilities (external system)

---

## 11. Audit & Logging

### 11.1 Server-Side Logging

| Event | Destination | Content |
|-------|-------------|---------|
| Startup | stderr | "SQL MCP with Context Presets running on stdio" |
| Preset loading | stderr | Preset count and source |
| Errors | stderr | Error messages (no credentials) |

### 11.2 External Audit Points

| System | Events Logged |
|--------|---------------|
| AWS CloudTrail | GetClusterCredentials, GetSecretValue calls |
| Database audit logs | Query execution (if enabled) |
| S3 access logs | Preset file access (if enabled) |

---

## 12. Compliance Considerations

| Requirement | Implementation |
|-------------|----------------|
| Data at rest | No local data storage; database handles encryption |
| Data in transit | TLS to database (configurable modes) |
| Access control | Database permissions + IAM policies |
| Audit trail | CloudTrail (AWS auth) + database logs |
| Credential rotation | Supported via Secrets Manager |

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01 | Initial release with direct auth |
| 1.1.0 | 2025-01 | Added IAM and Secrets Manager auth |
| 1.2.0 | 2025-02 | Added S3 and HTTP preset sources |
| 1.2.2 | 2025-02 | Current version |

---

## Appendix A: Environment Variables Reference

| Variable | Auth Method | Required | Default | Description |
|----------|-------------|----------|---------|-------------|
| SQL_HOST | All | Yes* | - | Database hostname |
| SQL_PORT | All | No | 5439 | Database port |
| SQL_DATABASE | All | Yes* | - | Database name |
| SQL_AUTH_METHOD | All | No | direct | Authentication method |
| SQL_USER | Direct/IAM | Yes | - | Database username |
| SQL_PASSWORD | Direct | Yes | - | Database password |
| SQL_CLUSTER_ID | IAM | Yes | - | Redshift cluster ID |
| SQL_SECRET_ID | Secrets | Yes | - | Secret name/ARN |
| SQL_AWS_REGION | IAM/Secrets | No | us-east-1 | AWS region |
| SQL_AWS_PROFILE | IAM/Secrets | No | - | AWS profile name |
| SQL_SSL_MODE | All | No | require | SSL mode |
| SQL_SSL_CA | All | No | - | CA certificate path |
| SQL_SSL_CERT | All | No | - | Client cert path |
| SQL_SSL_KEY | All | No | - | Client key path |
| SQL_CONTEXT_DIR | All | No | - | Local preset directory |
| SQL_CONTEXT_FILE | All | No | - | Single preset file |
| SQL_CONTEXT_S3 | All | No | - | S3 preset URI |
| SQL_CONTEXT_URL | All | No | - | HTTP preset URL |

*Can be provided via Secrets Manager secret

---

## Appendix B: File Structure

```
mcp-server/
├── src/
│   ├── index.ts          # Main server entry point
│   └── presets/
│       └── index.ts      # Schema preset loader
├── dist/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```
