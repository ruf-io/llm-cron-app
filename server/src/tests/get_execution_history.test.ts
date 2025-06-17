
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable, executionHistoryTable } from '../db/schema';
import { type CreatePromptInput, type ExecutionHistory } from '../schema';
import { getExecutionHistory } from '../handlers/get_execution_history';
import { eq } from 'drizzle-orm';

// Test data
const testPrompt: CreatePromptInput = {
  name: 'Test Prompt',
  description: 'A prompt for testing',
  prompt_text: 'Hello {{name}}!',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 100,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  destination_webhook_url: 'https://example.com/webhook',
  cron_schedule: '0 0 * * *',
  is_active: true
};

const createTestPrompt = async () => {
  const result = await db.insert(promptsTable)
    .values({
      ...testPrompt,
      temperature: testPrompt.temperature.toString(),
      top_p: testPrompt.top_p.toString(),
      frequency_penalty: testPrompt.frequency_penalty.toString(),
      presence_penalty: testPrompt.presence_penalty.toString()
    })
    .returning()
    .execute();

  return result[0];
};

const createTestExecution = async (promptId: number, overrides = {}) => {
  const defaultExecution = {
    prompt_id: promptId,
    trigger_type: 'cron' as const,
    input_data: { name: 'World' },
    rendered_prompt: 'Hello World!',
    openai_response: { 
      choices: [{ message: { content: 'Hello back!' } }],
      usage: { total_tokens: 15 }
    },
    webhook_response_status: 200,
    webhook_response_body: 'OK',
    execution_status: 'success' as const,
    error_message: null,
    ...overrides
  };

  const result = await db.insert(executionHistoryTable)
    .values(defaultExecution)
    .returning()
    .execute();

  return result[0];
};

describe('getExecutionHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all execution history when no prompt ID is provided', async () => {
    const prompt1 = await createTestPrompt();
    const prompt2 = await createTestPrompt();

    // Create multiple executions for different prompts
    await createTestExecution(prompt1.id);
    await createTestExecution(prompt2.id, { trigger_type: 'webhook' });
    await createTestExecution(prompt1.id, { execution_status: 'failed' });

    const results = await getExecutionHistory();

    expect(results).toHaveLength(3);
    
    // Verify all executions are returned
    const promptIds = results.map(r => r.prompt_id);
    expect(promptIds).toContain(prompt1.id);
    expect(promptIds).toContain(prompt2.id);

    // Verify different trigger types and statuses
    const triggerTypes = results.map(r => r.trigger_type);
    expect(triggerTypes).toContain('cron');
    expect(triggerTypes).toContain('webhook');

    const statuses = results.map(r => r.execution_status);
    expect(statuses).toContain('success');
    expect(statuses).toContain('failed');
  });

  it('should return execution history for specific prompt when prompt ID is provided', async () => {
    const prompt1 = await createTestPrompt();
    const prompt2 = await createTestPrompt();

    // Create executions for both prompts
    await createTestExecution(prompt1.id);
    await createTestExecution(prompt2.id);
    await createTestExecution(prompt1.id, { trigger_type: 'webhook' });

    const results = await getExecutionHistory(prompt1.id);

    expect(results).toHaveLength(2);
    
    // All results should be for the specified prompt
    results.forEach(result => {
      expect(result.prompt_id).toEqual(prompt1.id);
    });

    // Verify both executions for prompt1 are returned
    const triggerTypes = results.map(r => r.trigger_type);
    expect(triggerTypes).toContain('cron');
    expect(triggerTypes).toContain('webhook');
  });

  it('should return execution history ordered by created_at descending', async () => {
    const prompt = await createTestPrompt();

    // Create multiple executions with slight delays to ensure different timestamps
    const execution1 = await createTestExecution(prompt.id);
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    const execution2 = await createTestExecution(prompt.id, { trigger_type: 'webhook' });
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    const execution3 = await createTestExecution(prompt.id);

    const results = await getExecutionHistory(prompt.id);

    expect(results).toHaveLength(3);
    
    // Should be ordered by created_at descending (newest first)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].created_at >= results[i + 1].created_at).toBe(true);
    }

    // The most recent execution should be first
    expect(results[0].id).toEqual(execution3.id);
  });

  it('should return empty array when no execution history exists', async () => {
    const results = await getExecutionHistory();
    expect(results).toHaveLength(0);
  });

  it('should return empty array when no execution history exists for specific prompt', async () => {
    const prompt = await createTestPrompt();
    const results = await getExecutionHistory(prompt.id);
    expect(results).toHaveLength(0);
  });

  it('should properly convert JSON fields to correct types', async () => {
    const prompt = await createTestPrompt();
    
    const testInputData = { name: 'Alice', age: 30, active: true };
    const testOpenAIResponse = {
      choices: [{ message: { content: 'Generated response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      model: 'gpt-3.5-turbo'
    };

    await createTestExecution(prompt.id, {
      input_data: testInputData,
      openai_response: testOpenAIResponse
    });

    const results = await getExecutionHistory(prompt.id);

    expect(results).toHaveLength(1);
    const execution = results[0];

    // Verify input_data is properly typed
    expect(execution.input_data).toEqual(testInputData);
    expect(typeof execution.input_data).toBe('object');
    expect(execution.input_data!['name']).toEqual('Alice');
    expect(execution.input_data!['age']).toEqual(30);
    expect(execution.input_data!['active']).toEqual(true);

    // Verify openai_response is properly typed
    expect(execution.openai_response).toEqual(testOpenAIResponse);
    expect(typeof execution.openai_response).toBe('object');
    expect(execution.openai_response['choices'][0]['message']['content']).toEqual('Generated response');
    expect(execution.openai_response['usage']['total_tokens']).toEqual(15);
  });

  it('should handle null input_data correctly', async () => {
    const prompt = await createTestPrompt();
    
    await createTestExecution(prompt.id, {
      input_data: null
    });

    const results = await getExecutionHistory(prompt.id);

    expect(results).toHaveLength(1);
    expect(results[0].input_data).toBeNull();
  });

  it('should include all execution history fields', async () => {
    const prompt = await createTestPrompt();
    
    const testExecution = await createTestExecution(prompt.id, {
      trigger_type: 'webhook',
      execution_status: 'failed',
      error_message: 'OpenAI API error',
      webhook_response_status: 500,
      webhook_response_body: 'Internal Server Error'
    });

    const results = await getExecutionHistory(prompt.id);

    expect(results).toHaveLength(1);
    const execution = results[0];

    // Verify all fields are present and correct
    expect(execution.id).toBeDefined();
    expect(execution.prompt_id).toEqual(prompt.id);
    expect(execution.trigger_type).toEqual('webhook');
    expect(execution.input_data).toEqual({ name: 'World' });
    expect(execution.rendered_prompt).toEqual('Hello World!');
    expect(execution.openai_response).toBeDefined();
    expect(execution.webhook_response_status).toEqual(500);
    expect(execution.webhook_response_body).toEqual('Internal Server Error');
    expect(execution.execution_status).toEqual('failed');
    expect(execution.error_message).toEqual('OpenAI API error');
    expect(execution.created_at).toBeInstanceOf(Date);
  });
});
