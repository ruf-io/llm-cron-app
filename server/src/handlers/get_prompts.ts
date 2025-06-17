
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type Prompt } from '../schema';

export const getPrompts = async (): Promise<Prompt[]> => {
  try {
    const results = await db.select()
      .from(promptsTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(prompt => ({
      ...prompt,
      temperature: parseFloat(prompt.temperature),
      top_p: parseFloat(prompt.top_p),
      frequency_penalty: parseFloat(prompt.frequency_penalty),
      presence_penalty: parseFloat(prompt.presence_penalty)
    }));
  } catch (error) {
    console.error('Failed to get prompts:', error);
    throw error;
  }
};
