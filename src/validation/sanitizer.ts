/**
 * Response Content Sanitizer
 * 
 * Strips undesirable characters from response content to mitigate:
 * - Hidden character smuggling
 * - Injection attempts
 * - Control character attacks
 */

// =============================================================================
// Character Patterns to Strip
// =============================================================================

/**
 * Control characters (except common whitespace)
 * - U+0000-U+0008: Null and control chars
 * - U+000B: Vertical tab
 * - U+000C: Form feed
 * - U+000E-U+001F: Control chars
 * - U+007F: Delete
 */
// eslint-disable-next-line no-control-regex -- Intentionally matching control characters for sanitization
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Unicode control characters and special formatting
 * - U+200B: Zero-width space
 * - U+200C: Zero-width non-joiner
 * - U+200D: Zero-width joiner
 * - U+200E-U+200F: LTR/RTL marks
 * - U+202A-U+202E: Bidirectional text controls
 * - U+2060: Word joiner
 * - U+2061-U+2064: Invisible operators
 * - U+FEFF: Byte order mark (when not at start)
 */
const UNICODE_CONTROL = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Private use area characters (potential for smuggling)
 * - U+E000-U+F8FF: Private Use Area
 */
const PRIVATE_USE = /[\uE000-\uF8FF]/g;

/**
 * Tag characters (Unicode tags block)
 * - U+E0000-U+E007F: Tags
 */
const TAG_CHARS = /[\u{E0000}-\u{E007F}]/gu;

/**
 * Variation selectors (can be used to hide content)
 * - U+FE00-U+FE0F: Variation Selectors
 * - U+E0100-U+E01EF: Variation Selectors Supplement
 */
const VARIATION_SELECTORS = /[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}]/gu;

// =============================================================================
// Sanitization Functions
// =============================================================================

/**
 * Sanitize a string by removing potentially dangerous characters
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string with dangerous characters removed
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input
    .replace(CONTROL_CHARS, '')
    .replace(UNICODE_CONTROL, '')
    .replace(PRIVATE_USE, '')
    .replace(TAG_CHARS, '')
    .replace(VARIATION_SELECTORS, '');
}

/**
 * Sanitize a value recursively (handles objects and arrays)
 * 
 * @param value - The value to sanitize
 * @returns Sanitized value
 */
export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[sanitizeString(key)] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitize query result rows
 * 
 * @param rows - Array of row arrays
 * @returns Sanitized rows
 */
export function sanitizeRows(rows: unknown[][]): unknown[][] {
  return rows.map(row => row.map(cell => {
    if (typeof cell === 'string') {
      return sanitizeString(cell);
    }
    return cell;
  }));
}

/**
 * Sanitize column names
 * 
 * @param columns - Array of column names
 * @returns Sanitized column names
 */
export function sanitizeColumns(columns: string[]): string[] {
  return columns.map(sanitizeString);
}

/**
 * Sanitize MCP response text content
 * 
 * @param text - Response text to sanitize
 * @returns Sanitized text
 */
export function sanitizeResponseText(text: string): string {
  return sanitizeString(text);
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a string contains suspicious patterns
 * 
 * @param input - String to check
 * @returns Object with validation result and details
 */
export function detectSuspiciousPatterns(input: string): {
  isSuspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  // Check for null bytes
  if (input.includes('\x00')) {
    patterns.push('null_byte');
  }

  // Check for excessive control characters
  const controlCount = (input.match(CONTROL_CHARS) || []).length;
  if (controlCount > 10) {
    patterns.push('excessive_control_chars');
  }

  // Check for hidden Unicode
  const hiddenCount = (input.match(UNICODE_CONTROL) || []).length;
  if (hiddenCount > 5) {
    patterns.push('hidden_unicode');
  }

  // Check for private use characters
  if (PRIVATE_USE.test(input)) {
    patterns.push('private_use_chars');
  }

  return {
    isSuspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Truncate string to maximum length with indicator
 * 
 * @param input - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncateString(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength - 20) + '\n... [truncated]';
}
