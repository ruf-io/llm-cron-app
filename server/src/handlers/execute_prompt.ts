
import { db } from '../db';
import { promptsTable, executionHistoryTable } from '../db/schema';
import { type ExecutePromptInput, type ExecutionHistory } from '../schema';
import { eq } from 'drizzle-orm';

// Simple template rendering function
function renderTemplate(template: string, data: Record<string, any> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

export const executePrompt = async (input: ExecutePromptInput): Promise<ExecutionHistory> => {
  try {
    // Fetch the prompt
    const prompts = await db.select()
      .from(promptsTable)
      .where(eq(promptsTable.id, input.prompt_id))
      .execute();

    if (prompts.length === 0) {
      throw new Error(`Prompt with id ${input.prompt_id} not found`);
    }

    const prompt = prompts[0];

    if (!prompt.is_active) {
      throw new Error(`Prompt with id ${input.prompt_id} is not active`);
    }

    // Render the prompt template
    const renderedPrompt = renderTemplate(prompt.prompt_text, input.template_data);

    // Prepare OpenAI request
    const openaiRequest = {
      model: prompt.model,
      messages: [{ role: 'user', content: renderedPrompt }],
      temperature: parseFloat(prompt.temperature),
      max_tokens: prompt.max_tokens,
      top_p: parseFloat(prompt.top_p),
      frequency_penalty: parseFloat(prompt.frequency_penalty),
      presence_penalty: parseFloat(prompt.presence_penalty)
    };

    // Make OpenAI API call
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`
      },
      body: JSON.stringify(openaiRequest)
    });

    const openaiResponseData = await openaiResponse.json();

    // Send to destination webhook
    let webhookResponseStatus: number | null = null;
    let webhookResponseBody: string | null = null;
    let executionStatus: 'success' | 'failed' = 'success';
    let errorMessage: string | null = null;

    try {
      const webhookResponse = await fetch(prompt.destination_webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt_id: input.prompt_id,
          rendered_prompt: renderedPrompt,
          openai_response: openaiResponseData,
          template_data: input.template_data
        })
      });

      webhookResponseStatus = webhookResponse.status;
      webhookResponseBody = await webhookResponse.text();

      if (!webhookResponse.ok) {
        executionStatus = 'failed';
        errorMessage = `Webhook failed with status ${webhookResponse.status}`;
      }
    } catch (webhookError) {
      executionStatus = 'failed';
      errorMessage = `Webhook error: ${webhookError instanceof Error ? webhookError.message : 'Unknown error'}`;
    }

    // Record execution history
    const historyResult = await db.insert(executionHistoryTable)
      .values({
        prompt_id: input.prompt_id,
        trigger_type: 'cron',
        input_data: input.template_data || null,
        rendered_prompt: renderedPrompt,
        openai_response: openaiResponseData,
        webhook_response_status: webhookResponseStatus,
        webhook_response_body: webhookResponseBody,
        execution_status: executionStatus,
        error_message: errorMessage
      })
      .returning()
      .execute();

    const result = historyResult[0];
    
    // Convert the result to match ExecutionHistory type
    return {
      id: result.id,
      prompt_id: result.prompt_id,
      trigger_type: result.trigger_type,
      input_data: result.input_data as Record<string, any> | null,
      rendered_prompt: result.rendered_prompt,
      openai_response: result.openai_response as Record<string, any>,
      webhook_response_status: result.webhook_response_status,
      webhook_response_body: result.webhook_response_body,
      execution_status: result.execution_status,
      error_message: result.error_message,
      created_at: result.created_at
    };
  } catch (error) {
    console.error('Prompt execution failed:', error);
    throw error;
  }
};
