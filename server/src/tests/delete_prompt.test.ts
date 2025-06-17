
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { deletePrompt } from '../handlers/delete_prompt';
import { type CreatePromptInput } from '../schema';

// Test input for creating a prompt to delete
const testPromptInput: CreatePromptInput = {
  name: 'Test Prompt',
  description: 'A prompt for testing deletion',
  prompt_text: 'Hello {{name}}!',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: null,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  destination_webhook_url: 'https://example.com/webhook',
  cron_schedule: '0 9 * * *',
  is_active: true
};

describe('deletePrompt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an existing prompt', async () => {
    // Create a prompt first
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

    const promptId = insertResult[0].id;

    // Delete the prompt
    const result = await deletePrompt(promptId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify prompt is no longer in database
    const prompts = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, promptId))
      .execute();

    expect(prompts).toHaveLength(0);
  });

  it('should return false when deleting non-existent prompt', async () => {
    // Try to delete a prompt that doesn't exist
    const result = await deletePrompt(999);

    // Verify deletion was not successful
    expect(result.success).toBe(false);
  });

  it('should handle multiple prompts correctly', async () => {
    // Create two prompts
    const insertResults = await db.insert(promptsTable)
      .values([
        {
          name: 'First Prompt',
          description: 'First test prompt',
          prompt_text: 'Hello {{name}}!',
          model: 'gpt-3.5-turbo',
          temperature: '0.7',
          max_tokens: null,
          top_p: '1',
          frequency_penalty: '0',
          presence_penalty: '0',
          destination_webhook_url: 'https://example.com/webhook1',
          cron_schedule: '0 9 * * *',
          is_active: true
        },
        {
          name: 'Second Prompt',
          description: 'Second test prompt',
          prompt_text: 'Goodbye {{name}}!',
          model: 'gpt-4',
          temperature: '0.5',
          max_tokens: 100,
          top_p: '0.8',
          frequency_penalty: '0.1',
          presence_penalty: '0.1',
          destination_webhook_url: 'https://example.com/webhook2',
          cron_schedule: null,
          is_active: false
        }
      ])
      .returning()
      .execute();

    const firstPromptId = insertResults[0].id;
    const secondPromptId = insertResults[1].id;

    // Delete only the first prompt
    const result = await deletePrompt(firstPromptId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify first prompt is deleted
    const firstPromptCheck = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, firstPromptId))
      .execute();

    expect(firstPromptCheck).toHaveLength(0);

    // Verify second prompt still exists
    const secondPromptCheck = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, secondPromptId))
      .execute();

    expect(secondPromptCheck).toHaveLength(1);
    expect(secondPromptCheck[0].name).toBe('Second Prompt');
  });
});
