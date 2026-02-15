// Manifest scanner — discovers available tools from .claude/ directory

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ToolsManifest, ToolEntry } from '../types.js';

const CLAUDE_DIR = '.claude';

const scanDirectory = (
  dirPath: string,
  filePattern: RegExp,
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
      try {
        const content = readFileSync(fullPath, 'utf-8');
        // Extract first non-empty line as summary
        const firstLine = content.split('\n').find((l) => l.trim().length > 0);
        if (firstLine) {
          contentSummary = firstLine.replace(/^#+\s*/, '').trim().slice(0, 200);
        }
      } catch {
        // Skip files that can't be read
      }

      entries.push({ name, path: fullPath, contentSummary });
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
  const rules = scanDirectory(join(claudeDir, 'rules'), /\.md$/);
  const subAgents = scanDirectory(join(claudeDir, 'agents'), /\.md$/);
  const mcpConfigs = scanMcpConfigs(claudeDir);

  return { skills, rules, subAgents, mcpConfigs };
};
