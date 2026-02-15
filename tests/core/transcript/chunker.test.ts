import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  chunkTranscript,
  needsChunking,
} from '../../../src/core/transcript/chunker.js';
import type { TranscriptMessage } from '../../../src/core/types.js';

const makeMessage = (content: string, role: 'user' | 'assistant' = 'assistant'): TranscriptMessage => ({
  role,
  content,
});

describe('transcript/chunker', () => {
  describe('estimateTokens', () => {
    it('estimates tokens as chars / 4', () => {
      expect(estimateTokens('a'.repeat(400))).toBe(100);
    });

    it('rounds up for non-divisible lengths', () => {
      expect(estimateTokens('abc')).toBe(1);
    });

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('chunkTranscript', () => {
    it('returns single chunk for small transcripts', () => {
      const messages = [makeMessage('Hello'), makeMessage('World')];
      const chunks = chunkTranscript(messages, 200_000);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].messages).toEqual(messages);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].totalChunks).toBe(1);
    });

    it('splits large transcripts into multiple chunks', () => {
      // With contextLimit=100, budget = 80 tokens = 320 chars
      // Each message has role (9 chars) + content
      const messages = [
        makeMessage('a'.repeat(200)),
        makeMessage('b'.repeat(200)),
        makeMessage('c'.repeat(200)),
      ];
      const chunks = chunkTranscript(messages, 100);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('never splits mid-turn — each chunk has complete messages', () => {
      const messages = [
        makeMessage('a'.repeat(200)),
        makeMessage('b'.repeat(200)),
        makeMessage('c'.repeat(200)),
      ];
      const chunks = chunkTranscript(messages, 100);
      const totalMessages = chunks.reduce((sum, c) => sum + c.messages.length, 0);
      expect(totalMessages).toBe(3);
    });

    it('sets correct chunkIndex and totalChunks', () => {
      const messages = [
        makeMessage('a'.repeat(200)),
        makeMessage('b'.repeat(200)),
        makeMessage('c'.repeat(200)),
      ];
      const chunks = chunkTranscript(messages, 100);
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
        expect(chunks[i].totalChunks).toBe(chunks.length);
      }
    });

    it('handles single large message that exceeds budget', () => {
      const messages = [makeMessage('x'.repeat(10000))];
      // With contextLimit=10, budget = 8 tokens = 32 chars
      // Single message exceeds budget but still goes in one chunk
      const chunks = chunkTranscript(messages, 10);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].messages).toHaveLength(1);
    });

    it('handles empty messages array', () => {
      const chunks = chunkTranscript([]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].messages).toEqual([]);
    });
  });

  describe('needsChunking', () => {
    it('returns false for small transcripts', () => {
      const messages = [makeMessage('Hello')];
      expect(needsChunking(messages, 200_000)).toBe(false);
    });

    it('returns true for large transcripts', () => {
      const messages = [makeMessage('x'.repeat(10000))];
      // contextLimit = 10, budget = 8 tokens = 32 chars
      expect(needsChunking(messages, 10)).toBe(true);
    });

    it('uses default context limit when not specified', () => {
      // Default is 200k tokens → 160k budget → 640k chars
      const smallMessages = [makeMessage('Hello')];
      expect(needsChunking(smallMessages)).toBe(false);
    });
  });
});
