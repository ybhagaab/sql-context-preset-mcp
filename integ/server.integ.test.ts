import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import { server } from '../src/server';
import { createDirectTransportPair } from './direct-transport';

// Initialize client outside the test so it can be accessed by afterAll
let client: Client;
let serverTransport: Transport;
let clientTransport: Transport;

beforeAll(async () => {
  // Initialize client
  client = new Client({
    name: 'testing-client',
    version: '1.0.0',
  });

  // Connect client and server
  [clientTransport, serverTransport] = createDirectTransportPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

// Close any open connections after all tests complete
afterAll(async () => {
  if (clientTransport) {
    await clientTransport.close();
  }
  if (serverTransport) {
    await serverTransport.close();
  }
  if (client) {
    await client.close();
  }
  if (server) {
    await server.close();
  }
});

describe('Example Tool Tests', () => {
  // Test listing tools
  it('tools/list returns all tools', async () => {
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThanOrEqual(1);

    const toolNames = tools.tools.map((tool: { name: any }) => tool.name);
    expect(toolNames).toContain('divide');
    expect(toolNames).toContain('amazon-tenure');
  });

  // Test tools calls
  describe('divide tool', () => {
    it('correctly called with arguments', async () => {
      const result = await client.callTool({ name: 'divide', arguments: { dividend: 10, divisor: 2 } });
      expect((result.content as Array<{ type: string; text: string }>)[0].text).toEqual('5');
      expect(result.isError).toBeFalsy();
    });
  });

  describe('amazon-tenure tool', () => {
    it('call with current user alias', async () => {
      const user = process.env.USER;
      const result = await client.callTool({ name: 'amazon-tenure', arguments: { login: user } });
      expect((result.content as Array<{ type: string; text: string }>)[0].text).toContain(`Tenure of ${user} is`);
      expect(result.isError).toBeFalsy();
    });
  });

  // Test listing prompts
  it('prompts/list returns all prompts', async () => {
    const prompts = await client.listPrompts();
    expect(prompts.prompts.length).toBeGreaterThanOrEqual(1);

    const promptNames = prompts.prompts.map((prompt: { name: any }) => prompt.name);
    expect(promptNames).toContain('amazon-employee-badge-color');
  });

  describe('amazon-employee-badge-color', () => {
    it('get with correct template', async () => {
      const user = process.env.USER ?? 'jeff';
      const result = await client.getPrompt({ name: 'amazon-employee-badge-color', arguments: { login: user } });
      expect((result.messages as Array<{ role: string; content: { type: string; text: string } }>).length).toBe(1);
      expect(
        (result.messages as Array<{ role: string; content: { type: string; text: string } }>)[0].content.text,
      ).toContain(`The badge color for ${user} is [badge_color]`);
    });
  });
});
