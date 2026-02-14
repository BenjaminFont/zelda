import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../../src/core/init/init-project.js';

describe('init/init-project', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-init-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates zelda.yaml with default config', () => {
    const result = initProject(tempDir);

    expect(result.configCreated).toBe(true);
    const configPath = join(tempDir, 'zelda.yaml');
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('judgeModel');
    expect(content).toContain('gatewayUrl');
    expect(content).toContain('resultsDir');
    expect(content).toContain('testDir');
  });

  it('creates zelda/ directory', () => {
    const result = initProject(tempDir);

    expect(result.testDirCreated).toBe(true);
    expect(existsSync(join(tempDir, 'zelda'))).toBe(true);
  });

  it('creates example test suite with realistic content', () => {
    const result = initProject(tempDir);

    expect(result.exampleSuiteCreated).toBe(true);
    const suitePath = join(tempDir, 'zelda', 'test-example.yaml');
    expect(existsSync(suitePath)).toBe(true);

    const content = readFileSync(suitePath, 'utf-8');
    expect(content).toContain('prompt');
    expect(content).toContain('acceptanceCriteria');
    // Should have a realistic example with multiple criteria
    const criteriaMatches = content.match(/^\s+-\s/gm);
    expect(criteriaMatches).toBeDefined();
    expect(criteriaMatches!.length).toBeGreaterThanOrEqual(3);
  });

  it('creates .gitignore with .zelda/ entry when no .gitignore exists', () => {
    const result = initProject(tempDir);

    expect(result.gitignoreUpdated).toBe(true);
    const gitignorePath = join(tempDir, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    const content = readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.zelda/');
  });

  it('appends .zelda/ to existing .gitignore', () => {
    writeFileSync(join(tempDir, '.gitignore'), 'node_modules/\n', 'utf-8');

    const result = initProject(tempDir);

    expect(result.gitignoreUpdated).toBe(true);
    const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.zelda/');
  });

  it('does not duplicate .zelda/ in .gitignore', () => {
    writeFileSync(join(tempDir, '.gitignore'), 'node_modules/\n.zelda/\n', 'utf-8');

    const result = initProject(tempDir);

    expect(result.gitignoreUpdated).toBe(false);
    const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
    const matches = content.match(/\.zelda\//g);
    expect(matches).toHaveLength(1);
  });

  it('warns when config exists and overwrite is false', () => {
    writeFileSync(join(tempDir, 'zelda.yaml'), 'existing: true\n', 'utf-8');

    const result = initProject(tempDir);

    expect(result.configCreated).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('already exists');
  });

  it('overwrites config when overwrite is true', () => {
    writeFileSync(join(tempDir, 'zelda.yaml'), 'existing: true\n', 'utf-8');

    const result = initProject(tempDir, true);

    expect(result.configCreated).toBe(true);
    expect(result.warnings).toHaveLength(0);
    const content = readFileSync(join(tempDir, 'zelda.yaml'), 'utf-8');
    expect(content).toContain('judgeModel');
  });

  it('config includes commented explanations', () => {
    initProject(tempDir);

    const content = readFileSync(join(tempDir, 'zelda.yaml'), 'utf-8');
    // Comments start with #
    const commentLines = content.split('\n').filter((l) => l.trim().startsWith('#'));
    expect(commentLines.length).toBeGreaterThanOrEqual(3);
  });

  it('example suite demonstrates YAML structure clearly', () => {
    initProject(tempDir);

    const content = readFileSync(join(tempDir, 'zelda', 'test-example.yaml'), 'utf-8');
    // Should have comments explaining structure
    expect(content).toContain('#');
    // Should have the main required fields
    expect(content).toContain('prompt:');
    expect(content).toContain('acceptanceCriteria:');
  });
});
