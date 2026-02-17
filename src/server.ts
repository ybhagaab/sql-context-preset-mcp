import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { divideTool } from './tools/math.js';
import { amazonTenureTool } from './tools/tenure.js';
import { getPackageVersion } from './utils.js';
import { amazonEmployeeBadgeColorPrompt } from './prompts/badgeColor.js';

// Create an MCP server
export const server = new McpServer(
  {
    name: 'sql-context-presets',
    version: getPackageVersion(),
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
    instructions: 'An example MCP server',
  },
);

// Register tools
const tools = [divideTool, amazonTenureTool];

tools.map((tool) => {
  server.tool(tool.name, tool.description, tool.paramSchema, tool.cb);
});

// Register prompts
const prompts = [amazonEmployeeBadgeColorPrompt];
prompts.map((prompt) => {
  server.prompt(prompt.name, prompt.description, prompt.paramSchema, prompt.cb);
});
