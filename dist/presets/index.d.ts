/**
 * Schema Context Presets
 *
 * Loads custom user-provided context files for schema knowledge.
 *
 * Custom contexts can be loaded via:
 * - SQL_CONTEXT_DIR env var: Directory containing .md or .json files
 * - SQL_CONTEXT_FILE env var: Single context file path
 */
export interface SchemaPreset {
    name: string;
    description: string;
    context: string;
    tables: Array<{
        name: string;
        description: string;
        key_columns: string[];
    }>;
}
export declare function listPresets(): string[];
export declare function getPreset(name: string): SchemaPreset | undefined;
/**
 * Reload custom presets (useful if files changed)
 */
export declare function reloadCustomPresets(): void;
