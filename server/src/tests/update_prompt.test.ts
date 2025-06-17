
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type UpdatePromptInput, type CreatePromptInput } from '../schema';
import { updatePrompt } from '../handlers/update_prompt';
import { eq } from 'drizzle-orm';

// Helper function to create a test prompt
const createTestPrompt = async (): Promise<number> => {
  const testInput: CreatePromptInput = {
    name: 'Test Prompt',
    description: 'A test prompt',
    prompt_text: 'Hello, world!',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 100,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    destination_webhook_url: 'https://example.com/webhook',
    cron_schedule: '0 * * * *',
    is_active: true
  };

  const result = await db.insert(promptsTable)
    .values({
      ...testInput,
      temperature: testInput.temperature.toString(),
      top_p: testInput.top_p.toString(),
      frequency_penalty: testInput.frequency_penalty.toString(),
      presence_penalty: testInput.presence_penalty.toString()
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updatePrompt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a prompt with all fields', async () => {
    const promptId = await createTestPrompt();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      name: 'Updated Prompt',
      description: 'Updated description',
      prompt_text: 'Updated prompt text',
      model: 'gpt-4',
      temperature: 0.5,
      max_tokens: 200,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      destination_webhook_url: 'https://updated.com/webhook',
      cron_schedule: '0 0 * * *',
      is_active: false
    };

    const result = await updatePrompt(updateInput);

    expect(result.id).toEqual(promptId);
    expect(result.name).toEqual('Updated Prompt');
    expect(result.description).toEqual('Updated description');
    expect(result.prompt_text).toEqual('Updated prompt text');
    expect(result.model).toEqual('gpt-4');
    expect(result.temperature).toEqual(0.5);
    expect(result.max_tokens).toEqual(200);
    expect(result.top_p).toEqual(0.9);
    expect(result.frequency_penalty).toEqual(0.1);
    expect(result.presence_penalty).toEqual(0.2);
    expect(result.destination_webhook_url).toEqual('https://updated.com/webhook');
    expect(result.cron_schedule).toEqual('0 0 * * *');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const promptId = await createTestPrompt();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      name: 'Partially Updated',
      temperature: 0.3
    };

    const result = await updatePrompt(updateInput);

    expect(result.name).toEqual('Partially Updated');
    expect(result.temperature).toEqual(0.3);
    expect(result.description).toEqual('A test prompt'); // Should remain unchanged
    expect(result.prompt_text).toEqual('Hello, world!'); // Should remain unchanged
    expect(result.model).toEqual('gpt-3.5-turbo'); // Should remain unchanged
  });

  it('should update numeric fields correctly', async () => {
    const promptId = await createTestPrompt();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      temperature: 1.5,
      top_p: 0.8,
      frequency_penalty: -0.5,
      presence_penalty: 1.2
    };

    const result = await updatePrompt(updateInput);

    expect(typeof result.temperature).toBe('number');
    expect(typeof result.top_p).toBe('number');
    expect(typeof result.frequency_penalty).toBe('number');
    expect(typeof result.presence_penalty).toBe('number');
    expect(result.temperature).toEqual(1.5);
    expect(result.top_p).toEqual(0.8);
    expect(result.frequency_penalty).toEqual(-0.5);
    expect(result.presence_penalty).toEqual(1.2);
  });

  it('should handle nullable fields', async () => {
    const promptId = await createTestPrompt();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      description: null,
      max_tokens: null,
      cron_schedule: null
    };

    const result = await updatePrompt(updateInput);

    expect(result.description).toBeNull();
    expect(result.max_tokens).toBeNull();
    expect(result.cron_schedule).toBeNull();
  });

  it('should save changes to database', async () => {
    const promptId = await createTestPrompt();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      name: 'Database Test',
      temperature: 0.9
    };

    await updatePrompt(updateInput);

    const prompts = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, promptId))
      .execute();

    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toEqual('Database Test');
    expect(parseFloat(prompts[0].temperature)).toEqual(0.9);
  });

  it('should update the updated_at timestamp', async () => {
    const promptId = await createTestPrompt();

    // Get original timestamp
    const originalPrompt = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, promptId))
      .execute();

    const originalUpdatedAt = originalPrompt[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdatePromptInput = {
      id: promptId,
      name: 'Timestamp Test'
    };

    const result = await updatePrompt(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent prompt', async () => {
    const updateInput: UpdatePromptInput = {
      id: 99999,
      name: 'Non-existent'
    };

    expect(updatePrompt(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should preserve original values for unchanged fields', async () => {
    const promptId = await createTestPrompt();

    // Get original prompt
    const originalPrompt = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, promptId))
      .execute();

    const updateInput: UpdatePromptInput = {
      id: promptId,
      name: 'Only Name Changed'
    };

    const result = await updatePrompt(updateInput);

    // All other fields should remain the same
    expect(result.description).toEqual(originalPrompt[0].description);
    expect(result.prompt_text).toEqual(originalPrompt[0].prompt_text);
    expect(result.model).toEqual(originalPrompt[0].model);
    expect(result.destination_webhook_url).toEqual(originalPrompt[0].destination_webhook_url);
    expect(result.is_active).toEqual(originalPrompt[0].is_active);
    expect(result.created_at).toEqual(originalPrompt[0].created_at);
  });
});
