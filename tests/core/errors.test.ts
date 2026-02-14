import { describe, it, expect } from 'vitest';
import {
  ZeldaError,
  ConfigError,
  WorkspaceError,
  ExecutionError,
  JudgeError,
} from '../../src/core/errors.js';

describe('core/errors', () => {
  describe('ZeldaError', () => {
    it('has code and userMessage properties', () => {
      const error = new ZeldaError(
        'Internal: config failed',
        'CONFIG_LOAD_FAILED',
        'Failed to load configuration file',
      );
      expect(error.code).toBe('CONFIG_LOAD_FAILED');
      expect(error.userMessage).toBe('Failed to load configuration file');
      expect(error.message).toBe('Internal: config failed');
    });

    it('has correct name', () => {
      const error = new ZeldaError('test', 'TEST', 'test');
      expect(error.name).toBe('ZeldaError');
    });

    it('is an instance of Error', () => {
      const error = new ZeldaError('test', 'TEST', 'test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ZeldaError);
    });
  });

  describe('ConfigError', () => {
    it('extends ZeldaError', () => {
      const error = new ConfigError(
        'Invalid YAML',
        'CONFIG_VALIDATION_FAILED',
        'Configuration file has invalid format',
      );
      expect(error).toBeInstanceOf(ZeldaError);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error).toBeInstanceOf(Error);
    });

    it('has correct name', () => {
      const error = new ConfigError('test', 'TEST', 'test');
      expect(error.name).toBe('ConfigError');
    });

    it('preserves code and userMessage', () => {
      const error = new ConfigError(
        'Missing required field',
        'CONFIG_MISSING_FIELD',
        'Required field "judgeModel" is missing',
      );
      expect(error.code).toBe('CONFIG_MISSING_FIELD');
      expect(error.userMessage).toBe('Required field "judgeModel" is missing');
    });
  });

  describe('WorkspaceError', () => {
    it('extends ZeldaError with correct name', () => {
      const error = new WorkspaceError(
        'Worktree creation failed',
        'WORKSPACE_CREATE_FAILED',
        'Could not create isolated workspace',
      );
      expect(error).toBeInstanceOf(ZeldaError);
      expect(error).toBeInstanceOf(WorkspaceError);
      expect(error.name).toBe('WorkspaceError');
      expect(error.code).toBe('WORKSPACE_CREATE_FAILED');
    });
  });

  describe('ExecutionError', () => {
    it('extends ZeldaError with correct name', () => {
      const error = new ExecutionError(
        'SDK session failed',
        'EXECUTION_SESSION_FAILED',
        'Claude Code session encountered an error',
      );
      expect(error).toBeInstanceOf(ZeldaError);
      expect(error).toBeInstanceOf(ExecutionError);
      expect(error.name).toBe('ExecutionError');
      expect(error.code).toBe('EXECUTION_SESSION_FAILED');
    });
  });

  describe('JudgeError', () => {
    it('extends ZeldaError with correct name', () => {
      const error = new JudgeError(
        'Judge API timeout',
        'JUDGE_API_TIMEOUT',
        'LLM judge request timed out after retries',
      );
      expect(error).toBeInstanceOf(ZeldaError);
      expect(error).toBeInstanceOf(JudgeError);
      expect(error.name).toBe('JudgeError');
      expect(error.code).toBe('JUDGE_API_TIMEOUT');
    });
  });

  describe('Error hierarchy instanceof checks', () => {
    it('all subclasses are instanceof ZeldaError', () => {
      const errors = [
        new ConfigError('test', 'T', 'test'),
        new WorkspaceError('test', 'T', 'test'),
        new ExecutionError('test', 'T', 'test'),
        new JudgeError('test', 'T', 'test'),
      ];
      for (const error of errors) {
        expect(error).toBeInstanceOf(ZeldaError);
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('subclasses are not instances of each other', () => {
      const configError = new ConfigError('test', 'T', 'test');
      expect(configError).not.toBeInstanceOf(WorkspaceError);
      expect(configError).not.toBeInstanceOf(ExecutionError);
      expect(configError).not.toBeInstanceOf(JudgeError);
    });
  });
});
