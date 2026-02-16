// Tool usage evaluator — LLM-as-judge analysis of tool utilization effectiveness
// Distinguishes invocable tools (skills, sub-agents, MCP) from implicit rules

import picomatch from 'picomatch';
import { judgeQuery } from '../judge/judge-client.js';
import { chunkTranscript, needsChunking } from '../transcript/chunker.js';
import { synthesizeToolUsage } from '../transcript/synthesizer.js';
import type { Evaluator, EvalContext, EvalResult, ToolEntry, TranscriptMessage } from '../types.js';

export type RuleComplianceEntry = {
  name: string;
  compliant: boolean;
  reasoning: string;
};

export type ToolUsageDetails = {
  usedTools: { name: string; count: number }[];
  missedTools: { name: string; reasoning: string }[];
  ruleCompliance: RuleComplianceEntry[];
  availableToolCount: number;
  assessment: string;
};

// ─── Path extraction from transcript ────────────────────────────────────────

const FILE_TOOL_NAMES = new Set(['Read', 'Write', 'Edit', 'read', 'write', 'edit']);
const GLOB_TOOL_NAMES = new Set(['Glob', 'glob']);

const toRelative = (filePath: string, prefix: string): string =>
  filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;

export const extractTouchedFiles = (
  messages: TranscriptMessage[],
  workspacePath: string,
): string[] => {
  const files = new Set<string>();
  const prefix = workspacePath.endsWith('/') ? workspacePath : `${workspacePath}/`;

  for (const msg of messages) {
    if (!msg.toolCalls) continue;
    for (const tc of msg.toolCalls) {
      if (FILE_TOOL_NAMES.has(tc.toolName)) {
        const input = tc.input as Record<string, unknown> | undefined;
        const filePath = input?.file_path;
        if (typeof filePath === 'string') {
          files.add(toRelative(filePath, prefix));
        }
      } else if (GLOB_TOOL_NAMES.has(tc.toolName) && tc.output) {
        // Glob output may contain file paths as an array or string
        const output = tc.output;
        if (Array.isArray(output)) {
          for (const item of output) {
            if (typeof item === 'string') {
              files.add(toRelative(item, prefix));
            }
          }
        } else if (typeof output === 'string') {
          // Glob output as newline-separated paths
          for (const line of output.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) files.add(toRelative(trimmed, prefix));
          }
        }
      }
    }
  }
  return [...files];
};

// ─── Rule filtering by path patterns ────────────────────────────────────────

export const filterApplicableRules = (
  rules: ToolEntry[],
  touchedFiles: string[],
): ToolEntry[] => {
  if (rules.length === 0) return [];

  // Pre-compile matchers for all path-scoped rules
  const matchers = new Map<string, ReturnType<typeof picomatch>>();
  for (const rule of rules) {
    if (rule.pathPatterns && rule.pathPatterns.length > 0) {
      matchers.set(rule.name, picomatch(rule.pathPatterns));
    }
  }

  return rules.filter((rule) => {
    const matcher = matchers.get(rule.name);
    // Rules without pathPatterns always apply
    if (!matcher) return true;
    // Rules with pathPatterns only apply if any touched file matches
    return touchedFiles.some((file) => matcher(file));
  });
};

// ─── Prompt construction ────────────────────────────────────────────────────

const formatInvocableTools = (context: EvalContext): string => {
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
  formatEntries('Sub-Agents', toolsManifest.subAgents);
  formatEntries('MCP Configurations', toolsManifest.mcpConfigs);

  return sections.length > 0 ? sections.join('\n') : '';
};

const formatRules = (rules: ToolEntry[]): string => {
  if (rules.length === 0) return '';
  const lines = ['### Rules (evaluate by output compliance, NOT invocation)'];
  for (const rule of rules) {
    const summary = rule.contentSummary ? ` — ${rule.contentSummary}` : '';
    lines.push(`- ${rule.name}${summary}`);
  }
  return lines.join('\n');
};

const formatManifest = (context: EvalContext, applicableRules?: ToolEntry[]): string => {
  const invocable = formatInvocableTools(context);
  const rules = formatRules(applicableRules ?? context.toolsManifest.rules);

  if (!invocable && !rules) return 'No tools configured.';
  return [invocable, rules].filter(Boolean).join('\n\n');
};

const hasInvocableTools = (context: EvalContext): boolean =>
  context.toolsManifest.skills.length > 0
  || context.toolsManifest.subAgents.length > 0
  || context.toolsManifest.mcpConfigs.length > 0;

const buildSystemPrompt = (hasInvocable: boolean, hasRules: boolean): string => {
  const parts: string[] = [
    'You are an expert at evaluating AI coding tool utilization. You will be given:',
    '1. A manifest of available tools configured for a coding environment',
    '2. A transcript of an AI coding session',
    '',
    'Respond with a JSON object containing the following fields:',
  ];

  if (hasInvocable) {
    parts.push(
      '',
      '**For invocable tools** (skills, sub-agents, MCP configs) — evaluate by checking if they were explicitly called/invoked in the transcript:',
      '- "usedTools": array of { "name": string, "count": number } for tools explicitly invoked in the session',
      '- "missedTools": array of { "name": string, "reasoning": string } for invocable tools that should have been used but were not called',
    );
  }

  if (hasRules) {
    parts.push(
      '',
      '**For rules** — these are implicit guidelines loaded into the AI\'s context, NOT tool calls. Evaluate whether the generated code/output COMPLIES with each rule\'s guidance:',
      '- "ruleCompliance": array of { "name": string, "compliant": boolean, "reasoning": string } for each rule',
      '  - A rule is "compliant" if the code/output follows the rule\'s guidance',
      '  - A rule is NOT compliant only if the code clearly violates the rule\'s guidance',
    );
  }

  parts.push(
    '',
    '- "assessment": a brief overall assessment of tool utilization and rule compliance',
    '',
    'Respond ONLY with the JSON object, no additional text or markdown formatting.',
  );

  return parts.join('\n');
};

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
  applicableRules?: ToolEntry[],
): string => {
  const transcriptSummary = formatMessages(messages ?? context.transcript.messages);

  return `## Available Tools Manifest

${formatManifest(context, applicableRules)}

## Session Transcript

${transcriptSummary}

Analyze tool utilization and respond with the JSON object.`;
};

