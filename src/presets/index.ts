/**
 * Schema Context Presets
 * 
 * Loads custom user-provided context files for schema knowledge.
 * 
 * Custom contexts can be loaded via:
 * - SQL_CONTEXT_DIR env var: Directory containing .md or .json files
 * - SQL_CONTEXT_FILE env var: Single context file path
 */

import * as fs from 'fs';
import * as path from 'path';

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

// Cache for custom presets
let customPresetsCache: Record<string, SchemaPreset> | null = null;

/**
 * Load custom presets from environment-specified locations
 */
function loadCustomPresets(): Record<string, SchemaPreset> {
  if (customPresetsCache !== null) {
    return customPresetsCache;
  }

  customPresetsCache = {};

  // Load from SQL_CONTEXT_DIR (directory of context files)
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
    } catch (error) {
      console.error(`Error loading context directory: ${error}`);
    }
  }

  // Load from SQL_CONTEXT_FILE (single file)
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

/**
 * Load a preset from a file (supports .md and .json)
 */
function loadPresetFromFile(filePath: string): SchemaPreset | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath, ext);

    if (ext === '.json') {
      // JSON format: { name, description, context, tables }
      const data = JSON.parse(content);
      return {
        name: data.name || name,
        description: data.description || `Custom context from ${name}`,
        context: data.context || '',
        tables: data.tables || [],
      };
    } else if (ext === '.md') {
      // Markdown format: entire file is the context
      // Extract description from first line if it starts with #
      const lines = content.split('\n');
      let description = `Custom context from ${name}`;
      
      if (lines[0]?.startsWith('# ')) {
        description = lines[0].substring(2).trim();
      }

      return {
        name: name,
        description,
        context: content,
        tables: [],
      };
    }
  } catch (error) {
    console.error(`Error loading preset from ${filePath}: ${error}`);
  }
  return null;
}

export function listPresets(): string[] {
  return Object.keys(loadCustomPresets());
}

export function getPreset(name: string): SchemaPreset | undefined {
  return loadCustomPresets()[name.toLowerCase()];
}

/**
 * Reload custom presets (useful if files changed)
 */
export function reloadCustomPresets(): void {
  customPresetsCache = null;
}
