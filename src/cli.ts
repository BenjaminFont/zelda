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
import { compareRuns } from './core/compare/compare-runs.js';
import { renderComparison } from './core/reporter/compare-reporter.js';
import { sweepOrphanedWorkspaces, cleanSingleWorkspace } from './core/workspace/sweeper.js';
import { applyRunChanges } from './core/apply/apply-changes.js';

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

program
  .command('compare <run1> <run2>')
  .description('Compare two evaluation runs side-by-side')
  .action((run1: string, run2: string) => {
    try {
      const configPath = join(process.cwd(), 'zelda.yaml');
      const config = loadProjectConfig(configPath);
      const resultsDir = join(process.cwd(), config.resultsDir);

      const runA = getRun(resultsDir, run1);
      if (!runA) {
        process.stderr.write(`Error: Run "${run1}" not found.\n`);
        process.exit(1);
      }

      const runB = getRun(resultsDir, run2);
      if (!runB) {
        process.stderr.write(`Error: Run "${run2}" not found.\n`);
        process.exit(1);
      }

      const comparison = compareRuns(runA, runB);
      process.stdout.write(renderComparison(comparison) + '\n');
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
  .command('apply <run-id>')
  .description('Apply workspace changes from a run to your project')
  .option('-n, --dry-run', 'Show what would be applied without making changes')
  .action((runId: string, opts: { dryRun?: boolean }) => {
    try {
      const result = applyRunChanges(process.cwd(), runId, { dryRun: opts.dryRun });

      if (result.filesChanged === 0) {
        process.stdout.write('No changes to apply\n');
        return;
      }

      if (opts.dryRun) {
        process.stdout.write(`Would apply ${result.filesChanged} file(s):\n${result.summary}\n`);
      } else {
        process.stdout.write(`Applied ${result.filesChanged} file(s):\n${result.summary}\n`);
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
  .command('clean [run-id]')
  .description('Remove evaluation workspaces')
  .action((runId?: string) => {
    try {
      const projectDir = process.cwd();

      if (runId) {
        const removed = cleanSingleWorkspace(projectDir, runId);
        if (removed) {
          process.stdout.write(`Removed workspace for run: ${runId}\n`);
        } else {
          process.stderr.write(`Workspace not found for run: ${runId}\n`);
          process.exit(1);
        }
      } else {
        const removed = sweepOrphanedWorkspaces(projectDir);
        if (removed.length > 0) {
          process.stdout.write(`Removed ${removed.length} workspace(s)\n`);
        } else {
          process.stdout.write('No workspaces to clean\n');
        }
      }
    } catch (e) {
      process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(2);
    }
  });

program.parse();
