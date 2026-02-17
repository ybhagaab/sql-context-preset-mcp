/**
 * Zod Validation Schemas for MCP Tool Inputs and Outputs
 *
 * Implements AppSec requirement for response validation:
 * - MIME type validation (text content)
 * - Size/length limits
 * - Schema adherence
 * - Semantic relevance checks
 */
import { z } from 'zod';
// =============================================================================
// Configuration Constants
// =============================================================================
export const LIMITS = {
    /** Maximum rows returned from queries */
    MAX_ROWS: 10000,
    /** Maximum characters in response text */
    MAX_RESPONSE_LENGTH: 1_000_000, // 1MB
    /** Maximum SQL query length */
    MAX_SQL_LENGTH: 100_000,
    /** Maximum table name length */
    MAX_TABLE_NAME_LENGTH: 128,
    /** Maximum schema name length */
    MAX_SCHEMA_NAME_LENGTH: 128,
    /** Maximum preset name length */
    MAX_PRESET_NAME_LENGTH: 256,
    /** Maximum sample data limit */
    MAX_SAMPLE_LIMIT: 1000,
    /** Minimum sample data limit */
    MIN_SAMPLE_LIMIT: 1,
};
// =============================================================================
// Input Validation Schemas
// =============================================================================
/** Valid table name pattern: alphanumeric with underscores, optional schema prefix */
const tableNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
/** Valid schema name pattern */
const schemaNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Valid preset name pattern */
const presetNamePattern = /^[a-zA-Z0-9_\-\.]+$/;
export const RunQueryInputSchema = z.object({
    sql: z.string()
        .min(1, 'SQL query cannot be empty')
        .max(LIMITS.MAX_SQL_LENGTH, `SQL query exceeds maximum length of ${LIMITS.MAX_SQL_LENGTH}`)
        .refine((sql) => !sql.includes('\x00'), 'SQL query contains null bytes'),
});
export const ListTablesInputSchema = z.object({
    schema: z.string()
        .max(LIMITS.MAX_SCHEMA_NAME_LENGTH)
        .regex(schemaNamePattern, 'Invalid schema name format')
        .optional()
        .default('public'),
});
export const DescribeTableInputSchema = z.object({
    table: z.string()
        .min(1, 'Table name cannot be empty')
        .max(LIMITS.MAX_TABLE_NAME_LENGTH, `Table name exceeds maximum length of ${LIMITS.MAX_TABLE_NAME_LENGTH}`)
        .regex(tableNamePattern, 'Invalid table name format. Use alphanumeric characters and underscores only.'),
});
export const GetSampleDataInputSchema = z.object({
    table: z.string()
        .min(1, 'Table name cannot be empty')
        .max(LIMITS.MAX_TABLE_NAME_LENGTH)
        .regex(tableNamePattern, 'Invalid table name format'),
    limit: z.number()
        .int('Limit must be an integer')
        .min(LIMITS.MIN_SAMPLE_LIMIT, `Limit must be at least ${LIMITS.MIN_SAMPLE_LIMIT}`)
        .max(LIMITS.MAX_SAMPLE_LIMIT, `Limit cannot exceed ${LIMITS.MAX_SAMPLE_LIMIT}`)
        .optional()
        .default(5),
});
export const GetSchemaContextInputSchema = z.object({
    preset: z.string()
        .min(1, 'Preset name cannot be empty')
        .max(LIMITS.MAX_PRESET_NAME_LENGTH)
        .regex(presetNamePattern, 'Invalid preset name format'),
});
// =============================================================================
// Output Validation Schemas
// =============================================================================
/** Schema for query result columns */
const ColumnSchema = z.string().max(256);
/** Schema for a single cell value */
const CellValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.date(),
]);
/** Schema for query execution results */
export const QueryResultSchema = z.object({
    columns: z.array(ColumnSchema).max(1000),
    rows: z.array(z.array(CellValueSchema)).max(LIMITS.MAX_ROWS),
    rowCount: z.number()
        .int()
        .min(0, 'Row count cannot be negative'),
    executionTime: z.number()
        .min(0, 'Execution time cannot be negative'),
});
/** Schema for connection status response */
export const ConnectionStatusSchema = z.object({
    database: z.string().max(256),
    user: z.string().max(256),
    host: z.string().max(256).nullable(),
});
/** Schema for schema list response */
export const SchemaListSchema = z.array(z.object({
    schema_name: z.string().max(LIMITS.MAX_SCHEMA_NAME_LENGTH),
})).max(1000);
/** Schema for table list response */
export const TableListSchema = z.array(z.object({
    table_name: z.string().max(LIMITS.MAX_TABLE_NAME_LENGTH),
    table_type: z.string().max(64),
})).max(10000);
/** Schema for column description response */
export const ColumnDescriptionSchema = z.array(z.object({
    column_name: z.string().max(256),
    data_type: z.string().max(256),
    is_nullable: z.string().max(10),
    column_default: z.string().max(1000).nullable(),
})).max(2000);
/** Schema for preset metadata */
export const PresetSchema = z.object({
    name: z.string().max(LIMITS.MAX_PRESET_NAME_LENGTH),
    description: z.string().max(10000),
    context: z.string().max(LIMITS.MAX_RESPONSE_LENGTH),
});
/** Schema for preset list */
export const PresetListSchema = z.array(z.string().max(LIMITS.MAX_PRESET_NAME_LENGTH)).max(100);
// =============================================================================
// MCP Response Schema
// =============================================================================
/** Schema for MCP tool response content */
export const McpTextContentSchema = z.object({
    type: z.literal('text'),
    text: z.string().max(LIMITS.MAX_RESPONSE_LENGTH),
});
export const McpResponseSchema = z.object({
    content: z.array(McpTextContentSchema).min(1).max(10),
    isError: z.boolean().optional(),
});
