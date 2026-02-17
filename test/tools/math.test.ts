import { describe, it, expect } from 'vitest';

import { divideTool } from '../../src/tools/math';

describe('divideTool tool', () => {
  it('should correctly divide two numbers', async () => {
    const result = await divideTool.cb({ dividend: 10, divisor: 2 }, {} as any);
    expect(result.content[0].text).toEqual('5');
    expect(result.isError).toBeFalsy();
  });

  it('should handle division by zero error', async () => {
    const result = await divideTool.cb({ dividend: 10, divisor: 0 }, {} as any);
    expect(result.content[0].text).toEqual('Error: Cannot divide by zero');
    expect(result.isError).toBeTruthy();
  });
});
