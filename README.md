# SQL Client MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to execute SQL queries on PostgreSQL and Redshift databases.

## Features

- Execute SQL queries with formatted results
- Browse schemas, tables, and columns
- Multiple authentication methods (Direct, IAM, Secrets Manager)
- SSL/TLS support with multiple modes
- Custom schema context presets for team knowledge sharing

### Available Tools

| Tool | Description |
|------|-------------|
| `run_query` | Execute any SQL query |
| `list_schemas` | List all database schemas |
| `list_tables` | List tables in a schema |
| `describe_table` | Get column information for a table |
| `get_sample_data` | Preview rows from a table |
| `connection_status` | Check connection health |
| `get_schema_context` | Load custom schema knowledge |
| `list_presets` | List available schema context presets |

## Installation

```bash
cd mcp-server
npm install
npm run build
```

---

## Authentication Methods

The server supports three authentication methods. Choose the one that fits your security requirements.

### Method 1: Direct Authentication (Default)

Use username and password directly. Simple setup, but requires storing credentials.

**When to use:** Local development, quick setup, or when other methods aren't available.

**Full MCP Configuration:**

```json
{
  "mcpServers": {
    "sql-client": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SQL_AUTH_METHOD": "direct",
        "SQL_HOST": "your-cluster.xxxx.us-east-1.redshift.amazonaws.com",
        "SQL_PORT": "5439",
        "SQL_DATABASE": "your_database",
        "SQL_USER": "your_username",
        "SQL_PASSWORD": "your_password",
        "SQL_SSL_MODE": "require"
      }
    }
  }
}
```

**Required Variables:**
| Variable | Description |
|----------|-------------|
| `SQL_HOST` | Database hostname |
| `SQL_DATABASE` | Database name |
| `SQL_USER` | Database username |
| `SQL_PASSWORD` | Database password |

---

### Method 2: IAM Authentication (Redshift)

Use your AWS IAM identity to get temporary database credentials. No password storage needed!

**When to use:** Redshift databases, when you want to avoid storing passwords, or when using AWS SSO.

**Full MCP Configuration:**

```json
{
  "mcpServers": {
    "sql-client": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SQL_AUTH_METHOD": "iam",
        "SQL_HOST": "your-cluster.xxxx.us-east-1.redshift.amazonaws.com",
        "SQL_PORT": "5439",
        "SQL_DATABASE": "your_database",
        "SQL_USER": "your_db_user",
        "SQL_CLUSTER_ID": "your-cluster",
        "SQL_AWS_REGION": "us-east-1",
        "SQL_SSL_MODE": "require"
      }
    }
  }
}
```

**Required Variables:**
| Variable | Description |
|----------|-------------|
| `SQL_HOST` | Redshift cluster endpoint |
| `SQL_DATABASE` | Database name |
| `SQL_USER` | Redshift database user (must exist in cluster) |
| `SQL_CLUSTER_ID` | Redshift cluster identifier (not the full endpoint) |
| `SQL_AWS_REGION` | AWS region where cluster is located |

**Optional Variables:**
| Variable | Description |
|----------|-------------|
| `SQL_AWS_PROFILE` | AWS profile name from `~/.aws/credentials` |

**How it works:**
1. Server uses your AWS credentials (env vars, profile, or IAM role)
2. Calls `redshift:GetClusterCredentials` to get temporary credentials
3. Credentials are cached for 14 minutes, auto-refreshed when expired

**Required IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "redshift:GetClusterCredentials",
      "Resource": [
        "arn:aws:redshift:us-east-1:123456789012:dbuser:your-cluster/your_db_user",
        "arn:aws:redshift:us-east-1:123456789012:dbname:your-cluster/your_database"
      ]
    }
  ]
}
```

---

### Method 3: AWS Secrets Manager

Fetch credentials from AWS Secrets Manager. Great for credential rotation and team sharing.

**When to use:** Enterprise environments, when credentials need rotation, or sharing access across a team.

**Full MCP Configuration:**

```json
{
  "mcpServers": {
    "sql-client": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "SQL_AUTH_METHOD": "secrets_manager",
        "SQL_SECRET_ID": "prod/analytics/redshift-credentials",
        "SQL_AWS_REGION": "us-east-1",
        "SQL_SSL_MODE": "require"
      }
    }
  }
}
```

**Required Variables:**
| Variable | Description |
|----------|-------------|
| `SQL_SECRET_ID` | Secret name or full ARN in Secrets Manager |
| `SQL_AWS_REGION` | AWS region where secret is stored |

**Optional Variables (can be in secret instead):**
| Variable | Description |
|----------|-------------|
| `SQL_HOST` | Database hostname (overridden by secret if present) |
| `SQL_PORT` | Database port (overridden by secret if present) |
| `SQL_DATABASE` | Database name (overridden by secret if present) |
| `SQL_AWS_PROFILE` | AWS profile name |

**Secret JSON Format:**
```json
{
  "username": "db_user",
  "password": "db_password",
  "host": "your-cluster.xxxx.us-east-1.redshift.amazonaws.com",
  "port": 5439,
  "database": "your_database"
}
```

The `host`, `port`, and `database` fields in the secret are optional - they override environment variables if present.

**Required IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/analytics/redshift-credentials-*"
    }
  ]
}
```

---

## SSL Configuration

Control SSL/TLS behavior with `SQL_SSL_MODE`:

