
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promptsTable, executionHistoryTable } from '../db/schema';
import { type ExecutePromptInput } from '../schema';
import { executePrompt } from '../handlers/execute_prompt';
import { eq } from 'drizzle-orm';

// Mock fetch for OpenAI and webhook calls
const originalFetch = global.fetch;

// Test data
const testPrompt = {
  name: 'Test Prompt',
  description: 'A test prompt',
  prompt_text: 'Hello {{name}}, how are you?',
  model: 'gpt-3.5-turbo',
  temperature: '0.7',
  max_tokens: 100,
  top_p: '1.0',
  frequency_penalty: '0.0',
  presence_penalty: '0.0',
  destination_webhook_url: 'https://example.com/webhook',
  cron_schedule: '0 9 * * *',
  is_active: true
};

describe('executePrompt', () => {
  beforeEach(async () => {
    await resetDB();
    await createDB();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should execute a prompt successfully', async () => {
    // Create test prompt
    const promptResult = await db.insert(promptsTable)
      .values(testPrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    // Mock successful OpenAI response
    const mockOpenAIResponse = {
      choices: [{ message: { content: 'Hello John, I am doing well!' } }],
      usage: { total_tokens: 20 }
    };

    // Mock fetch responses
    let callCount = 0;
    (global as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        // First call is OpenAI
        return new Response(JSON.stringify(mockOpenAIResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Second call is webhook
        return new Response('Success', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };

    const result = await executePrompt({
      prompt_id: prompt.id,
      template_data: { name: 'John' }
    });

    // Verify result structure
    expect(result.prompt_id).toEqual(prompt.id);
    expect(result.trigger_type).toEqual('cron');
    expect(result.input_data).toEqual({ name: 'John' });
    expect(result.rendered_prompt).toEqual('Hello John, how are you?');
    expect(result.openai_response).toEqual(mockOpenAIResponse);
    expect(result.webhook_response_status).toEqual(200);
    expect(result.webhook_response_body).toEqual('Success');
    expect(result.execution_status).toEqual('success');
    expect(result.error_message).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save execution history to database', async () => {
    // Create test prompt
    const promptResult = await db.insert(promptsTable)
      .values(testPrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    // Mock responses
    let callCount = 0;
    (global as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Response' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };

    const result = await executePrompt({
      prompt_id: prompt.id,
      template_data: { name: 'Alice' }
    });

    // Query execution history from database
    const historyRecords = await db.select()
      .from(executionHistoryTable)
      .where(eq(executionHistoryTable.id, result.id))
      .execute();

    expect(historyRecords).toHaveLength(1);
    const historyRecord = historyRecords[0];
    
    expect(historyRecord.prompt_id).toEqual(prompt.id);
    expect(historyRecord.trigger_type).toEqual('cron');
    expect(historyRecord.input_data).toEqual({ name: 'Alice' });
    expect(historyRecord.rendered_prompt).toEqual('Hello Alice, how are you?');
    expect(historyRecord.execution_status).toEqual('success');
    expect(historyRecord.created_at).toBeInstanceOf(Date);
  });

  it('should handle prompt not found', async () => {
    await expect(executePrompt({
      prompt_id: 999,
      template_data: {}
    })).rejects.toThrow(/Prompt with id 999 not found/i);
  });

  it('should handle inactive prompt', async () => {
    // Create inactive prompt
    const inactivePrompt = { ...testPrompt, is_active: false };
    const promptResult = await db.insert(promptsTable)
      .values(inactivePrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    await expect(executePrompt({
      prompt_id: prompt.id,
      template_data: {}
    })).rejects.toThrow(/Prompt with id .* is not active/i);
  });

  it('should handle webhook failure', async () => {
    // Create test prompt
    const promptResult = await db.insert(promptsTable)
      .values(testPrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    // Mock successful OpenAI response but failed webhook
    let callCount = 0;
    (global as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Response' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('Internal Server Error', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };

    const result = await executePrompt({
      prompt_id: prompt.id,
      template_data: { name: 'Bob' }
    });

    expect(result.execution_status).toEqual('failed');
    expect(result.error_message).toEqual('Webhook failed with status 500');
    expect(result.webhook_response_status).toEqual(500);
    expect(result.webhook_response_body).toEqual('Internal Server Error');
    expect(result.trigger_type).toEqual('cron');
  });

  it('should render template correctly', async () => {
    // Create prompt with multiple template variables
    const complexPrompt = {
      ...testPrompt,
      prompt_text: 'Hello {{name}}, you have {{count}} messages from {{sender}}'
    };

    const promptResult = await db.insert(promptsTable)
      .values(complexPrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    // Mock responses
    let callCount = 0;
    (global as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Response' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };

    const result = await executePrompt({
      prompt_id: prompt.id,
      template_data: { name: 'Sarah', count: 3, sender: 'Mike' }
    });

    expect(result.rendered_prompt).toEqual('Hello Sarah, you have 3 messages from Mike');
    expect(result.trigger_type).toEqual('cron');
  });

  it('should execute without template data', async () => {
    // Create simple prompt without variables
    const simplePrompt = {
      ...testPrompt,
      prompt_text: 'What is the weather today?'
    };

    const promptResult = await db.insert(promptsTable)
      .values(simplePrompt)
      .returning()
      .execute();

    const prompt = promptResult[0];

    // Mock responses
    let callCount = 0;
    (global as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Sunny' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('OK', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };

    const result = await executePrompt({
      prompt_id: prompt.id
    });

    expect(result.rendered_prompt).toEqual('What is the weather today?');
    expect(result.input_data).toBeNull();
    expect(result.trigger_type).toEqual('cron');
  });
});
