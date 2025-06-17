
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type UpdatePromptInput, type Prompt } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePrompt = async (input: UpdatePromptInput): Promise<Prompt> => {
  try {
    // Prepare update values, converting numeric fields to strings
    const updateValues: any = {};
    
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.prompt_text !== undefined) updateValues.prompt_text = input.prompt_text;
    if (input.model !== undefined) updateValues.model = input.model;
    if (input.temperature !== undefined) updateValues.temperature = input.temperature.toString();
    if (input.max_tokens !== undefined) updateValues.max_tokens = input.max_tokens;
    if (input.top_p !== undefined) updateValues.top_p = input.top_p.toString();
    if (input.frequency_penalty !== undefined) updateValues.frequency_penalty = input.frequency_penalty.toString();
    if (input.presence_penalty !== undefined) updateValues.presence_penalty = input.presence_penalty.toString();
    if (input.destination_webhook_url !== undefined) updateValues.destination_webhook_url = input.destination_webhook_url;
    if (input.cron_schedule !== undefined) updateValues.cron_schedule = input.cron_schedule;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;
    
    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    // Update the prompt
    const result = await db.update(promptsTable)
      .set(updateValues)
      .where(eq(promptsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Prompt with id ${input.id} not found`);
    }

    // Convert numeric fields back to numbers before returning
    const prompt = result[0];
    return {
      ...prompt,
      temperature: parseFloat(prompt.temperature),
      top_p: parseFloat(prompt.top_p),
      frequency_penalty: parseFloat(prompt.frequency_penalty),
      presence_penalty: parseFloat(prompt.presence_penalty)
    };
  } catch (error) {
    console.error('Prompt update failed:', error);
    throw error;
  }
};
