import type { ZodOptional, ZodRawShape, ZodType, ZodTypeDef } from 'zod';
import type { PromptCallback, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface Tool<Args extends ZodRawShape> {
  name: string;
  description: string;
  paramSchema: Args;
  cb: ToolCallback<Args>;
}

export interface Prompt<
  Args extends {
    // PromptArgsRawShape type isn't exported
    [k: string]: ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>;
  },
> {
  name: string;
  description: string;
  paramSchema: Args;
  cb: PromptCallback<Args>;
}
