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
export declare const LIMITS: {
    /** Maximum rows returned from queries */
    readonly MAX_ROWS: 10000;
    /** Maximum characters in response text */
    readonly MAX_RESPONSE_LENGTH: 1000000;
    /** Maximum SQL query length */
    readonly MAX_SQL_LENGTH: 100000;
    /** Maximum table name length */
    readonly MAX_TABLE_NAME_LENGTH: 128;
    /** Maximum schema name length */
    readonly MAX_SCHEMA_NAME_LENGTH: 128;
    /** Maximum preset name length */
    readonly MAX_PRESET_NAME_LENGTH: 256;
    /** Maximum sample data limit */
    readonly MAX_SAMPLE_LIMIT: 1000;
    /** Minimum sample data limit */
    readonly MIN_SAMPLE_LIMIT: 1;
};
export declare const RunQueryInputSchema: z.ZodObject<{
    sql: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    sql: string;
}, {
    sql: string;
}>;
export declare const ListTablesInputSchema: z.ZodObject<{
    schema: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    schema: string;
}, {
    schema?: string | undefined;
}>;
export declare const DescribeTableInputSchema: z.ZodObject<{
    table: z.ZodString;
}, "strip", z.ZodTypeAny, {
    table: string;
}, {
    table: string;
}>;
export declare const GetSampleDataInputSchema: z.ZodObject<{
    table: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    table: string;
    limit: number;
}, {
    table: string;
    limit?: number | undefined;
}>;
export declare const GetSchemaContextInputSchema: z.ZodObject<{
    preset: z.ZodString;
}, "strip", z.ZodTypeAny, {
    preset: string;
}, {
    preset: string;
}>;
/** Schema for query execution results */
export declare const QueryResultSchema: z.ZodObject<{
    columns: z.ZodArray<z.ZodString, "many">;
    rows: z.ZodArray<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull, z.ZodDate]>, "many">, "many">;
    rowCount: z.ZodNumber;
    executionTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    columns: string[];
    rows: (string | number | boolean | Date | null)[][];
    rowCount: number;
    executionTime: number;
}, {
    columns: string[];
    rows: (string | number | boolean | Date | null)[][];
    rowCount: number;
    executionTime: number;
}>;
/** Schema for connection status response */
export declare const ConnectionStatusSchema: z.ZodObject<{
    database: z.ZodString;
    user: z.ZodString;
    host: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    database: string;
    user: string;
    host: string | null;
}, {
    database: string;
    user: string;
    host: string | null;
}>;
/** Schema for schema list response */
export declare const SchemaListSchema: z.ZodArray<z.ZodObject<{
    schema_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    schema_name: string;
}, {
    schema_name: string;
}>, "many">;
/** Schema for table list response */
export declare const TableListSchema: z.ZodArray<z.ZodObject<{
    table_name: z.ZodString;
    table_type: z.ZodString;
}, "strip", z.ZodTypeAny, {
    table_name: string;
    table_type: string;
}, {
    table_name: string;
    table_type: string;
}>, "many">;
/** Schema for column description response */
export declare const ColumnDescriptionSchema: z.ZodArray<z.ZodObject<{
    column_name: z.ZodString;
    data_type: z.ZodString;
    is_nullable: z.ZodString;
    column_default: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
}, {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
}>, "many">;
/** Schema for preset metadata */
export declare const PresetSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    context: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    context: string;
}, {
    name: string;
    description: string;
    context: string;
}>;
/** Schema for preset list */
export declare const PresetListSchema: z.ZodArray<z.ZodString, "many">;
/** Schema for MCP tool response content */
export declare const McpTextContentSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    text: string;
}, {
    type: "text";
    text: string;
}>;
export declare const McpResponseSchema: z.ZodObject<{
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        text: string;
    }, {
        type: "text";
        text: string;
    }>, "many">;
    isError: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: boolean | undefined;
}, {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: boolean | undefined;
}>;
export type RunQueryInput = z.infer<typeof RunQueryInputSchema>;
export type ListTablesInput = z.infer<typeof ListTablesInputSchema>;
export type DescribeTableInput = z.infer<typeof DescribeTableInputSchema>;
export type GetSampleDataInput = z.infer<typeof GetSampleDataInputSchema>;
export type GetSchemaContextInput = z.infer<typeof GetSchemaContextInputSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type McpResponse = z.infer<typeof McpResponseSchema>;
//# sourceMappingURL=schemas.d.ts.map