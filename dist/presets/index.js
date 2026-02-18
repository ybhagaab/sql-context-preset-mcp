"use strict";
/**
 * Schema Context Presets
 *
 * Loads custom user-provided context files for schema knowledge.
 *
 * Custom contexts can be loaded via:
 * - SQL_CONTEXT_DIR env var: Directory containing .md or .json files
 * - SQL_CONTEXT_FILE env var: Single context file path
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
exports.listPresets = listPresets;
exports.getPreset = getPreset;
exports.reloadCustomPresets = reloadCustomPresets;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Cache for custom presets
let customPresetsCache = null;
/**
 * Load custom presets from environment-specified locations
 */
function loadCustomPresets() {
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
        }
        catch (error) {
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
function loadPresetFromFile(filePath) {
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
        }
        else if (ext === '.md') {
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
/**
 * Reload custom presets (useful if files changed)
 */
function reloadCustomPresets() {
    customPresetsCache = null;
}
