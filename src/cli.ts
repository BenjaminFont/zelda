import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runPipeline } from './core/pipeline/run-pipeline.js';
import { initProject } from './core/init/init-project.js';
import { ZeldaError } from './core/errors.js';
import { listRuns, getRun } from './core/storage/result-store.js';
import { renderRunList } from './core/reporter/list-reporter.js';
import { loadProjectConfig } from './core/config/loader.js';

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

program
  .command('run [test-name]')
  .description('Run evaluation pipeline')
  .action(async (testName?: string) => {
    try {
      const result = await runPipeline({
        projectDir: process.cwd(),
        testName,
      });

      if (result.errors.length > 0) {
        for (const error of result.errors) {
          process.stderr.write(`Error: ${error}\n`);
        }
        process.exit(2);
      }

      if (result.runs.length === 0) {
        process.stderr.write('No test suites found. Run "zelda init" to set up your project.\n');
        process.exit(1);
      }
    } catch (e) {
      if (e instanceof ZeldaError) {
        process.stderr.write(`Error: ${e.userMessage}\n`);
      } else {
        process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
      }
      process.exit(2);
    }
  });

program
  .command('init')
  .description('Initialize Zelda in current project')
  .option('-f, --force', 'Overwrite existing config files')
  .action((opts: { force?: boolean }) => {
    const result = initProject(process.cwd(), opts.force);

    if (result.configCreated) {
      process.stdout.write('Created zelda.yaml\n');
    }
    if (result.testDirCreated) {
      process.stdout.write('Created zelda/ directory\n');
    }
    if (result.exampleSuiteCreated) {
      process.stdout.write('Created zelda/test-example.yaml\n');
    }
    if (result.gitignoreUpdated) {
      process.stdout.write('Updated .gitignore with .zelda/\n');
    }

    for (const warning of result.warnings) {
      process.stderr.write(`Warning: ${warning}\n`);
    }

    if (result.configCreated || result.exampleSuiteCreated) {
      process.stdout.write('\nRun "zelda run example" to try it out.\n');
    }
  });
program
  .command('list')
  .description('List past evaluation runs')
  .action(() => {
    try {
      const configPath = join(process.cwd(), 'zelda.yaml');
      const config = loadProjectConfig(configPath);
      const resultsDir = join(process.cwd(), config.resultsDir);
      const runs = listRuns(resultsDir);
      process.stdout.write(renderRunList(runs) + '\n');
    } catch (e) {
      if (e instanceof ZeldaError) {
        process.stderr.write(`Error: ${e.userMessage}\n`);
      } else {
        process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
      }
      process.exit(2);
    }
  });

program.command('compare <run1> <run2>').description('Compare two runs');

program.parse();
