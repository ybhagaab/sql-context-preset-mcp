import { describe, it, expect } from 'vitest';
import { amazonEmployeeBadgeColorPrompt } from '../../src/prompts/badgeColor.js';

describe('amazonEmployeeBadgeColorPrompt', () => {
  it('should generate correct prompt message with the provided login', async () => {
    const testLogin = 'mockuser';

    // Expect no error thrown
    const result = await amazonEmployeeBadgeColorPrompt.cb({ login: testLogin }, {} as any);

    // Check basic message results
    expect(result.messages).toHaveLength(1);
    const promptText = result.messages[0].content.text;
    expect(promptText).toContain(`The badge color for ${testLogin} is [badge_color]`);

    // Check dedentation
    expect(promptText).toContain('\n[0 to 5) years = Blue');
  });
});
