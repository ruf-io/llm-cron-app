
import { serial, text, pgTable, timestamp, numeric, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const triggerTypeEnum = pgEnum('trigger_type', ['cron', 'webhook']);
export const executionStatusEnum = pgEnum('execution_status', ['success', 'failed']);

// Prompts table
export const promptsTable = pgTable('prompts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  prompt_text: text('prompt_text').notNull(),
  model: text('model').notNull().default('gpt-3.5-turbo'),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).notNull().default('0.7'),
  max_tokens: integer('max_tokens'),
  top_p: numeric('top_p', { precision: 3, scale: 2 }).notNull().default('1'),
  frequency_penalty: numeric('frequency_penalty', { precision: 3, scale: 2 }).notNull().default('0'),
  presence_penalty: numeric('presence_penalty', { precision: 3, scale: 2 }).notNull().default('0'),
  destination_webhook_url: text('destination_webhook_url').notNull(),
  cron_schedule: text('cron_schedule'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Execution history table
export const executionHistoryTable = pgTable('execution_history', {
  id: serial('id').primaryKey(),
  prompt_id: integer('prompt_id').notNull().references(() => promptsTable.id, { onDelete: 'cascade' }),
  trigger_type: triggerTypeEnum('trigger_type').notNull(),
  input_data: jsonb('input_data'),
  rendered_prompt: text('rendered_prompt').notNull(),
  openai_response: jsonb('openai_response').notNull(),
  webhook_response_status: integer('webhook_response_status'),
  webhook_response_body: text('webhook_response_body'),
  execution_status: executionStatusEnum('execution_status').notNull(),
  error_message: text('error_message'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const promptsRelations = relations(promptsTable, ({ many }) => ({
  executions: many(executionHistoryTable),
}));

export const executionHistoryRelations = relations(executionHistoryTable, ({ one }) => ({
  prompt: one(promptsTable, {
    fields: [executionHistoryTable.prompt_id],
    references: [promptsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Prompt = typeof promptsTable.$inferSelect;
export type NewPrompt = typeof promptsTable.$inferInsert;
export type ExecutionHistory = typeof executionHistoryTable.$inferSelect;
export type NewExecutionHistory = typeof executionHistoryTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = { 
  prompts: promptsTable, 
  executionHistory: executionHistoryTable 
};
