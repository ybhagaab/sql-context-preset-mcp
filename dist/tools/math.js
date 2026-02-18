import { z } from 'zod';
export function divide(dividend, divisor) {
    if (divisor === 0) {
        throw new Error('Cannot divide by zero');
    }
    return dividend / divisor;
}
// MCP tool
export const divideTool = {
    name: 'divide',
    description: 'A tool to divide two numbers. Returns the result of dividend ÷ divisor. Will throw an error if divisor is 0.',
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
        }
        catch (error) {
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