| Mode | Description | Use Case |
|------|-------------|----------|
| `disable` | No SSL | SSH tunnels, local development |
| `require` | SSL on, skip cert verification | VPC endpoints (default) |
| `verify-ca` | SSL on, verify CA certificate | Production with custom CA |
| `verify-full` | SSL on, verify cert + hostname | Highest security |

**Example with certificate verification:**
```json
{
  "env": {
    "SQL_SSL_MODE": "verify-full",
    "SQL_SSL_CA": "/path/to/ca-certificate.pem",
    "SQL_SSL_CERT": "/path/to/client-cert.pem",
    "SQL_SSL_KEY": "/path/to/client-key.pem"
  }
}
```

---

## SSH Tunnel Setup

For databases behind a bastion host:

1. Start SSH tunnel:
   ```bash
   ssh -L 5439:internal-db-host:5439 bastion-user@bastion-host
   ```

2. Configure MCP to use tunnel:
   ```json
   {
     "mcpServers": {
       "sql-client": {
         "command": "node",
         "args": ["/path/to/mcp-server/dist/index.js"],
         "env": {
           "SQL_HOST": "localhost",
           "SQL_PORT": "5439",
           "SQL_DATABASE": "your_database",
           "SQL_USER": "your_username",
           "SQL_PASSWORD": "your_password",
           "SQL_SSL_MODE": "disable"
         }
       }
     }
   }
   ```

---

## Schema Context Presets

Provide custom schema documentation for your team & include all contexual information pertaining to the events, parameters, values & tables. You can add multiple schemas which will show as presets for your AI assistant to choose from:

```json
{
  "env": {
    "SQL_CONTEXT_DIR": "/path/to/team-contexts"
  }
}
```

**Markdown format (`my-schema.md`):**
```markdown
# Analytics Schema

## Main Tables
- user_events - User activity tracking
- transactions - Payment data

## Required Filters
Always include: `status = 'active'`
```

**JSON format (`my-schema.json`):**
```json
{
  "name": "Analytics",
  "description": "Team analytics database",
  "context": "# Schema documentation here..."
}
```

**Usage in chat:**
- "List available presets"
- "Get the my-schema context"

---

## Complete Configuration Reference

### All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Connection** ||||
| `SQL_HOST` | Yes* | - | Database host |
| `SQL_PORT` | No | `5439` | Database port |
| `SQL_DATABASE` | Yes* | - | Database name |
| **Authentication** ||||
| `SQL_AUTH_METHOD` | No | `direct` | `direct`, `iam`, or `secrets_manager` |
| `SQL_USER` | Direct/IAM | - | Database username |
| `SQL_PASSWORD` | Direct | - | Database password |
| `SQL_CLUSTER_ID` | IAM | - | Redshift cluster identifier |
| `SQL_SECRET_ID` | SM | - | Secrets Manager secret name/ARN |
| `SQL_AWS_REGION` | IAM/SM | `us-east-1` | AWS region |
| `SQL_AWS_PROFILE` | No | - | AWS profile name |
| **SSL** ||||
| `SQL_SSL_MODE` | No | `require` | SSL mode |
| `SQL_SSL_CA` | No | - | CA certificate path |
| `SQL_SSL_CERT` | No | - | Client certificate path |
| `SQL_SSL_KEY` | No | - | Client private key path |
| **Context** ||||
| `SQL_CONTEXT_DIR` | No | - | Schema context directory |
| `SQL_CONTEXT_FILE` | No | - | Single context file path |

*Can be provided via Secrets Manager secret

---

## Usage Examples

Once configured, ask the AI assistant:

- "Show me all schemas in the database"
- "List tables in the analytics schema"
- "Describe the users table"
- "Get 10 sample rows from orders"
- "Run: SELECT COUNT(*) FROM events WHERE date > '2025-01-01'"

---

## Why MCP Schema Presets vs Steering Files?

If you're using Kiro or similar AI assistants, you might wonder: "Why not just use steering files for database context?"

The key differences:

| Aspect | Steering Files | MCP Schema Presets |
|--------|---------------|-------------------|
| Scope | Workspace-bound (`.kiro/steering/`) | User-level, works across all workspaces |
| Loading | Always loaded or file-pattern triggered | On-demand via `list_presets` → `get_schema_context` |
| Multi-schema | All files load together (bloats context) | Pick exactly which schema to load |
| Sharing | Copy files to each workspace | Point to shared folder (team drive, S3, wiki export) |
| Discovery | Must know exact filename to reference | `list_presets` shows all available options |

**When MCP presets shine:**

- **On-demand loading** - Schema context is only loaded when you ask for it. No wasted tokens when you're not doing SQL work.

- **Multiple schemas, selective loading** - Have 5 different database schemas? Load only the one you need:
  ```
  /team-contexts/
    analytics.md      → "get analytics context"
    payments.md       → "get payments context"
    user-events.md    → "get user-events context"
  ```

- **Works everywhere** - Your database knowledge follows you across any workspace, project, or scratch folder.

- **Centralized team sharing** - Point `SQL_CONTEXT_DIR` to a shared location. Update once, everyone gets the latest schema docs.

- **Integrated with SQL tools** - The AI knows to load context BEFORE writing queries, and can combine it with `describe_table`, `list_schemas` for complete understanding.

**Bottom line:** Steering files = "how to code in this repo". MCP presets = "how to query this database, anywhere."

---

## Security Notes

- Credentials are passed via environment variables (never stored in code)
- IAM auth uses temporary credentials that auto-expire
- Secrets Manager supports automatic credential rotation
- SSL is enabled by default
- VPN may be required for private endpoints

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev
```
