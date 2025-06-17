
import { db } from '../db';
import { executionHistoryTable } from '../db/schema';
import { type ExecutionHistory } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getExecutionHistory = async (promptId?: number): Promise<ExecutionHistory[]> => {
  try {
    // Build query conditionally to avoid TypeScript issues
    const results = promptId !== undefined 
      ? await db.select()
          .from(executionHistoryTable)
          .where(eq(executionHistoryTable.prompt_id, promptId))
          .orderBy(desc(executionHistoryTable.created_at))
          .execute()
      : await db.select()
          .from(executionHistoryTable)
          .orderBy(desc(executionHistoryTable.created_at))
          .execute();

    // Convert JSON fields to proper types
    return results.map(record => ({
      ...record,
      input_data: record.input_data as Record<string, any> | null,
      openai_response: record.openai_response as Record<string, any>
    }));
  } catch (error) {
    console.error('Get execution history failed:', error);
    throw error;
  }
};
