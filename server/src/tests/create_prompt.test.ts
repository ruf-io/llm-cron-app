
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type CreatePromptInput, createPromptInputSchema } from '../schema';
import { createPrompt } from '../handlers/create_prompt';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreatePromptInput = {
  name: 'Test Prompt',
  description: 'A test prompt for AI generation',
  prompt_text: 'Generate a creative story about {{topic}}.',
  model: 'gpt-3.5-turbo',
  temperature: 0.8,
  max_tokens: 150,
  top_p: 0.9,
  frequency_penalty: 0.1,
  presence_penalty: 0.2,
  destination_webhook_url: 'https://example.com/webhook',
  cron_schedule: '0 9 * * *',
  is_active: true
};

describe('createPrompt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a prompt with all fields', async () => {
    const result = await createPrompt(testInput);

    // Validate all fields
    expect(result.name).toEqual('Test Prompt');
    expect(result.description).toEqual('A test prompt for AI generation');
    expect(result.prompt_text).toEqual('Generate a creative story about {{topic}}.');
    expect(result.model).toEqual('gpt-3.5-turbo');
    expect(result.temperature).toEqual(0.8);
    expect(result.max_tokens).toEqual(150);
    expect(result.top_p).toEqual(0.9);
    expect(result.frequency_penalty).toEqual(0.1);
    expect(result.presence_penalty).toEqual(0.2);
    expect(result.destination_webhook_url).toEqual('https://example.com/webhook');
    expect(result.cron_schedule).toEqual('0 9 * * *');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create prompt with nullable fields as null', async () => {
    const inputWithNulls: CreatePromptInput = {
      ...testInput,
      description: null,
      max_tokens: null,
      cron_schedule: null
    };

    const result = await createPrompt(inputWithNulls);

    expect(result.description).toBeNull();
    expect(result.max_tokens).toBeNull();
    expect(result.cron_schedule).toBeNull();
    expect(result.name).toEqual('Test Prompt');
    expect(result.is_active).toEqual(true);
  });

  it('should apply default values correctly', async () => {
    // Parse minimal input through Zod to get defaults applied
    const minimalRawInput = {
      name: 'Minimal Prompt',
      description: null,
      prompt_text: 'Simple prompt text',
      max_tokens: null, // Required field, must be explicitly set
      destination_webhook_url: 'https://example.com/webhook',
      cron_schedule: null
    };

    const parsedInput = createPromptInputSchema.parse(minimalRawInput);
    const result = await createPrompt(parsedInput);

    // Check Zod defaults are applied
    expect(result.model).toEqual('gpt-3.5-turbo');
    expect(result.temperature).toEqual(0.7);
    expect(result.top_p).toEqual(1.0);
    expect(result.frequency_penalty).toEqual(0.0);
    expect(result.presence_penalty).toEqual(0.0);
    expect(result.is_active).toEqual(true);
    expect(result.max_tokens).toBeNull();
  });

  it('should save prompt to database correctly', async () => {
    const result = await createPrompt(testInput);

    // Query database to verify data was saved
    const prompts = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, result.id))
      .execute();

    expect(prompts).toHaveLength(1);
    const savedPrompt = prompts[0];
    
    expect(savedPrompt.name).toEqual('Test Prompt');
    expect(savedPrompt.description).toEqual('A test prompt for AI generation');
    expect(savedPrompt.prompt_text).toEqual('Generate a creative story about {{topic}}.');
    expect(savedPrompt.model).toEqual('gpt-3.5-turbo');
    expect(parseFloat(savedPrompt.temperature)).toEqual(0.8);
    expect(savedPrompt.max_tokens).toEqual(150);
    expect(parseFloat(savedPrompt.top_p)).toEqual(0.9);
    expect(parseFloat(savedPrompt.frequency_penalty)).toEqual(0.1);
    expect(parseFloat(savedPrompt.presence_penalty)).toEqual(0.2);
    expect(savedPrompt.destination_webhook_url).toEqual('https://example.com/webhook');
    expect(savedPrompt.cron_schedule).toEqual('0 9 * * *');
    expect(savedPrompt.is_active).toEqual(true);
    expect(savedPrompt.created_at).toBeInstanceOf(Date);
    expect(savedPrompt.updated_at).toBeInstanceOf(Date);
  });

  it('should handle numeric type conversions correctly', async () => {
    const result = await createPrompt(testInput);

    // Verify numeric fields are returned as numbers, not strings
    expect(typeof result.temperature).toBe('number');
    expect(typeof result.top_p).toBe('number');
    expect(typeof result.frequency_penalty).toBe('number');
    expect(typeof result.presence_penalty).toBe('number');
    
    // Verify precision is maintained
    expect(result.temperature).toEqual(0.8);
    expect(result.top_p).toEqual(0.9);
    expect(result.frequency_penalty).toEqual(0.1);
    expect(result.presence_penalty).toEqual(0.2);
  });

  it('should create prompt with extreme numeric values', async () => {
    const extremeInput: CreatePromptInput = {
      ...testInput,
      temperature: 2.0, // Max allowed
      top_p: 0.01, // Very low
      frequency_penalty: -2.0, // Min allowed
      presence_penalty: 2.0 // Max allowed
    };

    const result = await createPrompt(extremeInput);

    expect(result.temperature).toEqual(2.0);
    expect(result.top_p).toEqual(0.01);
    expect(result.frequency_penalty).toEqual(-2.0);
    expect(result.presence_penalty).toEqual(2.0);
  });

  it('should create prompt with zero values', async () => {
    const zeroValuesInput: CreatePromptInput = {
      ...testInput,
      temperature: 0.0,
      top_p: 0.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0
    };

    const result = await createPrompt(zeroValuesInput);

    expect(result.temperature).toEqual(0.0);
    expect(result.top_p).toEqual(0.0);
    expect(result.frequency_penalty).toEqual(0.0);
    expect(result.presence_penalty).toEqual(0.0);
  });
});
