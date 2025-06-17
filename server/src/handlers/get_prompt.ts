
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { type Prompt } from '../schema';
import { eq } from 'drizzle-orm';

export const getPrompt = async (id: number): Promise<Prompt | null> => {
  try {
    const results = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const prompt = results[0];
    
    // Convert numeric fields back to numbers
    return {
      ...prompt,
      temperature: parseFloat(prompt.temperature),
      top_p: parseFloat(prompt.top_p),
      frequency_penalty: parseFloat(prompt.frequency_penalty),
      presence_penalty: parseFloat(prompt.presence_penalty)
    };
  } catch (error) {
    console.error('Get prompt failed:', error);
    throw error;
  }
};
