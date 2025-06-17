
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type CreatePromptInput, type Prompt } from '../schema';

export const createPrompt = async (input: CreatePromptInput): Promise<Prompt> => {
  try {
    // Insert prompt record
    const result = await db.insert(promptsTable)
      .values({
        name: input.name,
        description: input.description,
        prompt_text: input.prompt_text,
        model: input.model,
        temperature: input.temperature.toString(),
        max_tokens: input.max_tokens,
        top_p: input.top_p.toString(),
        frequency_penalty: input.frequency_penalty.toString(),
        presence_penalty: input.presence_penalty.toString(),
        destination_webhook_url: input.destination_webhook_url,
        cron_schedule: input.cron_schedule,
        is_active: input.is_active
      })
      .returning()
      .execute();

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
    console.error('Prompt creation failed:', error);
    throw error;
  }
};
