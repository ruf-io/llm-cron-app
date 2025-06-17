
import { db } from '../db';
import { promptsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deletePrompt = async (id: number): Promise<{ success: boolean }> => {
  try {
    // Delete the prompt by ID
    const result = await db.delete(promptsTable)
      .where(eq(promptsTable.id, id))
      .returning()
      .execute();

    // Return success based on whether a row was deleted
    return { success: result.length > 0 };
  } catch (error) {
    console.error('Prompt deletion failed:', error);
    throw error;
  }
};
