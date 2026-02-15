// Requirement fulfillment evaluator — LLM-as-judge per-criterion PASS/FAIL
// Sends acceptance criteria + transcript to judge, parses structured response

import { judgeQuery } from '../judge/judge-client.js';
import { chunkTranscript, needsChunking } from '../transcript/chunker.js';
import { synthesizeFulfillment } from '../transcript/synthesizer.js';
import type { Evaluator, EvalContext, EvalResult, TranscriptMessage } from '../types.js';

export type CriterionResult = {
  criterion: string;
  passed: boolean;
  reasoning: string;
};

export type FulfillmentDetails = {
  criteria: CriterionResult[];
  passedCount: number;
  totalCount: number;
};

const buildSystemPrompt = (): string => `You are an expert code evaluator. You will be given a transcript of an AI coding session and a list of acceptance criteria. For each criterion, determine whether it was fulfilled based on the code and actions in the transcript.

Respond with a JSON array where each element has:
- "criterion": the acceptance criterion text (exact match)
- "passed": true or false
- "reasoning": a brief explanation of why it passed or failed

Respond ONLY with the JSON array, no additional text or markdown formatting.`;

const formatMessages = (messages: TranscriptMessage[]): string =>
  messages
    .map((m) => {
      let text = `[${m.role}]: ${m.content}`;
      if (m.toolCalls && m.toolCalls.length > 0) {
        const tools = m.toolCalls.map((tc) => `  - ${tc.toolName}(${JSON.stringify(tc.input).slice(0, 200)})`).join('\n');
        text += `\nTool calls:\n${tools}`;
      }
      return text;
    })
    .join('\n\n');

const buildUserPrompt = (
  context: EvalContext,
  messages?: TranscriptMessage[],
): string => {
  const transcriptSummary = formatMessages(messages ?? context.transcript.messages);

  const criteriaList = context.config.acceptanceCriteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `## Session Transcript

${transcriptSummary}

## Acceptance Criteria

${criteriaList}

Evaluate each criterion and respond with the JSON array.`;
};

const parseJudgeResponse = (
  content: string,
  criteria: string[],
): CriterionResult[] => {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // If JSON parse fails, return all criteria as failed with parse error
    return criteria.map((c) => ({
      criterion: c,
      passed: false,
      reasoning: 'Judge response could not be parsed as JSON.',
    }));
  }

  if (!Array.isArray(parsed)) {
    return criteria.map((c) => ({
      criterion: c,
      passed: false,
      reasoning: 'Judge response was not a JSON array.',
    }));
  }

  // Map parsed results back to criteria
  return criteria.map((criterion) => {
    const match = (parsed as any[]).find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        (item.criterion === criterion ||
          // Fuzzy match: compare normalized strings
          String(item.criterion).toLowerCase().trim() === criterion.toLowerCase().trim()),
    );

    if (match) {
      return {
        criterion,
        passed: Boolean(match.passed),
        reasoning: String(match.reasoning ?? 'No reasoning provided.'),
      };
    }

    // If judge didn't return this criterion, treat as failed
    return {
      criterion,
      passed: false,
      reasoning: 'Criterion was not evaluated by the judge.',
    };
  });
};

const evaluateChunk = async (
  context: EvalContext,
  messages: TranscriptMessage[],
): Promise<FulfillmentDetails> => {
  const { config } = context;

  const response = await judgeQuery(
    {
      gatewayUrl: config.gatewayUrl,
      maxRetries: 3,
    },
    {
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(context, messages),
      model: config.judgeModel,
    },
  );

  const criteriaResults = parseJudgeResponse(
    response.content,
    config.acceptanceCriteria,
  );

  const passedCount = criteriaResults.filter((c) => c.passed).length;

  return {
    criteria: criteriaResults,
    passedCount,
    totalCount: criteriaResults.length,
  };
};

export const fulfillmentEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { transcript } = context;

  let details: FulfillmentDetails;

  if (needsChunking(transcript.messages)) {
    const chunks = chunkTranscript(transcript.messages);
    const chunkResults: FulfillmentDetails[] = [];
    for (const chunk of chunks) {
      chunkResults.push(await evaluateChunk(context, chunk.messages));
    }
    details = synthesizeFulfillment(chunkResults);
  } else {
    details = await evaluateChunk(context, transcript.messages);
  }

  const { passedCount, totalCount, criteria } = details;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 1000) / 10 : 0;

  const passedList = criteria
    .map((c) => `${c.passed ? 'PASS' : 'FAIL'}: ${c.criterion}`)
    .join('; ');

  return {
    metric: 'requirementFulfillment',
    score,
    details,
    reasoning: `${passedCount}/${totalCount} criteria passed. ${passedList}`,
  };
};

// Export for testing
export { buildSystemPrompt, buildUserPrompt, parseJudgeResponse };
