// Judge client — LLM-as-judge via Anthropic SDK with gateway routing
// No SDK types leak beyond this module — only Zelda-owned types are exposed

import Anthropic from '@anthropic-ai/sdk';
import { JudgeError } from '../errors.js';

export type JudgeRequest = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
};

export type JudgeResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
};

export type JudgeClientOptions = {
  gatewayUrl: string;
  apiKey?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const createClient = (options: JudgeClientOptions): Anthropic => {
  return new Anthropic({
    baseURL: options.gatewayUrl,
    apiKey: options.apiKey ?? process.env.PORTKEY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    maxRetries: 0, // We handle retries ourselves for better error reporting
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
};

const isTransientError = (error: unknown): boolean => {
  if (error instanceof Anthropic.APIError) {
    // Rate limits, server errors, timeouts
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused');
  }
  return false;
};

export const judgeQuery = async (
  options: JudgeClientOptions,
  request: JudgeRequest,
): Promise<JudgeResponse> => {
  const client = createClient(options);
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      });

      // Extract text content
      let content = '';
      for (const block of message.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }

      return {
        content,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    } catch (e) {
      lastError = e;

      if (attempt < maxRetries && isTransientError(e)) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      break;
    }
  }

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new JudgeError(
    `Judge API call failed after ${maxRetries + 1} attempts: ${errorMsg}`,
    'JUDGE_API_FAILED',
    `LLM judge evaluation failed: ${errorMsg}. Check your API key and gateway configuration.`,
  );
};
