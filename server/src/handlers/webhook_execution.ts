
import { db } from '../db';
import { promptsTable, executionHistoryTable } from '../db/schema';
import { type WebhookExecutionInput, type ExecutionHistory } from '../schema';
import { eq } from 'drizzle-orm';

export const webhookExecution = async (input: WebhookExecutionInput): Promise<ExecutionHistory> => {
  try {
    // 1. Retrieve the prompt
    const prompts = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, input.prompt_id))
      .execute();

    if (prompts.length === 0) {
      throw new Error(`Prompt with ID ${input.prompt_id} not found`);
    }

    const prompt = prompts[0];

    if (!prompt.is_active) {
      throw new Error(`Prompt with ID ${input.prompt_id} is not active`);
    }

    // 2. Render the prompt template with payload data
    let renderedPrompt = prompt.prompt_text;
    for (const [key, value] of Object.entries(input.payload)) {
      const placeholder = `{{${key}}}`;
      renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    let openaiResponse: Record<string, any> = {};
    let webhookResponseStatus: number | null = null;
    let webhookResponseBody: string | null = null;
    let executionStatus: 'success' | 'failed' = 'success';
    let errorMessage: string | null = null;

    try {
      // 3. Call OpenAI API
      const openaiPayload = {
        model: prompt.model,
        messages: [{ role: 'user', content: renderedPrompt }],
        temperature: parseFloat(prompt.temperature),
        top_p: parseFloat(prompt.top_p),
        frequency_penalty: parseFloat(prompt.frequency_penalty),
        presence_penalty: parseFloat(prompt.presence_penalty),
        ...(prompt.max_tokens && { max_tokens: prompt.max_tokens })
      };

      const openaiResult = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`
        },
        body: JSON.stringify(openaiPayload)
      });

      openaiResponse = await openaiResult.json() as Record<string, any>;

      if (!openaiResult.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse['error']?.['message'] || 'Unknown error'}`);
      }

      // 4. Send result to destination webhook
      if (openaiResponse['choices']?.[0]?.['message']?.['content']) {
        const webhookPayload = {
          prompt_id: input.prompt_id,
          original_payload: input.payload,
          openai_response: openaiResponse['choices'][0]['message']['content'],
          execution_id: null // Will be set after we create the execution record
        };

        const webhookResult = await fetch(prompt.destination_webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        });

        webhookResponseStatus = webhookResult.status;
        webhookResponseBody = await webhookResult.text();

        if (!webhookResult.ok) {
          executionStatus = 'failed';
          errorMessage = `Webhook delivery failed with status ${webhookResponseStatus}: ${webhookResponseBody}`;
        }
      } else {
        executionStatus = 'failed';
        errorMessage = 'No content received from OpenAI API';
      }

    } catch (error) {
      executionStatus = 'failed';
      errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Set a default response if OpenAI call failed
      if (Object.keys(openaiResponse).length === 0) {
        openaiResponse = { error: errorMessage };
      }
    }

    // 5. Record execution history
    const executionResult = await db.insert(executionHistoryTable)
      .values({
        prompt_id: input.prompt_id,
        trigger_type: 'webhook',
        input_data: input.payload,
        rendered_prompt: renderedPrompt,
        openai_response: openaiResponse,
        webhook_response_status: webhookResponseStatus,
        webhook_response_body: webhookResponseBody,
        execution_status: executionStatus,
        error_message: errorMessage
      })
      .returning()
      .execute();

    const dbResult = executionResult[0];
    
    // Convert the database result to match the ExecutionHistory type
    return {
      id: dbResult.id,
      prompt_id: dbResult.prompt_id,
      trigger_type: dbResult.trigger_type,
      input_data: dbResult.input_data as Record<string, any> | null,
      rendered_prompt: dbResult.rendered_prompt,
      openai_response: dbResult.openai_response as Record<string, any>,
      webhook_response_status: dbResult.webhook_response_status,
      webhook_response_body: dbResult.webhook_response_body,
      execution_status: dbResult.execution_status,
      error_message: dbResult.error_message,
      created_at: dbResult.created_at
    };

  } catch (error) {
    console.error('Webhook execution failed:', error);
    throw error;
  }
};
