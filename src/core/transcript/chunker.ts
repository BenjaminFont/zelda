// Transcript chunker — splits large transcripts at turn boundaries
// Uses character-count heuristic (chars / 4) for token estimation

import type { TranscriptMessage } from '../types.js';

// Default context limit for Claude models (200k tokens)
const DEFAULT_CONTEXT_LIMIT = 200_000;
// Use 80% of context limit as budget per chunk
const BUDGET_RATIO = 0.8;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

const messageSize = (message: TranscriptMessage): number => {
  let chars = message.role.length + message.content.length;
  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      chars += tc.toolName.length + JSON.stringify(tc.input).length;
      if (tc.output) chars += JSON.stringify(tc.output).length;
    }
  }
  return chars;
};

export type TranscriptChunk = {
  messages: TranscriptMessage[];
  chunkIndex: number;
  totalChunks: number;
};

export const chunkTranscript = (
  messages: TranscriptMessage[],
  contextLimit: number = DEFAULT_CONTEXT_LIMIT,
): TranscriptChunk[] => {
  const budgetTokens = Math.floor(contextLimit * BUDGET_RATIO);
  const budgetChars = budgetTokens * 4; // reverse heuristic

  // Check if all messages fit in one chunk
  const totalChars = messages.reduce((sum, m) => sum + messageSize(m), 0);

  if (totalChars <= budgetChars) {
    return [{ messages, chunkIndex: 0, totalChunks: 1 }];
  }

  // Split at turn boundaries
  const chunks: TranscriptMessage[][] = [];
  let currentChunk: TranscriptMessage[] = [];
  let currentChars = 0;

  for (const message of messages) {
    const size = messageSize(message);

    // If adding this message exceeds budget and chunk is not empty, start new chunk
    if (currentChars + size > budgetChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(message);
    currentChars += size;
  }

  // Push final chunk if non-empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const totalChunks = chunks.length;
  return chunks.map((msgs, i) => ({
    messages: msgs,
    chunkIndex: i,
    totalChunks,
  }));
};

export const needsChunking = (
  messages: TranscriptMessage[],
  contextLimit: number = DEFAULT_CONTEXT_LIMIT,
): boolean => {
  const budgetChars = Math.floor(contextLimit * BUDGET_RATIO) * 4;
  const totalChars = messages.reduce((sum, m) => sum + messageSize(m), 0);
  return totalChars > budgetChars;
};
