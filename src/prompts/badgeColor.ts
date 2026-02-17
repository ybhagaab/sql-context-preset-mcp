import { z } from 'zod';
import * as dedent from 'dedent-js';
import type { Prompt } from '../types';
import { validateAmazonLogin } from '../utils.js';

export const amazonEmployeeBadgeColorPrompt: Prompt<{ login: z.ZodString }> = {
  name: 'amazon-employee-badge-color',
  description: 'A prompt template that instruct LLM to figure out the badge color of the employee.',
  paramSchema: { login: z.string() },
  cb: ({ login }) => {
    validateAmazonLogin(login);
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: dedent.default(`
            <task_description>
            Determine the badge color for an Amazon employee based on their tenure with the company.
            </task_description>

            <input_placeholder>
            ${login}
            </input_placeholder>

            <steps>
            1. Use the "amazon-tenure" tool to retrieve the employee's tenure in days.
            2. Use the "divide" tool to calculate the employee's tenure in years, assuming 365 days per year.
            3. Apply the following rules to determine the badge color based on the tenure in years:

            <badge_color_rules>
            [0 to 5) years = Blue
            [5 to 10) years = Orange
            [10 to 15) years = Red
            [15 to 20) years = Purple
            [20 to 25) years = Silver
            [25+) years = Gold
            </badge_color_rules>
            </steps>

            <examples>
            Example 1: If the tenure is 5.32 years, it falls in the range [5 to 10), so the badge color is Orange.
            Example 2: If the tenure is 19.9 years, it falls in the range [15 to 20), so the badge color is Purple.
            Example 3: If the tenure is 26.2 years, it falls in the range [25+), so the badge color is Gold.
            </examples>

            <output_format>
            The badge color for ${login} is [badge_color], because their tenure is [tenure_years] years.
            </output_format>
            `),
          },
        },
      ],
    };
  },
};
