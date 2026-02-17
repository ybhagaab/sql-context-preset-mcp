# SQL Client MCP Server - AppSec Review Package

**Server ID:** `sql-client-mcp`  
**Version:** 1.3.0  
**Talos Engagement:** `b31119a8-2de4-4c05-89ae-970645a84236`  
**Review Status:** `review_requested`

## Overview

This directory contains all documentation required for AppSec security review of the local SQL Client MCP Server.

## Documents

| Document | Purpose |
|----------|---------|
| [APPLICATION-OVERVIEW.md](APPLICATION-OVERVIEW.md) | High-level application description and architecture |
| [SYSTEM-DESIGN.md](../docs/SYSTEM-DESIGN.md) | Detailed system design document |
| [THREAT-MODEL.md](../docs/THREAT-MODEL.md) | STRIDE threat analysis and mitigations |
| [DATA-ELEMENTS.md](DATA-ELEMENTS.md) | Data classification and handling |
| [SECURITY-PROPERTIES.md](SECURITY-PROPERTIES.md) | Security controls and properties |
| [ATC-SCAN-RESULTS.md](ATC-SCAN-RESULTS.md) | Agent Tool Checker scan results |

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Deployment Model** | Local process (stdio-based, no network listeners) |
| **Authentication** | Direct, IAM, or Secrets Manager |
| **Data Storage** | None (no local persistence) |
| **Network Exposure** | None (communicates via stdin/stdout only) |
| **Trust Model** | Inherits user's local machine trust level |

## Key Security Properties

1. **No Network Exposure** - Server runs as local process, communicates via stdio only
2. **No Credential Storage** - Credentials passed via environment variables, never persisted
3. **TLS by Default** - Database connections use TLS encryption (configurable)
4. **IAM Support** - Supports AWS IAM authentication for Redshift (no long-lived credentials)
5. **Single-User** - No multi-tenancy, runs with user's permissions
6. **Input Validation** - Zod schema validation on all tool inputs
7. **Output Validation** - Zod schema validation on all tool outputs
8. **Response Sanitization** - Hidden character stripping to prevent smuggling attacks
9. **Response Size Limits** - Configurable limits (max 10K rows, 1MB response)

## Credential Handling

**Important distinction between credential types:**

| Credential Type | Handled By | Notes |
|-----------------|------------|-------|
| **AWS Credentials** (Access Key, Secret Key, Session Token) | AWS SDK | SDK manages internally via credential chain - MCP server code never reads/stores these |
| **Database Credentials** (username, password) | MCP Server | Only when using Direct auth mode (env vars) or parsed from AWS API responses |

**Authentication modes:**
- **Direct:** User configures `SQL_USER` and `SQL_PASSWORD` in MCP client config → MCP server reads from env vars
- **IAM:** AWS SDK handles AWS auth → MCP server receives temp DB credentials from `GetClusterCredentials` API
- **Secrets Manager:** AWS SDK handles AWS auth → MCP server parses DB credentials from `GetSecretValue` JSON response

## Talos Links

- **Engagement:** https://talos.security.aws.a2z.com/#/talos/engagement/arn:aws:talos-engagement:engagement/b31119a8-2de4-4c05-89ae-970645a84236
- **Bindle:** `amzn1.bindle.resource.hue24zstnfvm2qxvxpkq`

## Contact

For questions about this security review, contact the team via the [repository](https://code.amazon.com/packages/PostgreSQLMCP).
