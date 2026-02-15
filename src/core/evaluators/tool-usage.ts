// Tool usage evaluator — LLM-as-judge analysis of tool utilization effectiveness
// Identifies used tools, missed tools, and overall utilization score

import { judgeQuery } from '../judge/judge-client.js';
import type { Evaluator, EvalContext, EvalResult, ToolEntry } from '../types.js';

export type ToolUsageDetails = {
  usedTools: { name: string; count: number }[];
  missedTools: { name: string; reasoning: string }[];
  availableToolCount: number;
  assessment: string;
};

const buildSystemPrompt = (): string => `You are an expert at evaluating AI coding tool utilization. You will be given:
1. A manifest of available tools (skills, rules, sub-agents, MCP configs) configured for a coding environment
2. A transcript of an AI coding session

Analyze whether the AI effectively used the available tools. Identify tools that were used and tools that should have been used but weren't.

Respond with a JSON object containing:
- "usedTools": array of { "name": string, "count": number } for tools referenced or invoked in the session
- "missedTools": array of { "name": string, "reasoning": string } for available tools that should have been used
- "assessment": a brief overall assessment of tool utilization effectiveness

Respond ONLY with the JSON object, no additional text or markdown formatting.`;

const formatManifest = (context: EvalContext): string => {
  const { toolsManifest } = context;
  const sections: string[] = [];

  const formatEntries = (label: string, entries: ToolEntry[]): void => {
    if (entries.length === 0) return;
    sections.push(`### ${label}`);
    for (const entry of entries) {
      const summary = entry.contentSummary ? ` — ${entry.contentSummary}` : '';
      sections.push(`- ${entry.name}${summary}`);
    }
  };

  formatEntries('Skills (Commands)', toolsManifest.skills);
  formatEntries('Rules', toolsManifest.rules);
  formatEntries('Sub-Agents', toolsManifest.subAgents);
  formatEntries('MCP Configurations', toolsManifest.mcpConfigs);

  return sections.length > 0
    ? sections.join('\n')
    : 'No tools configured.';
};

const buildUserPrompt = (context: EvalContext): string => {
  const transcriptSummary = context.transcript.messages
    .map((m) => {
      let text = `[${m.role}]: ${m.content}`;
      if (m.toolCalls && m.toolCalls.length > 0) {
        const tools = m.toolCalls.map((tc) => `  - ${tc.toolName}(${JSON.stringify(tc.input).slice(0, 200)})`).join('\n');
        text += `\nTool calls:\n${tools}`;
      }
      return text;
    })
    .join('\n\n');

  return `## Available Tools Manifest

${formatManifest(context)}

## Session Transcript

${transcriptSummary}

Analyze tool utilization and respond with the JSON object.`;
};

const parseJudgeResponse = (content: string): {
  usedTools: { name: string; count: number }[];
  missedTools: { name: string; reasoning: string }[];
  assessment: string;
} => {
  let jsonStr = content.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        usedTools: Array.isArray(parsed.usedTools) ? parsed.usedTools : [],
        missedTools: Array.isArray(parsed.missedTools) ? parsed.missedTools : [],
        assessment: String(parsed.assessment ?? 'No assessment provided.'),
      };
    }
  } catch {
    // Parse failure
  }

  return {
    usedTools: [],
    missedTools: [],
    assessment: 'Judge response could not be parsed.',
  };
};

export const toolUsageEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { toolsManifest, config } = context;

  const totalTools = toolsManifest.skills.length
    + toolsManifest.rules.length
    + toolsManifest.subAgents.length
    + toolsManifest.mcpConfigs.length;

  // If no tools available, return a neutral result
  if (totalTools === 0) {
    return {
      metric: 'toolUsage',
      score: 100,
      details: {
        usedTools: [],
        missedTools: [],
        availableToolCount: 0,
        assessment: 'No custom tools configured. Tool usage analysis not applicable.',
      } satisfies ToolUsageDetails,
      reasoning: 'No custom tools configured — nothing to evaluate.',
    };
  }

  const response = await judgeQuery(
    {
      gatewayUrl: config.gatewayUrl,
      maxRetries: 3,
    },
    {
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(context),
      model: config.judgeModel,
    },
  );

  const parsed = parseJudgeResponse(response.content);

  // Compute score: penalize for missed tools
  const missedCount = parsed.missedTools.length;
  const score = missedCount === 0
    ? 100
    : Math.max(0, Math.round((1 - missedCount / totalTools) * 100));

  const details: ToolUsageDetails = {
    usedTools: parsed.usedTools,
    missedTools: parsed.missedTools,
    availableToolCount: totalTools,
    assessment: parsed.assessment,
  };

  return {
    metric: 'toolUsage',
    score,
    details,
    reasoning: `${parsed.usedTools.length} tools used, ${missedCount} missed out of ${totalTools} available. ${parsed.assessment}`,
  };
};

// Export for testing
export { buildSystemPrompt, buildUserPrompt, parseJudgeResponse, formatManifest };
