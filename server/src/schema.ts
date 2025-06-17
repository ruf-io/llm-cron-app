
import { z } from 'zod';

// Prompt schema
export const promptSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  prompt_text: z.string(),
  model: z.string(),
  temperature: z.number(),
  max_tokens: z.number().nullable(),
  top_p: z.number(),
  frequency_penalty: z.number(),
  presence_penalty: z.number(),
  destination_webhook_url: z.string().url(),
  cron_schedule: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Prompt = z.infer<typeof promptSchema>;

// Input schema for creating prompts
export const createPromptInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  prompt_text: z.string().min(1),
  model: z.string().default('gpt-3.5-turbo'),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().positive().nullable(),
  top_p: z.number().min(0).max(1).default(1),
  frequency_penalty: z.number().min(-2).max(2).default(0),
  presence_penalty: z.number().min(-2).max(2).default(0),
  destination_webhook_url: z.string().url(),
  cron_schedule: z.string().nullable(),
  is_active: z.boolean().default(true)
});

export type CreatePromptInput = z.infer<typeof createPromptInputSchema>;

// Input schema for updating prompts
export const updatePromptInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  prompt_text: z.string().min(1).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().nullable().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  destination_webhook_url: z.string().url().optional(),
  cron_schedule: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdatePromptInput = z.infer<typeof updatePromptInputSchema>;

// Execution history schema
export const executionHistorySchema = z.object({
  id: z.number(),
  prompt_id: z.number(),
  trigger_type: z.enum(['cron', 'webhook']),
  input_data: z.record(z.any()).nullable(),
  rendered_prompt: z.string(),
  openai_response: z.record(z.any()),
  webhook_response_status: z.number().nullable(),
  webhook_response_body: z.string().nullable(),
  execution_status: z.enum(['success', 'failed']),
  error_message: z.string().nullable(),
  created_at: z.coerce.date()
});

export type ExecutionHistory = z.infer<typeof executionHistorySchema>;

// Input schema for executing prompts via webhook
export const webhookExecutionInputSchema = z.object({
  prompt_id: z.number(),
  payload: z.record(z.any())
});

export type WebhookExecutionInput = z.infer<typeof webhookExecutionInputSchema>;

// Input schema for manual prompt execution
export const executePromptInputSchema = z.object({
  prompt_id: z.number(),
  template_data: z.record(z.any()).optional()
});

export type ExecutePromptInput = z.infer<typeof executePromptInputSchema>;
