# SQL Client MCP Server - Application Overview

**Version:** 1.2.1  
**Date:** February 2026  
**Purpose:** AppSec Review Documentation

---

## 1. What is this application?

SQL Client MCP is a **local Model Context Protocol (MCP) server** that enables AI assistants (Kiro, Claude Desktop) to execute SQL queries on PostgreSQL and Amazon Redshift databases.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Type** | Local CLI tool / MCP server |
| **Deployment** | User's local machine only |
| **Communication** | stdio (stdin/stdout) - no network listeners |
| **Users** | Single user (the person running the tool) |
| **Data Storage** | None - no local persistence |

### What it does

1. Receives SQL query requests from MCP clients (Kiro, Claude Desktop) via stdin
2. Connects to PostgreSQL/Redshift databases using user-provided credentials
3. Executes queries and returns results via stdout
4. Provides schema browsing tools (list tables, describe columns)
5. Loads custom schema documentation (presets) for AI context

### What it does NOT do

- Does NOT expose any network endpoints
- Does NOT store credentials to disk
- Does NOT filter or sanitize SQL queries (by design - executes user/AI-provided SQL)
- Does NOT implement multi-tenancy
- Does NOT run as a service/daemon

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User's Local Machine (Trusted)               │
│                                                                 │
│  ┌──────────────┐    stdio     ┌─────────────────────────────┐ │
│  │  MCP Client  │◄────────────►│   SQL Client MCP Server     │ │
│  │  (Kiro)      │              │                             │ │
│  └──────────────┘              │  • No network exposure      │ │
│                                │  • Runs as user's process   │ │
│                                │  • No credential storage    │ │
│                                └───────────────┬─────────────┘ │
└────────────────────────────────────────────────┼───────────────┘
                                                 │ TLS/SSL
                                                 ▼
                                   ┌─────────────────────────┐
                                   │  PostgreSQL / Redshift  │
                                   │       Database          │
                                   └─────────────────────────┘
```

---

## 3. Trust Model

### Trust Boundaries

| Boundary | Trust Level | Rationale |
|----------|-------------|-----------|
| User's local machine | Trusted | Server runs as user's process with user's permissions |
| MCP Client (Kiro) | Trusted | Client controls server lifecycle and tool invocation |
| Database Server | External | Requires authentication; enforces authorization |
| AWS APIs | External | Requires IAM authentication |

### Key Assumption

**The user's local machine is trusted.** This is the fundamental security assumption. The server:
- Runs with the user's permissions
- Has access to the user's AWS credentials
- Can connect to any database the user has credentials for

This is the same trust model as any CLI database tool (psql, mysql, etc.).

---

## 4. Authentication Methods

| Method | Credential Source | Storage | Rotation |
|--------|------------------|---------|----------|
| **Direct** | Environment variables (SQL_USER, SQL_PASSWORD) | Memory only | Manual |
| **IAM** | AWS credential chain → Redshift GetClusterCredentials | Memory (14 min cache) | Automatic |
| **Secrets Manager** | AWS Secrets Manager | Memory only | Automatic |

### Credential Handling Responsibility

**Important:** There are two distinct credential types with different handling:

| Credential Type | Handled By | MCP Server Role |
|-----------------|------------|-----------------|
| **AWS Credentials** (Access Key, Secret Key, Session Token) | AWS SDK | Not handled - SDK manages via credential chain |
| **Database Credentials** (username, password) | MCP Server | Reads from env vars OR parses from AWS API responses |

**AWS SDK Credential Chain (handled internally by AWS SDK):**
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- AWS profile (`~/.aws/credentials`)
- IAM role (EC2, ECS, Lambda)
- Web identity token

**MCP Server only handles database credentials:**
- **Direct mode:** Reads `SQL_USER` and `SQL_PASSWORD` from environment variables configured in MCP client
- **IAM mode:** Receives temp DB credentials from `GetClusterCredentials` API response, caches in memory (14 min)
- **Secrets Manager mode:** Parses username/password from `GetSecretValue` API response JSON

### Credential Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS SDK (Internal)                           │
│  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN   │
│  → Used to sign AWS API requests (never exposed to MCP code)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ AWS API Calls
┌─────────────────────────────────────────────────────────────────┐
│  AWS Services (Secrets Manager, Redshift GetClusterCredentials) │
│  → Return database credentials in API response                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server Process                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Database credentials in memory only                    │   │
│  │  • Direct: SQL_USER, SQL_PASSWORD from env vars         │   │
│  │  • IAM: Temp creds from GetClusterCredentials response  │   │
│  │  • Secrets: Parsed from GetSecretValue JSON response    │   │
│  │  • Never written to disk, never logged                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ TLS Connection
┌─────────────────────────────────────────────────────────────────┐
│                    Database Server                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow

### Query Execution Flow

1. User asks AI assistant to query database
2. AI generates SQL query
3. MCP client sends `run_query` tool call via stdin
4. Server executes query against database (TLS)
5. Server returns results via stdout
6. AI presents results to user

### Data Classification

| Data | Classification | Handling |
|------|---------------|----------|
| Database credentials | Confidential | Env vars only, never logged |
| AWS credentials | Confidential | AWS credential chain |
| Query SQL | Internal | Passed to database |
| Query results | Varies (customer data) | Returned to client, not persisted |
| Schema presets | Internal | Documentation only |

---

## 6. Available Tools

| Tool | Description | Risk Level |
|------|-------------|------------|
| `run_query` | Execute arbitrary SQL | Medium (user-controlled) |
| `list_schemas` | List database schemas | Low |
| `list_tables` | List tables in schema | Low |
| `describe_table` | Get column information | Low |
| `get_sample_data` | Preview table rows | Low |
| `connection_status` | Check connection | Low |
| `get_schema_context` | Load preset documentation | Low |
| `list_presets` | List available presets | Low |

---

## 7. Dependencies

| Package | Version | Purpose | Security Notes |
|---------|---------|---------|----------------|
| `@modelcontextprotocol/sdk` | 1.25.4 | MCP protocol | Anthropic-maintained |
| `pg` | ^8.11.3 | PostgreSQL driver | Well-audited |
| `@aws-sdk/client-redshift` | ^3.490.0 | IAM auth | AWS official |
| `@aws-sdk/client-s3` | ^3.490.0 | S3 presets | AWS official |
| `@aws-sdk/client-secrets-manager` | ^3.490.0 | Secrets auth | AWS official |

---

## 8. Comparison with Similar Tools

| Aspect | psql (PostgreSQL CLI) | SQL Client MCP |
|--------|----------------------|----------------|
| Deployment | Local CLI | Local MCP server |
| Communication | Terminal I/O | stdio (JSON-RPC) |
| Credential handling | Env vars / .pgpass | Env vars only |
| Query execution | User types SQL | AI generates SQL |
| Network exposure | None | None |
| Trust model | User's machine | User's machine |

The security model is equivalent to standard database CLI tools.

---

## 9. Out of Scope

The following are explicitly out of scope for this application:

| Item | Rationale |
|------|-----------|
| Multi-user access | Single-user local tool |
| Network API endpoints | stdio-only communication |
| Credential storage | Env vars only |
| SQL query filtering | By design - executes user/AI SQL |
| Rate limiting | Single-user local tool |

---

## 10. Related Documentation

| Document | Description |
|----------|-------------|
| [SYSTEM-DESIGN.md](../docs/SYSTEM-DESIGN.md) | Detailed architecture and components |
| [THREAT-MODEL.md](../docs/THREAT-MODEL.md) | STRIDE analysis and mitigations |
| [README.md](../README.md) | User documentation and configuration |
