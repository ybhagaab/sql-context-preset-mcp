# Design Inspector - Data Elements by Component

**Diagram:** Local MCP Server- SQL  
**Purpose:** Data elements for each system component (DACE classification)  
**Last Updated:** February 17, 2026

---

## Key Principle: Data Handling vs Data Transit

**Important distinction:**
- **Handles/Processes:** Component parses, validates, transforms, or stores the data
- **Transit Only:** Data passes through encrypted, component doesn't inspect contents

---

## Owned Components (Security Review Scope)

1. ✅ **SQL Client MCP Server** - Main application process
2. ✅ **PostgreSQL Driver (pg)** - Database connection library

**Out of Scope (External/Annotations):**
- ❌ MCP Client (Kiro/Claude) - external
- ❌ PostgreSQL/Redshift Database - external
- ❌ AWS IAM - external AWS service
- ❌ AWS Secrets Manager - external AWS service
- ❌ AWS S3 - external AWS service

---

## 1. SQL Client MCP Server

**Role:** MCP protocol handler, tool execution, credential management

### Data Elements Processed

| Data Element | Classification | Handling | Storage | Logged? |
|--------------|----------------|----------|---------|---------|
| **Database Username** | Confidential | Read from env vars OR parsed from Secrets Manager response | Memory only | ❌ Never |
| **Database Password** | Confidential | Read from env vars OR parsed from Secrets Manager response | Memory only | ❌ Never |
| **IAM Temp DB Credentials** | Confidential | Received from `GetClusterCredentials` API, cached in `iamCredentialsCache` | Memory (14 min TTL) | ❌ Never |
| **SQL Query** | Internal | Parsed from MCP request, passed to pg driver | Memory only | ❌ No |
| **Query Results** | Customer Data | Received from pg driver, formatted as text | Memory only | ❌ Never |
| **MCP Request/Response** | Internal | Parsed (stdin) and generated (stdout) | Memory only | ❌ No |
| **Schema Preset Content** | Internal | Loaded from local/S3/HTTP sources | Memory only | ❌ No |
| **Table/Schema Names** | Internal | Validated via regex, used in parameterized queries | Memory only | ❌ No |
| **Error Messages** | Internal | Generated (no credentials included) | stderr only | ✅ stderr |

### Data Elements NOT Handled by MCP Server (AWS SDK Managed)

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| **AWS Access Key ID** | Confidential | AWS SDK credential chain (env vars, profile, IAM role) |
| **AWS Secret Access Key** | Confidential | AWS SDK credential chain |
| **AWS Session Token** | Confidential | AWS SDK credential chain |

**Note:** AWS credentials are used by the AWS SDK to sign API requests (`GetClusterCredentials`, `GetSecretValue`, S3 operations). The MCP server code does not directly read, store, or handle these - the SDK manages them internally.

### Data Flow

```
1. Startup: Load credentials from environment variables
2. Startup: Load schema presets from configured sources
3. Receive: MCP request via stdin (JSON-RPC)
4. Parse: Extract tool name and parameters
5. Validate: Table names via regex (for metadata tools)
6. Execute: Pass query to PostgreSQL Driver
7. Receive: Results from PostgreSQL Driver
8. Format: Convert results to MCP response
9. Return: MCP response via stdout
10. Log: Errors only to stderr (no credentials, no results)
```

### Security Properties

| Property | Status | Implementation |
|----------|--------|----------------|
| has authentication control | ❌ NO | Delegates to database |
| has authorization control | ❌ NO | Delegates to database |
| has data-at-rest protection | ❌ N/A | No persistence (memory only) |
| has data-in-transit protection | ✅ YES | TLS to database via pg driver |
| has data tamper protection | ✅ YES | TLS digital signatures |
| has network-level access control | ✅ YES | No network listeners (stdio only) |
| uses SQL injection prevention | ⚠️ PARTIAL | Parameterized metadata queries |
| uses CSRF protection | ❌ N/A | Not a web application |
| uses XSS protection | ❌ N/A | Not a web application |

### SQL Injection Prevention Note

Mark as PARTIAL because:
- ✅ Parameterized queries for metadata tools (list_tables, describe_table)
- ✅ Table name regex validation
- ❌ run_query tool executes arbitrary SQL (by design)

**Primary mitigation:** Database-level permissions (recommend read-only users)

