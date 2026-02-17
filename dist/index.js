#!/usr/bin/env node
"use strict";
/**
 * SQL MCP with Context Presets
 *
 * Provides tools for executing SQL queries on PostgreSQL/Redshift databases
 * via the Model Context Protocol.
 *
 * Supports multiple authentication methods:
 * - Direct username/password
 * - AWS IAM Authentication (Redshift)
 * - AWS Secrets Manager
 *
 * Security Features:
 * - Zod schema validation for all inputs and outputs
 * - Response content sanitization (hidden character stripping)
 * - Response size limits
 * - Semantic validation checks
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const pg_1 = require("pg");
const zod_1 = require("zod");
const index_js_2 = require("./presets/index.js");
const schemas_js_1 = require("./validation/schemas.js");
const sanitizer_js_1 = require("./validation/sanitizer.js");
// Connection pool (lazy initialized)
let pool = null;
let client = null;
// Cache for IAM credentials (they expire after ~15 minutes)
let iamCredentialsCache = null;
/**
 * Get credentials from AWS Secrets Manager
 */
async function getSecretsManagerCredentials() {
    const { SecretsManagerClient, GetSecretValueCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-secrets-manager')));
    const secretId = process.env.SQL_SECRET_ID;
    if (!secretId) {
        throw new Error('SQL_SECRET_ID is required when using secrets_manager authentication');
    }
    const region = process.env.SQL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
    const clientConfig = { region };
    if (process.env.SQL_AWS_PROFILE) {
        // Profile will be picked up from AWS_PROFILE env var or credentials file
        process.env.AWS_PROFILE = process.env.SQL_AWS_PROFILE;
    }
    const client = new SecretsManagerClient(clientConfig);
    try {
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
        if (!response.SecretString) {
            throw new Error('Secret does not contain a string value');
        }
        const secret = JSON.parse(response.SecretString);
        // Support common secret formats
        return {
            host: secret.host || secret.hostname || secret.endpoint,
            port: secret.port ? parseInt(secret.port, 10) : undefined,
            database: secret.database || secret.dbname || secret.db,
            user: secret.username || secret.user,
            password: secret.password,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to retrieve secret from Secrets Manager: ${message}`);
    }
}
/**
 * Get temporary credentials using IAM authentication for Redshift
 */
async function getIAMCredentials() {
    // Check cache first (credentials are valid for ~15 minutes)
    if (iamCredentialsCache && Date.now() < iamCredentialsCache.expiry) {
        return { user: iamCredentialsCache.user, password: iamCredentialsCache.password };
    }
    const { RedshiftClient, GetClusterCredentialsCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-redshift')));
    const clusterId = process.env.SQL_CLUSTER_ID;
    const dbUser = process.env.SQL_USER;
    const database = process.env.SQL_DATABASE;
    if (!clusterId) {
        throw new Error('SQL_CLUSTER_ID is required when using IAM authentication');
    }
    if (!dbUser) {
        throw new Error('SQL_USER is required when using IAM authentication (Redshift database user)');
    }
    if (!database) {
        throw new Error('SQL_DATABASE is required when using IAM authentication');
    }
    const region = process.env.SQL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
    const clientConfig = { region };
    if (process.env.SQL_AWS_PROFILE) {
        process.env.AWS_PROFILE = process.env.SQL_AWS_PROFILE;
    }
    const client = new RedshiftClient(clientConfig);
    try {
        const response = await client.send(new GetClusterCredentialsCommand({
            ClusterIdentifier: clusterId,
            DbUser: dbUser,
            DbName: database,
            DurationSeconds: 900, // 15 minutes (minimum)
            AutoCreate: false,
        }));
        if (!response.DbUser || !response.DbPassword) {
            throw new Error('IAM authentication did not return credentials');
        }
        // Cache credentials (expire 1 minute early to be safe)
        iamCredentialsCache = {
            user: response.DbUser,
            password: response.DbPassword,
            expiry: Date.now() + (14 * 60 * 1000), // 14 minutes
        };
        return { user: response.DbUser, password: response.DbPassword };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to get IAM credentials: ${message}`);
    }
}
/**
 * Build SSL configuration based on mode
 */
function buildSSLConfig() {
    const sslMode = process.env.SQL_SSL_MODE || 'require';
    if (sslMode === 'disable') {
        return false;
    }
    const sslConfig = {};
    switch (sslMode) {
        case 'require':
            sslConfig.rejectUnauthorized = false;
            break;
        case 'verify-ca':
        case 'verify-full':
            sslConfig.rejectUnauthorized = true;
            if (process.env.SQL_SSL_CA) {
                const fs = require('fs');
                sslConfig.ca = fs.readFileSync(process.env.SQL_SSL_CA);
            }
            break;
        default:
            sslConfig.rejectUnauthorized = false;
    }
    // Client certificate authentication (mutual TLS)
    if (process.env.SQL_SSL_CERT && process.env.SQL_SSL_KEY) {
        const fs = require('fs');
        sslConfig.cert = fs.readFileSync(process.env.SQL_SSL_CERT);
        sslConfig.key = fs.readFileSync(process.env.SQL_SSL_KEY);
    }
    return sslConfig;
}
/**
 * Get connection configuration from environment variables
 *
 * Authentication Methods (SQL_AUTH_METHOD):
 * - 'direct'          : Use SQL_USER and SQL_PASSWORD directly (default)
 * - 'iam'             : Use AWS IAM to get temporary Redshift credentials
 * - 'secrets_manager' : Fetch credentials from AWS Secrets Manager
 *
 * SSL Configuration Options (SQL_SSL_MODE):
 * - 'disable'     : No SSL (plain connection)
 * - 'require'     : SSL required, skip certificate verification (default, good for VPC endpoints)
 * - 'verify-ca'   : SSL required, verify server certificate against CA
 * - 'verify-full' : SSL required, verify certificate and hostname
 *
 * Additional SSL Options:
 * - SQL_SSL_CA      : Path to CA certificate file (for verify-ca/verify-full)
 * - SQL_SSL_CERT    : Path to client certificate file (for mutual TLS)
 * - SQL_SSL_KEY     : Path to client private key file (for mutual TLS)
 *
 * IAM Authentication Options:
 * - SQL_CLUSTER_ID  : Redshift cluster identifier (required for IAM)
 * - SQL_AWS_REGION  : AWS region (defaults to AWS_REGION or us-east-1)
 * - SQL_AWS_PROFILE : AWS profile name (optional)
 *
 * Secrets Manager Options:
 * - SQL_SECRET_ID   : Secret name or ARN (required for secrets_manager)
 * - SQL_AWS_REGION  : AWS region (defaults to AWS_REGION or us-east-1)
 * - SQL_AWS_PROFILE : AWS profile name (optional)
 *
 * SSH Tunnel Support:
 * - If using an SSH tunnel, set SQL_HOST to 'localhost' or '127.0.0.1'
 *   and SQL_PORT to your local tunnel port, then set SQL_SSL_MODE='disable'
 */
async function getConnectionConfig() {
    const authMethod = (process.env.SQL_AUTH_METHOD || 'direct').toLowerCase();
    let host = process.env.SQL_HOST;
    let port = parseInt(process.env.SQL_PORT || '5439', 10);
    let database = process.env.SQL_DATABASE;
    let user = process.env.SQL_USER;
    let password = process.env.SQL_PASSWORD;
    // Get credentials based on auth method
    switch (authMethod) {
        case 'secrets_manager': {
            const secretCreds = await getSecretsManagerCredentials();
            // Secret can override connection details
            host = secretCreds.host || host;
            port = secretCreds.port || port;
            database = secretCreds.database || database;
            user = secretCreds.user;
            password = secretCreds.password;
            break;
        }
        case 'iam': {
            const iamCreds = await getIAMCredentials();
            user = iamCreds.user;
            password = iamCreds.password;
            break;
        }
        case 'direct':
        default:
            // Use environment variables directly
            break;
    }
    // Validate required fields
    if (!host) {
        throw new Error('Missing SQL_HOST. Set it directly or include in Secrets Manager secret.');
    }
    if (!database) {
        throw new Error('Missing SQL_DATABASE. Set it directly or include in Secrets Manager secret.');
    }
    if (!user || !password) {
        throw new Error(`Missing credentials. For auth method '${authMethod}', ensure required variables are set.`);
    }
    return {
        host,
        port,
        database,
        user,
        password,
        ssl: buildSSLConfig(),
    };
}
/**
 * Initialize database connection
 */
async function ensureConnection() {
    if (client) {
        // For IAM auth, check if credentials might have expired
        const authMethod = (process.env.SQL_AUTH_METHOD || 'direct').toLowerCase();
        if (authMethod === 'iam' && iamCredentialsCache && Date.now() >= iamCredentialsCache.expiry) {
            // Credentials expired, need to reconnect
            if (client)
                client.release();
            if (pool)
                await pool.end();
            client = null;
            pool = null;
        }
        else {
            return client;
        }
    }
    const config = await getConnectionConfig();
    pool = new pg_1.Pool(config);
    client = await pool.connect();
    // Test connection
    await client.query('SELECT 1');
    return client;
}
/**
 * Execute a SQL query with validation
 */
async function executeQuery(sql, params) {
    const conn = await ensureConnection();
    const startTime = Date.now();
    const result = await conn.query(sql, params);
    const executionTime = Date.now() - startTime;
    // Sanitize column names and row data
    const columns = (0, sanitizer_js_1.sanitizeColumns)(result.fields.map(f => f.name));
    const rawRows = result.rows.map(row => Object.values(row));
    // Apply row limit for safety
    const limitedRows = rawRows.slice(0, schemas_js_1.LIMITS.MAX_ROWS);
    const rows = (0, sanitizer_js_1.sanitizeRows)(limitedRows);
    const queryResult = {
        columns,
        rows,
        rowCount: result.rowCount || 0,
        executionTime,
    };
    // Validate output schema
    const validated = schemas_js_1.QueryResultSchema.parse(queryResult);
    return validated;
}
/**
 * Format query results as a readable table with sanitization
 */
function formatResults(result) {
    if (result.rows.length === 0) {
        return (0, sanitizer_js_1.sanitizeResponseText)(`Query executed successfully. ${result.rowCount} rows affected. (${result.executionTime}ms)`);
    }
    // Calculate column widths
    const widths = result.columns.map((col, i) => {
        const maxDataWidth = Math.max(...result.rows.map(row => String(row[i] ?? 'NULL').length));
        return Math.max(col.length, maxDataWidth, 4);
    });
    // Build header
    const header = result.columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');
    // Build rows (limit to 100 for readability)
    const displayRows = result.rows.slice(0, 100);
    const rowStrings = displayRows.map(row => row.map((val, i) => String(val ?? 'NULL').padEnd(widths[i])).join(' | '));
    let output = `${header}\n${separator}\n${rowStrings.join('\n')}`;
    if (result.rows.length > 100) {
        output += `\n... (${result.rows.length - 100} more rows)`;
    }
    output += `\n\n${result.rowCount} rows returned. (${result.executionTime}ms)`;
    // Sanitize and truncate final output
    const sanitized = (0, sanitizer_js_1.sanitizeResponseText)(output);
    return (0, sanitizer_js_1.truncateString)(sanitized, schemas_js_1.LIMITS.MAX_RESPONSE_LENGTH);
}
// Define available tools
const tools = [
    {
        name: 'run_query',
        description: 'Execute a SQL query on the connected database. Returns results as a formatted table. TIP: If you\'re unfamiliar with the schema, use list_presets and get_schema_context first to learn about tables, columns, and required filters.',
        inputSchema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'The SQL query to execute',
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'list_schemas',
        description: 'List all schemas in the database (excluding system schemas)',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_tables',
        description: 'List all tables in a schema',
        inputSchema: {
            type: 'object',
            properties: {
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
        },
    },
    {
        name: 'describe_table',
        description: 'Get column information for a table',
        inputSchema: {
            type: 'object',
            properties: {
                table: {
                    type: 'string',
                    description: 'Table name (can include schema prefix like schema.table)',
                },
            },
            required: ['table'],
        },
    },
    {
        name: 'get_sample_data',
        description: 'Get sample rows from a table',
        inputSchema: {
            type: 'object',
            properties: {
                table: {
                    type: 'string',
                    description: 'Table name (can include schema prefix)',
                },
                limit: {
                    type: 'number',
                    description: 'Number of rows to return (default: 5)',
                    default: 5,
                },
            },
            required: ['table'],
        },
    },
    {
        name: 'connection_status',
        description: 'Check the current database connection status',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'get_schema_context',
        description: 'IMPORTANT: Load schema knowledge, query patterns, and best practices for this database. Call this FIRST before writing queries to learn about table structures, required filters, and common patterns. Use list_presets to see available contexts.',
        inputSchema: {
            type: 'object',
            properties: {
                preset: {
                    type: 'string',
                    description: 'Schema preset name (use list_presets to see available options)',
                },
            },
            required: ['preset'],
        },
    },
    {
        name: 'list_presets',
        description: 'List all available schema context presets. RECOMMENDED: Call this first when working with an unfamiliar database to discover available documentation and best practices.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];
// Create MCP server
const server = new index_js_1.Server({
    name: 'sql-client-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Handle list tools request
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools };
});
// Handle tool calls
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'run_query': {
                // Validate input
                const validated = schemas_js_1.RunQueryInputSchema.parse(args);
                const result = await executeQuery(validated.sql);
                return {
                    content: [{ type: 'text', text: formatResults(result) }],
                };
            }
            case 'list_schemas': {
                const result = await executeQuery(`
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_internal')
          ORDER BY schema_name
        `);
                return {
                    content: [{ type: 'text', text: formatResults(result) }],
                };
            }
            case 'list_tables': {
                // Validate input
                const validated = schemas_js_1.ListTablesInputSchema.parse(args);
                const result = await executeQuery(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = $1
          ORDER BY table_name
        `, [validated.schema]);
                return {
                    content: [{ type: 'text', text: formatResults(result) }],
                };
            }
            case 'describe_table': {
                // Validate input
                const validated = schemas_js_1.DescribeTableInputSchema.parse(args);
                const parts = validated.table.split('.');
                const schema = parts.length > 1 ? parts[0] : 'public';
                const tableName = parts.length > 1 ? parts[1] : parts[0];
                const result = await executeQuery(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [schema, tableName]);
                return {
                    content: [{ type: 'text', text: formatResults(result) }],
                };
            }
            case 'get_sample_data': {
                // Validate input with semantic checks
                const validated = schemas_js_1.GetSampleDataInputSchema.parse(args);
                // Additional semantic validation: limit must be reasonable
                if (validated.limit <= 0) {
                    throw new Error('Limit must be a positive number');
                }
                const result = await executeQuery(`SELECT * FROM ${validated.table} LIMIT ${validated.limit}`);
                return {
                    content: [{ type: 'text', text: formatResults(result) }],
                };
            }
            case 'connection_status': {
                try {
                    const conn = await ensureConnection();
                    const result = await conn.query(`
            SELECT 
              current_database() as database,
              current_user as user,
              inet_server_addr() as host
          `);
                    const row = result.rows[0];
                    const statusText = (0, sanitizer_js_1.sanitizeResponseText)(`✅ Connected\nDatabase: ${row.database}\nUser: ${row.user}\nHost: ${row.host || process.env.SQL_HOST}`);
                    return {
                        content: [{
                                type: 'text',
                                text: statusText,
                            }],
                    };
                }
                catch (error) {
                    const errorText = (0, sanitizer_js_1.sanitizeResponseText)(`❌ Not connected: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return {
                        content: [{
                                type: 'text',
                                text: errorText,
                            }],
                    };
                }
            }
            case 'get_schema_context': {
                // Validate input
                const validated = schemas_js_1.GetSchemaContextInputSchema.parse(args);
                const preset = await (0, index_js_2.getPresetAsync)(validated.preset);
                if (!preset) {
                    const available = await (0, index_js_2.listPresetsAsync)();
                    const availableText = available.length > 0
                        ? `Available presets: ${available.join(', ')}`
                        : 'No presets available. Set SQL_CONTEXT_DIR, SQL_CONTEXT_S3, or SQL_CONTEXT_URL environment variable to load context files.';
                    return {
                        content: [{
                                type: 'text',
                                text: (0, sanitizer_js_1.sanitizeResponseText)(`Unknown preset: ${validated.preset}\n\n${availableText}`),
                            }],
                        isError: true,
                    };
                }
                // Sanitize and truncate preset content
                const responseText = (0, sanitizer_js_1.truncateString)((0, sanitizer_js_1.sanitizeResponseText)(`# ${preset.name}\n\n${preset.description}\n\n${preset.context}`), schemas_js_1.LIMITS.MAX_RESPONSE_LENGTH);
                return {
                    content: [{
                            type: 'text',
                            text: responseText,
                        }],
                };
            }
            case 'list_presets': {
                const presets = await (0, index_js_2.listPresetsAsync)();
                if (presets.length === 0) {
                    return {
                        content: [{
                                type: 'text',
                                text: (0, sanitizer_js_1.sanitizeResponseText)(`# No Schema Presets Available\n\nTo add custom presets, set environment variables:\n- \`SQL_CONTEXT_DIR\`: Local directory containing .md or .json files\n- \`SQL_CONTEXT_S3\`: S3 URI (s3://bucket/prefix/) containing context files\n- \`SQL_CONTEXT_URL\`: HTTP/HTTPS URL to a single context file\n- \`SQL_CONTEXT_FILE\`: Path to a single local context file\n\nExample .md file:\n\`\`\`markdown\n# My Schema Context\n\n## Tables\n- my_table: Description here\n\n## Query Patterns\n...\n\`\`\``),
                            }],
                    };
                }
                const presetDetails = await Promise.all(presets.map(async (name) => {
                    const preset = await (0, index_js_2.getPresetAsync)(name);
                    return `- **${(0, sanitizer_js_1.sanitizeString)(name)}**: ${(0, sanitizer_js_1.sanitizeString)(preset?.description || 'No description')}`;
                }));
                return {
                    content: [{
                            type: 'text',
                            text: (0, sanitizer_js_1.sanitizeResponseText)(`# Available Schema Presets\n\n${presetDetails.join('\n')}\n\nUse \`get_schema_context\` with a preset name to load the context.`),
                        }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        // Handle Zod validation errors specially
        if (error instanceof zod_1.ZodError) {
            const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
            return {
                content: [{ type: 'text', text: (0, sanitizer_js_1.sanitizeResponseText)(`Validation Error: ${issues}`) }],
                isError: true,
            };
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            content: [{ type: 'text', text: (0, sanitizer_js_1.sanitizeResponseText)(`Error: ${message}`) }],
            isError: true,
        };
    }
});
// Cleanup on exit
process.on('SIGINT', async () => {
    if (client) {
        client.release();
    }
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
// Start server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('SQL MCP with Context Presets running on stdio');
}
main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
// Note: Server name in registry should be "SQL MCP with Context Presets"
