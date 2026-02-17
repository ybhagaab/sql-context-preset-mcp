/**
 * Response Content Sanitizer
 *
 * Strips undesirable characters from response content to mitigate:
 * - Hidden character smuggling
 * - Injection attempts
 * - Control character attacks
 */
/**
 * Sanitize a string by removing potentially dangerous characters
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with dangerous characters removed
 */
export declare function sanitizeString(input: string): string;
/**
 * Sanitize a value recursively (handles objects and arrays)
 *
 * @param value - The value to sanitize
 * @returns Sanitized value
 */
export declare function sanitizeValue(value: unknown): unknown;
/**
 * Sanitize query result rows
 *
 * @param rows - Array of row arrays
 * @returns Sanitized rows
 */
export declare function sanitizeRows(rows: unknown[][]): unknown[][];
/**
 * Sanitize column names
 *
 * @param columns - Array of column names
 * @returns Sanitized column names
 */
export declare function sanitizeColumns(columns: string[]): string[];
/**
 * Sanitize MCP response text content
 *
 * @param text - Response text to sanitize
 * @returns Sanitized text
 */
export declare function sanitizeResponseText(text: string): string;
/**
 * Check if a string contains suspicious patterns
 *
 * @param input - String to check
 * @returns Object with validation result and details
 */
export declare function detectSuspiciousPatterns(input: string): {
    isSuspicious: boolean;
    patterns: string[];
};
/**
 * Truncate string to maximum length with indicator
 *
 * @param input - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export declare function truncateString(input: string, maxLength: number): string;
//# sourceMappingURL=sanitizer.d.ts.map