// ─── Response parsing ───────────────────────────────────────────────────────

const parseJudgeResponse = (content: string): {
  usedTools: { name: string; count: number }[];
  missedTools: { name: string; reasoning: string }[];
  ruleCompliance: RuleComplianceEntry[];
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
      const ruleCompliance = Array.isArray(parsed.ruleCompliance)
        ? parsed.ruleCompliance.filter(
          (r: unknown): r is RuleComplianceEntry =>
            typeof r === 'object' && r !== null
            && typeof (r as Record<string, unknown>).name === 'string'
            && typeof (r as Record<string, unknown>).compliant === 'boolean'
            && typeof (r as Record<string, unknown>).reasoning === 'string',
        )
        : [];

      return {
        usedTools: Array.isArray(parsed.usedTools) ? parsed.usedTools : [],
        missedTools: Array.isArray(parsed.missedTools) ? parsed.missedTools : [],
        ruleCompliance,
        assessment: String(parsed.assessment ?? 'No assessment provided.'),
      };
    }
  } catch {
    // Parse failure
  }

  return {
    usedTools: [],
    missedTools: [],
    ruleCompliance: [],
    assessment: 'Judge response could not be parsed.',
  };
};

// ─── Scoring ────────────────────────────────────────────────────────────────

const computeScore = (details: ToolUsageDetails, invocableCount: number, ruleCount: number): number => {
  const hasInvocable = invocableCount > 0;
  const hasRules = ruleCount > 0;

  if (!hasInvocable && !hasRules) return 100;

  const invocableScore = hasInvocable
    ? (details.missedTools.length === 0
      ? 100
      : Math.max(0, Math.round((1 - details.missedTools.length / invocableCount) * 100)))
    : 0;

  const ruleScore = hasRules
    ? Math.round((details.ruleCompliance.filter((r) => r.compliant).length / ruleCount) * 100)
    : 0;

  if (hasInvocable && hasRules) {
    return Math.round(invocableScore * 0.5 + ruleScore * 0.5);
  }
  return hasRules ? ruleScore : invocableScore;
};

// ─── Main evaluator ─────────────────────────────────────────────────────────

export const toolUsageEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { toolsManifest, config } = context;

  // Determine applicable rules by filtering path-scoped rules
  const touchedFiles = extractTouchedFiles(context.transcript.messages, context.workspacePath);
  const applicableRules = filterApplicableRules(toolsManifest.rules, touchedFiles);

  const invocableCount = toolsManifest.skills.length
    + toolsManifest.subAgents.length
    + toolsManifest.mcpConfigs.length;
  const ruleCount = applicableRules.length;
  const totalTools = invocableCount + ruleCount;

  // If no tools available, return a neutral result
  if (totalTools === 0) {
    return {
      metric: 'toolUsage',
      score: 100,
      details: {
        usedTools: [],
        missedTools: [],
        ruleCompliance: [],
        availableToolCount: 0,
        assessment: 'No custom tools configured. Tool usage analysis not applicable.',
      } satisfies ToolUsageDetails,
      reasoning: 'No custom tools configured — nothing to evaluate.',
    };
  }

  const invocable = hasInvocableTools(context);

  const evaluateChunk = async (messages: TranscriptMessage[]): Promise<ToolUsageDetails> => {
    const response = await judgeQuery(
      {
        gatewayUrl: config.gatewayUrl,
        maxRetries: 3,
      },
      {
        systemPrompt: buildSystemPrompt(invocable, ruleCount > 0),
        userPrompt: buildUserPrompt(context, messages, applicableRules),
        model: config.judgeModel,
      },
    );

    const parsed = parseJudgeResponse(response.content);
    return {
      usedTools: parsed.usedTools,
      missedTools: parsed.missedTools,
      ruleCompliance: parsed.ruleCompliance,
      availableToolCount: totalTools,
      assessment: parsed.assessment,
    };
  };

  let details: ToolUsageDetails;

  if (needsChunking(context.transcript.messages)) {
    const chunks = chunkTranscript(context.transcript.messages);
    const chunkResults: ToolUsageDetails[] = [];
    for (const chunk of chunks) {
      chunkResults.push(await evaluateChunk(chunk.messages));
    }
    details = synthesizeToolUsage(chunkResults);
  } else {
    details = await evaluateChunk(context.transcript.messages);
  }

  const score = computeScore(details, invocableCount, ruleCount);

  const parts: string[] = [];
  if (invocable) {
    parts.push(`${details.usedTools.length} tools used, ${details.missedTools.length} missed out of ${invocableCount} invocable`);
  }
  if (ruleCount > 0) {
    const compliant = details.ruleCompliance.filter((r) => r.compliant).length;
    parts.push(`${compliant}/${ruleCount} rules compliant`);
  }
  parts.push(details.assessment);

  return {
    metric: 'toolUsage',
    score,
    details,
    reasoning: `${parts.join('. ')}.`,
  };
};

// Export for testing
export { buildSystemPrompt, buildUserPrompt, parseJudgeResponse, formatManifest, computeScore };
