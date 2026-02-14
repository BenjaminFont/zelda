import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

const packageJson = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf-8'),
);

describe('CLI', () => {
  it('--version outputs the version from package.json', () => {
    const output = execSync('node dist/cli.js --version', {
      cwd: projectRoot,
      encoding: 'utf-8',
    }).trim();
    expect(output).toBe(packageJson.version);
  });

  it('--help outputs expected command names', () => {
    const output = execSync('node dist/cli.js --help', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    expect(output).toContain('zelda');
    expect(output).toContain('run');
    expect(output).toContain('init');
    expect(output).toContain('compare');
    expect(output).toContain('list');
  });
});
