"use strict";
/**
 * Zod Validation Schemas for MCP Tool Inputs and Outputs
 *
 * Implements AppSec requirement for response validation:
 * - MIME type validation (text content)
 * - Size/length limits
 * - Schema adherence
 * - Semantic relevance checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpResponseSchema = exports.McpTextContentSchema = exports.PresetListSchema = exports.PresetSchema = exports.ColumnDescriptionSchema = exports.TableListSchema = exports.SchemaListSchema = exports.ConnectionStatusSchema = exports.QueryResultSchema = exports.GetSchemaContextInputSchema = exports.GetSampleDataInputSchema = exports.DescribeTableInputSchema = exports.ListTablesInputSchema = exports.RunQueryInputSchema = exports.LIMITS = void 0;
const zod_1 = require("zod");
// =============================================================================
// Configuration Constants
// =============================================================================
exports.LIMITS = {
    /** Maximum rows returned from queries */
    MAX_ROWS: 10000,
    /** Maximum characters in response text */
    MAX_RESPONSE_LENGTH: 1000000, // 1MB
    /** Maximum SQL query length */
    MAX_SQL_LENGTH: 100000,
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
exports.RunQueryInputSchema = zod_1.z.object({
    sql: zod_1.z.string()
        .min(1, 'SQL query cannot be empty')
        .max(exports.LIMITS.MAX_SQL_LENGTH, `SQL query exceeds maximum length of ${exports.LIMITS.MAX_SQL_LENGTH}`)
        .refine((sql) => !sql.includes('\x00'), 'SQL query contains null bytes'),
});
exports.ListTablesInputSchema = zod_1.z.object({
    schema: zod_1.z.string()
        .max(exports.LIMITS.MAX_SCHEMA_NAME_LENGTH)
        .regex(schemaNamePattern, 'Invalid schema name format')
        .optional()
        .default('public'),
});
exports.DescribeTableInputSchema = zod_1.z.object({
    table: zod_1.z.string()
        .min(1, 'Table name cannot be empty')
        .max(exports.LIMITS.MAX_TABLE_NAME_LENGTH, `Table name exceeds maximum length of ${exports.LIMITS.MAX_TABLE_NAME_LENGTH}`)
        .regex(tableNamePattern, 'Invalid table name format. Use alphanumeric characters and underscores only.'),
});
exports.GetSampleDataInputSchema = zod_1.z.object({
    table: zod_1.z.string()
        .min(1, 'Table name cannot be empty')
        .max(exports.LIMITS.MAX_TABLE_NAME_LENGTH)
        .regex(tableNamePattern, 'Invalid table name format'),
    limit: zod_1.z.number()
        .int('Limit must be an integer')
        .min(exports.LIMITS.MIN_SAMPLE_LIMIT, `Limit must be at least ${exports.LIMITS.MIN_SAMPLE_LIMIT}`)
        .max(exports.LIMITS.MAX_SAMPLE_LIMIT, `Limit cannot exceed ${exports.LIMITS.MAX_SAMPLE_LIMIT}`)
        .optional()
        .default(5),
});
exports.GetSchemaContextInputSchema = zod_1.z.object({
    preset: zod_1.z.string()
        .min(1, 'Preset name cannot be empty')
        .max(exports.LIMITS.MAX_PRESET_NAME_LENGTH)
        .regex(presetNamePattern, 'Invalid preset name format'),
});
// =============================================================================
// Output Validation Schemas
// =============================================================================
/** Schema for query result columns */
const ColumnSchema = zod_1.z.string().max(256);
/** Schema for a single cell value */
const CellValueSchema = zod_1.z.union([
    zod_1.z.string(),
    zod_1.z.number(),
    zod_1.z.boolean(),
    zod_1.z.null(),
    zod_1.z.date(),
]);
/** Schema for query execution results */
exports.QueryResultSchema = zod_1.z.object({
    columns: zod_1.z.array(ColumnSchema).max(1000),
    rows: zod_1.z.array(zod_1.z.array(CellValueSchema)).max(exports.LIMITS.MAX_ROWS),
    rowCount: zod_1.z.number()
        .int()
        .min(0, 'Row count cannot be negative'),
    executionTime: zod_1.z.number()
        .min(0, 'Execution time cannot be negative'),
});
/** Schema for connection status response */
exports.ConnectionStatusSchema = zod_1.z.object({
    database: zod_1.z.string().max(256),
    user: zod_1.z.string().max(256),
    host: zod_1.z.string().max(256).nullable(),
});
/** Schema for schema list response */
exports.SchemaListSchema = zod_1.z.array(zod_1.z.object({
    schema_name: zod_1.z.string().max(exports.LIMITS.MAX_SCHEMA_NAME_LENGTH),
})).max(1000);
/** Schema for table list response */
exports.TableListSchema = zod_1.z.array(zod_1.z.object({
    table_name: zod_1.z.string().max(exports.LIMITS.MAX_TABLE_NAME_LENGTH),
    table_type: zod_1.z.string().max(64),
})).max(10000);
/** Schema for column description response */
exports.ColumnDescriptionSchema = zod_1.z.array(zod_1.z.object({
    column_name: zod_1.z.string().max(256),
    data_type: zod_1.z.string().max(256),
    is_nullable: zod_1.z.string().max(10),
    column_default: zod_1.z.string().max(1000).nullable(),
})).max(2000);
/** Schema for preset metadata */
exports.PresetSchema = zod_1.z.object({
    name: zod_1.z.string().max(exports.LIMITS.MAX_PRESET_NAME_LENGTH),
    description: zod_1.z.string().max(10000),
    context: zod_1.z.string().max(exports.LIMITS.MAX_RESPONSE_LENGTH),
});
/** Schema for preset list */
exports.PresetListSchema = zod_1.z.array(zod_1.z.string().max(exports.LIMITS.MAX_PRESET_NAME_LENGTH)).max(100);
// =============================================================================
// MCP Response Schema
// =============================================================================
/** Schema for MCP tool response content */
exports.McpTextContentSchema = zod_1.z.object({
    type: zod_1.z.literal('text'),
    text: zod_1.z.string().max(exports.LIMITS.MAX_RESPONSE_LENGTH),
});
exports.McpResponseSchema = zod_1.z.object({
    content: zod_1.z.array(exports.McpTextContentSchema).min(1).max(10),
    isError: zod_1.z.boolean().optional(),
});
