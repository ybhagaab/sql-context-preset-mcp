import { z } from 'zod';
import type { Tool } from '../types';

export function divide(dividend: number, divisor: number) {
  if (divisor === 0) {
    throw new Error('Cannot divide by zero');
  }
  return dividend / divisor;
}

// MCP tool
export const divideTool: Tool<{ dividend: z.ZodNumber; divisor: z.ZodNumber }> = {
  name: 'divide',
  description:
    'A tool to divide two numbers. Returns the result of dividend ÷ divisor. Will throw an error if divisor is 0.',
  paramSchema: {
    dividend: z.number(),
    divisor: z.number(),
  },
  cb: async ({ dividend, divisor }) => {
    try {
      const result = divide(dividend, divisor);
      return {
        content: [
          {
            type: 'text',
            text: result.toString(),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message ?? 'Unknown error occurred'}`,
          },
        ],
        isError: true,
      };
    }
  },
};