---

## 2. PostgreSQL Driver (pg)

**Role:** Database connection, TLS encryption, query execution

### Data Elements Processed

| Data Element | Classification | Handling | Storage | Logged? |
|--------------|----------------|----------|---------|---------|
| **Database Credentials** | Confidential | Used for authentication | Memory (connection) | ❌ Never |
| **SQL Query** | Internal | Sent to database | Memory only | ❌ No |
| **Query Results** | Customer Data | Received from database | Memory only | ❌ No |
| **TLS Session Keys** | Confidential | TLS handshake | Memory only | ❌ Never |
| **Connection Parameters** | Internal | Host, port, database | Memory only | ❌ No |

### Data Flow

```
1. Receive: Connection parameters from MCP Server
2. Establish: TLS connection to database
3. Authenticate: Send credentials to database
4. Receive: SQL query from MCP Server
5. Execute: Send query over TLS connection
6. Receive: Results from database over TLS
7. Return: Results to MCP Server
```

### Security Properties

| Property | Status | Implementation |
|----------|--------|----------------|
| has authentication control | ❌ NO | Passes credentials to database |
| has authorization control | ❌ NO | Database enforces permissions |
| has data-at-rest protection | ❌ N/A | No persistence |
| has data-in-transit protection | ✅ YES | TLS 1.2+ to database |
| has data tamper protection | ✅ YES | TLS digital signatures |
| has network-level access control | ❌ NO | Connects to configured host |
| uses SQL injection prevention | ✅ YES | Supports parameterized queries |
| uses CSRF protection | ❌ N/A | Not a web application |
| uses XSS protection | ❌ N/A | Not a web application |

### TLS Configuration

| SSL Mode | Encryption | Certificate Validation |
|----------|------------|------------------------|
| `disable` | None | None |
| `require` | TLS 1.2+ | Skip verification (default) |
| `verify-ca` | TLS 1.2+ | CA certificate |
| `verify-full` | TLS 1.2+ | CA + hostname |

---

## 3. External Systems (Annotations Only)

These components are marked as annotations in Design Inspector - not part of security review scope.

### 3.1 MCP Client (Kiro/Claude)

**Role:** User interface, tool invocation control

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| User prompts | Internal | Natural language input |
| MCP requests | Internal | Generated from prompts |
| Query results | Customer Data | Displayed to user |

### 3.2 PostgreSQL / Redshift Database

**Role:** Data storage, query execution

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| Customer data | Customer Data | Persistent storage |
| Database credentials | Confidential | Authentication |
| SQL queries | Internal | Executed |

### 3.3 AWS IAM

**Role:** Temporary credential generation

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| AWS credentials | Confidential | SigV4 authentication |
| Temp DB credentials | Confidential | Generated (15 min validity) |

### 3.4 AWS Secrets Manager

**Role:** Credential storage

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| Database credentials | Confidential | Encrypted storage |

### 3.5 AWS S3

**Role:** Schema preset storage

| Data Element | Classification | Handling |
|--------------|----------------|----------|
| Preset files | Internal | Object storage |

---

## Summary: Data Classification by Component

| Component | Confidential | Customer Data | Internal |
|-----------|--------------|---------------|----------|
| **SQL Client MCP Server** | 3 | 1 | 5 |
| **PostgreSQL Driver (pg)** | 2 | 1 | 2 |

**Note:** AWS credentials (Access Key, Secret Key, Session Token) are managed by the AWS SDK, not the MCP server code directly.

---

## Data Retention Summary

| Data Element | Retention Period | Deletion Method |
|--------------|-----------------|-----------------|
| Database credentials | Process lifetime | Process termination |
| AWS credentials | Per AWS SDK | AWS SDK managed |
| IAM temp credentials | 14 minutes | Auto-expire + process termination |
| SQL queries | Execution duration | Garbage collection |
| Query results | Response duration | Garbage collection |
| Schema presets | Process lifetime | Process termination |
| Error messages | None | Not persisted |

**Key Point:** Neither component persists any data to disk. All data is held in memory only and cleared when the process terminates.

---

## Data Elements EXCLUDED (Never Logged/Stored)

- ❌ Database credentials (username, password)
- ❌ AWS credentials
- ❌ IAM temporary credentials
- ❌ Query results (customer data)
- ❌ TLS session keys
