import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanToolsManifest } from '../../../src/core/tools/manifest-scanner.js';

describe('tools/manifest-scanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-manifest-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty manifest when .claude/ does not exist', () => {
    const manifest = scanToolsManifest(tempDir);
    expect(manifest.skills).toHaveLength(0);
    expect(manifest.rules).toHaveLength(0);
    expect(manifest.subAgents).toHaveLength(0);
    expect(manifest.mcpConfigs).toHaveLength(0);
  });

  it('scans skills from .claude/commands/*.md', () => {
    const commandsDir = join(tempDir, '.claude', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, 'deploy.md'), '# Deploy\nDeploy the app to production', 'utf-8');
    writeFileSync(join(commandsDir, 'test.md'), '# Test\nRun the test suite', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.skills).toHaveLength(2);
    const names = manifest.skills.map((s) => s.name).sort();
    expect(names).toEqual(['deploy', 'test']);
  });

  it('scans rules from .claude/rules/*.md', () => {
    const rulesDir = join(tempDir, '.claude', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'no-console.md'), '# No Console\nDo not use console.log', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.rules).toHaveLength(1);
    expect(manifest.rules[0].name).toBe('no-console');
  });

  it('scans sub-agents from .claude/agents/*.md', () => {
    const agentsDir = join(tempDir, '.claude', 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'reviewer.md'), '# Code Reviewer\nReviews code changes', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.subAgents).toHaveLength(1);
    expect(manifest.subAgents[0].name).toBe('reviewer');
  });

  it('scans MCP configs from .claude/mcp.json', () => {
    const claudeDir = join(tempDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'mcp.json'), '{"servers": {}}', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.mcpConfigs).toHaveLength(1);
    expect(manifest.mcpConfigs[0].name).toBe('mcp.json');
  });

  it('extracts content summary from first line', () => {
    const commandsDir = join(tempDir, '.claude', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, 'deploy.md'), '# Deploy to Production\nDetailed instructions...', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.skills[0].contentSummary).toBe('Deploy to Production');
  });

  it('ignores non-.md files in skill/rule directories', () => {
    const commandsDir = join(tempDir, '.claude', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, 'deploy.md'), '# Deploy', 'utf-8');
    writeFileSync(join(commandsDir, 'readme.txt'), 'Not a skill', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.skills).toHaveLength(1);
  });

  it('includes path in tool entries', () => {
    const rulesDir = join(tempDir, '.claude', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'style.md'), '# Style Guide', 'utf-8');

    const manifest = scanToolsManifest(tempDir);
    expect(manifest.rules[0].path).toBe(join(rulesDir, 'style.md'));
  });
});
