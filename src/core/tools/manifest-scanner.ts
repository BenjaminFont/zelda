// Manifest scanner — discovers available tools from .claude/ directory

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ToolsManifest, ToolEntry } from '../types.js';

const CLAUDE_DIR = '.claude';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export const parseFrontmatter = (
  content: string,
): { paths?: string[]; body: string } => {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { body: content };

  try {
    const parsed = parseYaml(match[1]);
    const body = content.slice(match[0].length).trimStart();
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.paths)) {
      const filtered = parsed.paths.filter((p: unknown) => typeof p === 'string');
      return { paths: filtered.length > 0 ? filtered : undefined, body };
    }
    return { body };
  } catch {
    // Malformed frontmatter — treat as no frontmatter
    return { body: content };
  }
};

const extractSummary = (content: string): string | undefined => {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0);
  if (firstLine) {
    return firstLine.replace(/^#+\s*/, '').trim().slice(0, 200);
  }
  return undefined;
};

type ContentParser = (content: string) => {
  contentSummary?: string;
  pathPatterns?: string[];
};

const defaultParser: ContentParser = (content) => ({
  contentSummary: extractSummary(content),
});

const ruleParser: ContentParser = (content) => {
  const { paths, body } = parseFrontmatter(content);
  return {
    contentSummary: extractSummary(body),
    pathPatterns: paths,
  };
};

const scanDirectory = (
  dirPath: string,
  filePattern: RegExp,
  parser: ContentParser = defaultParser,
): ToolEntry[] => {
  if (!existsSync(dirPath)) return [];

  const entries: ToolEntry[] = [];
  try {
    const files = readdirSync(dirPath);
    for (const file of files) {
      if (!filePattern.test(file)) continue;
      const fullPath = join(dirPath, file);
      const name = basename(file, '.md');

      let contentSummary: string | undefined;
      let pathPatterns: string[] | undefined;
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const parsed = parser(content);
        contentSummary = parsed.contentSummary;
        pathPatterns = parsed.pathPatterns;
      } catch {
        // Skip files that can't be read
      }

      entries.push({ name, path: fullPath, contentSummary, pathPatterns });
    }
  } catch {
    // Directory exists but can't be read
  }

  return entries;
};

const scanMcpConfigs = (claudeDir: string): ToolEntry[] => {
  const entries: ToolEntry[] = [];

  // Check for MCP config files (.claude/mcp.json, .claude/mcp.yaml)
  for (const configFile of ['mcp.json', 'mcp.yaml', 'mcp.yml']) {
    const configPath = join(claudeDir, configFile);
    if (existsSync(configPath)) {
      entries.push({
        name: configFile,
        path: configPath,
        contentSummary: `MCP configuration file`,
      });
    }
  }

  return entries;
};

export const scanToolsManifest = (workspacePath: string): ToolsManifest => {
  const claudeDir = join(workspacePath, CLAUDE_DIR);

  if (!existsSync(claudeDir)) {
    return { skills: [], rules: [], subAgents: [], mcpConfigs: [] };
  }

  const skills = scanDirectory(join(claudeDir, 'commands'), /\.md$/);
  const rules = scanDirectory(join(claudeDir, 'rules'), /\.md$/, ruleParser);
  const subAgents = scanDirectory(join(claudeDir, 'agents'), /\.md$/);
  const mcpConfigs = scanMcpConfigs(claudeDir);

  return { skills, rules, subAgents, mcpConfigs };
};
