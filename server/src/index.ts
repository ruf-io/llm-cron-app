
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

import { 
  createPromptInputSchema, 
  updatePromptInputSchema, 
  executePromptInputSchema,
  webhookExecutionInputSchema
} from './schema';

import { createPrompt } from './handlers/create_prompt';
import { getPrompts } from './handlers/get_prompts';
import { getPrompt } from './handlers/get_prompt';
import { updatePrompt } from './handlers/update_prompt';
import { deletePrompt } from './handlers/delete_prompt';
import { executePrompt } from './handlers/execute_prompt';
import { webhookExecution } from './handlers/webhook_execution';
import { getExecutionHistory } from './handlers/get_execution_history';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Prompt management
  createPrompt: publicProcedure
    .input(createPromptInputSchema)
    .mutation(({ input }) => createPrompt(input)),

  getPrompts: publicProcedure
    .query(() => getPrompts()),

  getPrompt: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getPrompt(input.id)),

  updatePrompt: publicProcedure
    .input(updatePromptInputSchema)
    .mutation(({ input }) => updatePrompt(input)),

  deletePrompt: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePrompt(input.id)),

  // Prompt execution
  executePrompt: publicProcedure
    .input(executePromptInputSchema)
    .mutation(({ input }) => executePrompt(input)),

  webhookExecution: publicProcedure
    .input(webhookExecutionInputSchema)
    .mutation(({ input }) => webhookExecution(input)),

  // Execution history
  getExecutionHistory: publicProcedure
    .input(z.object({ promptId: z.number().optional() }))
    .query(({ input }) => getExecutionHistory(input.promptId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
