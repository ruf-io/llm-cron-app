
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { getPrompts } from '../handlers/get_prompts';

// Test prompt data
const testPrompt1 = {
  name: 'Test Prompt 1',
  description: 'First test prompt',
  prompt_text: 'Generate a creative story about {{topic}}',
  model: 'gpt-4',
  temperature: '0.8',
  max_tokens: 1000,
  top_p: '0.9',
  frequency_penalty: '0.1',
  presence_penalty: '0.2',
  destination_webhook_url: 'https://example.com/webhook1',
  cron_schedule: '0 9 * * *',
  is_active: true
};

const testPrompt2 = {
  name: 'Test Prompt 2',
  description: null,
  prompt_text: 'Summarize the following text: {{content}}',
  model: 'gpt-3.5-turbo',
  temperature: '0.3',
  max_tokens: null,
  top_p: '1.0',
  frequency_penalty: '0.0',
  presence_penalty: '0.0',
  destination_webhook_url: 'https://example.com/webhook2',
  cron_schedule: null,
  is_active: false
};

describe('getPrompts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no prompts exist', async () => {
    const result = await getPrompts();
    expect(result).toEqual([]);
  });

  it('should return all prompts with correct numeric conversions', async () => {
    // Insert test prompts
    await db.insert(promptsTable).values([testPrompt1, testPrompt2]).execute();

    const result = await getPrompts();

    expect(result).toHaveLength(2);

    // Check first prompt
    const prompt1 = result.find(p => p.name === 'Test Prompt 1');
    expect(prompt1).toBeDefined();
    expect(prompt1!.description).toEqual('First test prompt');
    expect(prompt1!.prompt_text).toEqual('Generate a creative story about {{topic}}');
    expect(prompt1!.model).toEqual('gpt-4');
    expect(prompt1!.temperature).toEqual(0.8);
    expect(typeof prompt1!.temperature).toEqual('number');
    expect(prompt1!.max_tokens).toEqual(1000);
    expect(prompt1!.top_p).toEqual(0.9);
    expect(typeof prompt1!.top_p).toEqual('number');
    expect(prompt1!.frequency_penalty).toEqual(0.1);
    expect(typeof prompt1!.frequency_penalty).toEqual('number');
    expect(prompt1!.presence_penalty).toEqual(0.2);
    expect(typeof prompt1!.presence_penalty).toEqual('number');
    expect(prompt1!.destination_webhook_url).toEqual('https://example.com/webhook1');
    expect(prompt1!.cron_schedule).toEqual('0 9 * * *');
    expect(prompt1!.is_active).toEqual(true);
    expect(prompt1!.id).toBeDefined();
    expect(prompt1!.created_at).toBeInstanceOf(Date);
    expect(prompt1!.updated_at).toBeInstanceOf(Date);

    // Check second prompt
    const prompt2 = result.find(p => p.name === 'Test Prompt 2');
    expect(prompt2).toBeDefined();
    expect(prompt2!.description).toBeNull();
    expect(prompt2!.prompt_text).toEqual('Summarize the following text: {{content}}');
    expect(prompt2!.model).toEqual('gpt-3.5-turbo');
    expect(prompt2!.temperature).toEqual(0.3);
    expect(typeof prompt2!.temperature).toEqual('number');
    expect(prompt2!.max_tokens).toBeNull();
    expect(prompt2!.top_p).toEqual(1.0);
    expect(typeof prompt2!.top_p).toEqual('number');
    expect(prompt2!.frequency_penalty).toEqual(0.0);
    expect(typeof prompt2!.frequency_penalty).toEqual('number');
    expect(prompt2!.presence_penalty).toEqual(0.0);
    expect(typeof prompt2!.presence_penalty).toEqual('number');
    expect(prompt2!.destination_webhook_url).toEqual('https://example.com/webhook2');
    expect(prompt2!.cron_schedule).toBeNull();
    expect(prompt2!.is_active).toEqual(false);
    expect(prompt2!.id).toBeDefined();
    expect(prompt2!.created_at).toBeInstanceOf(Date);
    expect(prompt2!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle prompts with extreme numeric values', async () => {
    const extremePrompt = {
      name: 'Extreme Values Prompt',
      description: 'Testing boundary values',
      prompt_text: 'Test prompt with extreme values',
      model: 'gpt-4',
      temperature: '2.0', // Maximum allowed
      max_tokens: 4000,
      top_p: '0.01', // Very low value
      frequency_penalty: '-2.0', // Minimum allowed
      presence_penalty: '2.0', // Maximum allowed
      destination_webhook_url: 'https://example.com/extreme',
      cron_schedule: '*/5 * * * *',
      is_active: true
    };

    await db.insert(promptsTable).values(extremePrompt).execute();

    const result = await getPrompts();
    expect(result).toHaveLength(1);

    const prompt = result[0];
    expect(prompt.temperature).toEqual(2.0);
    expect(typeof prompt.temperature).toEqual('number');
    expect(prompt.top_p).toEqual(0.01);
    expect(typeof prompt.top_p).toEqual('number');
    expect(prompt.frequency_penalty).toEqual(-2.0);
    expect(typeof prompt.frequency_penalty).toEqual('number');
    expect(prompt.presence_penalty).toEqual(2.0);
    expect(typeof prompt.presence_penalty).toEqual('number');
  });

  it('should preserve order from database', async () => {
    // Insert multiple prompts to test ordering
    const prompts = [
      { ...testPrompt1, name: 'Alpha Prompt' },
      { ...testPrompt2, name: 'Beta Prompt' },
      { ...testPrompt1, name: 'Gamma Prompt' }
    ];

    await db.insert(promptsTable).values(prompts).execute();

    const result = await getPrompts();
    expect(result).toHaveLength(3);

    // Verify all prompts are returned
    const names = result.map(p => p.name);
    expect(names).toContain('Alpha Prompt');
    expect(names).toContain('Beta Prompt');
    expect(names).toContain('Gamma Prompt');
  });
});
