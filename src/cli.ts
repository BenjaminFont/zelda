import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('zelda')
  .description('Evaluation framework for the Claude Code tooling ecosystem')
  .version(packageJson.version);

program.command('run [test-name]').description('Run evaluation pipeline');
program.command('init').description('Initialize Zelda in current project');
program.command('compare <run1> <run2>').description('Compare two runs');
program.command('list').description('List past runs');

program.parse();
