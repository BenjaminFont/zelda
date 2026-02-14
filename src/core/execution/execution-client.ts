// Execution client — thin wrapper around Claude Agent SDK
// No SDK types leak beyond this module boundary

import { query } from '@anthropic-ai/claude-agent-sdk';
import { ExecutionError } from '../errors.js';
import type {
  SessionTranscript,
  TranscriptMessage,
  ToolCall,
  SessionMetadata,
} from '../types.js';

export type ExecutionParams = {
  prompt: string;
  workspacePath: string;
  model?: string;
  maxTurns?: number;
};

export type ExecutionResult = {
  transcript: SessionTranscript;
};

export const executeSession = async (
  params: ExecutionParams,
): Promise<ExecutionResult> => {
  const { prompt, workspacePath, model, maxTurns } = params;

  const startTime = Date.now();
  const messages: TranscriptMessage[] = [];
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let turnCount = 0;
  let durationMs = 0;
  let errorCount = 0;

  try {
    const session = query({
      prompt,
      options: {
        cwd: workspacePath,
        model,
        maxTurns,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
      },
    });

    for await (const message of session) {
      if (message.type === 'assistant') {
        const contentBlocks = message.message?.content ?? [];
        let textContent = '';
        const toolCalls: ToolCall[] = [];

        for (const block of contentBlocks) {
          if ('type' in block && block.type === 'text' && 'text' in block) {
            textContent += block.text;
          }
          if ('type' in block && block.type === 'tool_use' && 'name' in block) {
            toolCalls.push({
              toolName: block.name as string,
              input: 'input' in block ? block.input : undefined,
            });
          }
        }

        const msg: TranscriptMessage = {
          role: 'assistant',
          content: textContent,
        };
        if (toolCalls.length > 0) {
          msg.toolCalls = toolCalls;
        }
        messages.push(msg);
      }

      if (message.type === 'result') {
        costUsd = message.total_cost_usd;
        inputTokens = message.usage.input_tokens;
        outputTokens = message.usage.output_tokens;
        turnCount = message.num_turns;
        durationMs = message.duration_ms;

        if (message.subtype !== 'success') {
          errorCount += 1;
        }
      }
    }
  } catch (e) {
    throw new ExecutionError(
      `Claude Code session failed: ${e instanceof Error ? e.message : String(e)}`,
      'EXECUTION_SESSION_FAILED',
      'Claude Code session encountered an error. Check your ANTHROPIC_API_KEY and network connection.',
    );
  }

  if (durationMs === 0) {
    durationMs = Date.now() - startTime;
  }

  const metadata: SessionMetadata = {
    costUsd,
    inputTokens,
    outputTokens,
    turnCount,
    durationMs,
    errorCount,
  };

  return {
    transcript: { messages, metadata },
  };
};
