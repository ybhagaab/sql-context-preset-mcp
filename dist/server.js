/**
 * PostgreSQL/Redshift MCP Server
 *
 * Provides tools for executing SQL queries on PostgreSQL/Redshift databases.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { getPackageVersion } from './utils.js';
// Connection pool (lazy initialized)
let pool = null;
let client = null;
/**
 * Get connection configuration from environment variables
 */
function getConnectionConfig() {
    const host = process.env.SQL_HOST;
    const port = parseInt(process.env.SQL_PORT || '5439', 10);
    const database = process.env.SQL_DATABASE;
    const user = process.env.SQL_USER;
    const password = process.env.SQL_PASSWORD;
    const sslMode = process.env.SQL_SSL_MODE || 'require';
    if (!host || !database || !user || !password) {
        throw new Error('Missing required environment variables. Please set: SQL_HOST, SQL_DATABASE, SQL_USER, SQL_PASSWORD');
    }
    // Build SSL configuration based on mode
    let ssl = false;
    if (sslMode !== 'disable') {
        const sslConfig = {};
        switch (sslMode) {
            case 'require':
                sslConfig.rejectUnauthorized = false;
                break;
            case 'verify-ca':
                sslConfig.rejectUnauthorized = true;
                if (process.env.SQL_SSL_CA) {
                    sslConfig.ca = fs.readFileSync(process.env.SQL_SSL_CA);
                }
                break;
            case 'verify-full':
                sslConfig.rejectUnauthorized = true;
                if (process.env.SQL_SSL_CA) {
                    sslConfig.ca = fs.readFileSync(process.env.SQL_SSL_CA);
                }
                break;
            default:
                sslConfig.rejectUnauthorized = false;
        }
        if (process.env.SQL_SSL_CERT && process.env.SQL_SSL_KEY) {
            sslConfig.cert = fs.readFileSync(process.env.SQL_SSL_CERT);
            sslConfig.key = fs.readFileSync(process.env.SQL_SSL_KEY);
        }
        ssl = sslConfig;
    }
    return { host, port, database, user, password, ssl };
}
async function ensureConnection() {
    if (client)
        return client;
    const config = getConnectionConfig();
    pool = new Pool(config);
    client = await pool.connect();
    await client.query('SELECT 1');
    return client;
}
async function executeQuery(sql, params) {
    const conn = await ensureConnection();
    const startTime = Date.now();
    const result = await conn.query(sql, params);
    const executionTime = Date.now() - startTime;
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => Object.values(row));
    return { columns, rows, rowCount: result.rowCount || 0, executionTime };
}
function formatResults(result) {
    if (result.rows.length === 0) {
        return `Query executed successfully. ${result.rowCount} rows affected. (${result.executionTime}ms)`;
    }
    const widths = result.columns.map((col, i) => {
        const maxDataWidth = Math.max(...result.rows.map((row) => String(row[i] ?? 'NULL').length));
        return Math.max(col.length, maxDataWidth, 4);
    });
    const header = result.columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
    const displayRows = result.rows.slice(0, 100);
    const rowStrings = displayRows.map((row) => row.map((val, i) => String(val ?? 'NULL').padEnd(widths[i])).join(' | '));
    let output = `${header}\n${separator}\n${rowStrings.join('\n')}`;
    if (result.rows.length > 100) {
        output += `\n... (${result.rows.length - 100} more rows)`;
    }
    output += `\n\n${result.rowCount} rows returned. (${result.executionTime}ms)`;
    return output;
}
let customPresetsCache = null;
function loadCustomPresets() {
    if (customPresetsCache !== null)
        return customPresetsCache;
    customPresetsCache = {};
    const contextDir = process.env.SQL_CONTEXT_DIR;
    if (contextDir && fs.existsSync(contextDir)) {
        try {
            const files = fs.readdirSync(contextDir);
            for (const file of files) {
                if (file.endsWith('.md') || file.endsWith('.json')) {
                    const filePath = path.join(contextDir, file);
                    const preset = loadPresetFromFile(filePath);
                    if (preset) {
                        const name = path.basename(file, path.extname(file)).toLowerCase();
                        customPresetsCache[name] = preset;
                    }
                }
            }
        }
        catch (error) {
            console.error(`Error loading context directory: ${error}`);
        }
    }
    const contextFile = process.env.SQL_CONTEXT_FILE;
    if (contextFile && fs.existsSync(contextFile)) {
        const preset = loadPresetFromFile(contextFile);
        if (preset) {
            const name = path.basename(contextFile, path.extname(contextFile)).toLowerCase();
            customPresetsCache[name] = preset;
        }
    }
    return customPresetsCache;
}
function loadPresetFromFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const ext = path.extname(filePath).toLowerCase();
        const name = path.basename(filePath, ext);
        if (ext === '.json') {
            const data = JSON.parse(content);
            return {
                name: data.name || name,
                description: data.description || `Custom context from ${name}`,
                context: data.context || '',
            };
        }
        else if (ext === '.md') {
            const lines = content.split('\n');
            let description = `Custom context from ${name}`;
            if (lines[0]?.startsWith('# ')) {
                description = lines[0].substring(2).trim();
            }
            return { name, description, context: content };
        }
    }
    catch (error) {
        console.error(`Error loading preset from ${filePath}: ${error}`);
    }
    return null;
}
function listPresets() {
    return Object.keys(loadCustomPresets());
}
function getPreset(name) {
    return loadCustomPresets()[name.toLowerCase()];
}
// Create MCP server
export const server = new McpServer({
    name: 'postgresql-mcp',
    version: getPackageVersion(),
}, {
    capabilities: { tools: {} },
    instructions: 'PostgreSQL/Redshift database query tool. Use list_presets and get_schema_context first to learn about the database schema before running queries.',
});
// Register tools using Zod schemas
server.tool('run_query', "Execute a SQL query on the connected database. Returns results as a formatted table. TIP: If you're unfamiliar with the schema, use list_presets and get_schema_context first to learn about tables, columns, and required filters.", { sql: z.string().describe('The SQL query to execute') }, async ({ sql }) => {
    const result = await executeQuery(sql);
    return { content: [{ type: 'text', text: formatResults(result) }] };
});
server.tool('list_schemas', 'List all schemas in the database (excluding system schemas)', {}, async () => {
    const result = await executeQuery(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_internal')
      ORDER BY schema_name
    `);
    return { content: [{ type: 'text', text: formatResults(result) }] };
});
server.tool('list_tables', 'List all tables in a schema', { schema: z.string().default('public').describe('Schema name (default: public)') }, async ({ schema = 'public' }) => {
    const result = await executeQuery(`
      SELECT table_name, table_type FROM information_schema.tables
      WHERE table_schema = $1 ORDER BY table_name
    `, [schema]);
    return { content: [{ type: 'text', text: formatResults(result) }] };
});
server.tool('describe_table', 'Get column information for a table', { table: z.string().describe('Table name (can include schema prefix like schema.table)') }, async ({ table }) => {
    const parts = table.split('.');
    const schema = parts.length > 1 ? parts[0] : 'public';
    const tableName = parts.length > 1 ? parts[1] : parts[0];
    const result = await executeQuery(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, tableName]);
    return { content: [{ type: 'text', text: formatResults(result) }] };
});
server.tool('get_sample_data', 'Get sample rows from a table', {
    table: z.string().describe('Table name (can include schema prefix)'),
    limit: z.number().default(5).describe('Number of rows to return (default: 5)'),
}, async ({ table, limit = 5 }) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(table)) {
        throw new Error('Invalid table name format');
    }
    const result = await executeQuery(`SELECT * FROM ${table} LIMIT ${limit}`);
    return { content: [{ type: 'text', text: formatResults(result) }] };
});
server.tool('connection_status', 'Check the current database connection status', {}, async () => {
    try {
        const conn = await ensureConnection();
        const result = await conn.query(`
        SELECT current_database() as database, current_user as user, inet_server_addr() as host
      `);
        const row = result.rows[0];
        return {
            content: [
                {
                    type: 'text',
                    text: `Connected\nDatabase: ${row.database}\nUser: ${row.user}\nHost: ${row.host || process.env.SQL_HOST}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Not connected: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
            ],
        };
    }
});
server.tool('get_schema_context', 'IMPORTANT: Load schema knowledge, query patterns, and best practices for this database. Call this FIRST before writing queries to learn about table structures, required filters, and common patterns. Use list_presets to see available contexts.', { preset: z.string().describe('Schema preset name (use list_presets to see available options)') }, async ({ preset: presetName }) => {
    const preset = getPreset(presetName);
    if (!preset) {
        const available = listPresets();
        const availableText = available.length > 0
            ? `Available presets: ${available.join(', ')}`
            : 'No presets available. Set SQL_CONTEXT_DIR or SQL_CONTEXT_FILE environment variable.';
        return { content: [{ type: 'text', text: `Unknown preset: ${presetName}\n\n${availableText}` }], isError: true };
    }
    return { content: [{ type: 'text', text: `# ${preset.name}\n\n${preset.description}\n\n${preset.context}` }] };
});
server.tool('list_presets', 'List all available schema context presets. RECOMMENDED: Call this first when working with an unfamiliar database to discover available documentation and best practices.', {}, async () => {
    const presets = listPresets();
    if (presets.length === 0) {
        return {
            content: [
                {
                    type: 'text',
                    text: `# No Schema Presets Available\n\nTo add custom presets, set environment variables:\n- SQL_CONTEXT_DIR: Directory containing .md or .json files\n- SQL_CONTEXT_FILE: Path to a single context file`,
                },
            ],
        };
    }
    const presetList = presets
        .map((name) => {
        const p = getPreset(name);
        return `- **${name}**: ${p.description}`;
    })
        .join('\n');
    return {
        content: [
            {
                type: 'text',
                text: `# Available Schema Presets\n\n${presetList}\n\nUse get_schema_context with a preset name to load the context.`,
            },
        ],
    };
});
// Cleanup on exit
process.on('SIGINT', async () => {
    if (client)
        client.release();
    if (pool)
        await pool.end();
    process.exit(0);
});
