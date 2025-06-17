
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type CreatePromptInput } from '../schema';
import { getPrompt } from '../handlers/get_prompt';

// Test input for creating a prompt
const testPromptInput: CreatePromptInput = {
  name: 'Test Prompt',
  description: 'A prompt for testing',
  prompt_text: 'Generate a summary of {{content}}',
  model: 'gpt-3.5-turbo',
  temperature: 0.8,
  max_tokens: 150,
  top_p: 0.9,
  frequency_penalty: 0.1,
  presence_penalty: 0.2,
  destination_webhook_url: 'https://example.com/webhook',
  cron_schedule: '0 0 * * *',
  is_active: true
};

describe('getPrompt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return a prompt when it exists', async () => {
    // Create a test prompt first
    const insertResult = await db.insert(promptsTable)
      .values({
        name: testPromptInput.name,
        description: testPromptInput.description,
        prompt_text: testPromptInput.prompt_text,
        model: testPromptInput.model,
        temperature: testPromptInput.temperature.toString(),
        max_tokens: testPromptInput.max_tokens,
        top_p: testPromptInput.top_p.toString(),
        frequency_penalty: testPromptInput.frequency_penalty.toString(),
        presence_penalty: testPromptInput.presence_penalty.toString(),
        destination_webhook_url: testPromptInput.destination_webhook_url,
        cron_schedule: testPromptInput.cron_schedule,
        is_active: testPromptInput.is_active
      })
      .returning()
      .execute();

    const createdPrompt = insertResult[0];

    // Test getting the prompt
    const result = await getPrompt(createdPrompt.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdPrompt.id);
    expect(result!.name).toEqual('Test Prompt');
    expect(result!.description).toEqual('A prompt for testing');
    expect(result!.prompt_text).toEqual('Generate a summary of {{content}}');
    expect(result!.model).toEqual('gpt-3.5-turbo');
    expect(result!.temperature).toEqual(0.8);
    expect(typeof result!.temperature).toBe('number');
    expect(result!.max_tokens).toEqual(150);
    expect(result!.top_p).toEqual(0.9);
    expect(typeof result!.top_p).toBe('number');
    expect(result!.frequency_penalty).toEqual(0.1);
    expect(typeof result!.frequency_penalty).toBe('number');
    expect(result!.presence_penalty).toEqual(0.2);
    expect(typeof result!.presence_penalty).toBe('number');
    expect(result!.destination_webhook_url).toEqual('https://example.com/webhook');
    expect(result!.cron_schedule).toEqual('0 0 * * *');
    expect(result!.is_active).toEqual(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when prompt does not exist', async () => {
    const result = await getPrompt(999);
    expect(result).toBeNull();
  });

  it('should properly convert numeric fields from strings', async () => {
    // Create a prompt with various numeric values
    const insertResult = await db.insert(promptsTable)
      .values({
        name: 'Numeric Test Prompt',
        description: null,
        prompt_text: 'Test numeric conversion',
        model: 'gpt-4',
        temperature: '1.5',
        max_tokens: null,
        top_p: '0.5',
        frequency_penalty: '-0.5',
        presence_penalty: '1.0',
        destination_webhook_url: 'https://test.com/webhook',
        cron_schedule: null,
        is_active: false
      })
      .returning()
      .execute();

    const createdPrompt = insertResult[0];
    const result = await getPrompt(createdPrompt.id);

    expect(result).not.toBeNull();
    expect(result!.temperature).toEqual(1.5);
    expect(typeof result!.temperature).toBe('number');
    expect(result!.top_p).toEqual(0.5);
    expect(typeof result!.top_p).toBe('number');
    expect(result!.frequency_penalty).toEqual(-0.5);
    expect(typeof result!.frequency_penalty).toBe('number');
    expect(result!.presence_penalty).toEqual(1.0);
    expect(typeof result!.presence_penalty).toBe('number');
  });
});
