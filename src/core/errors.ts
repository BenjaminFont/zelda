// ZeldaError hierarchy — all error classes for the Zelda framework

export class ZeldaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigError extends ZeldaError {
  constructor(message: string, code: string, userMessage: string) {
    super(message, code, userMessage);
  }
}

export class WorkspaceError extends ZeldaError {
  constructor(message: string, code: string, userMessage: string) {
    super(message, code, userMessage);
  }
}

export class ExecutionError extends ZeldaError {
  constructor(message: string, code: string, userMessage: string) {
    super(message, code, userMessage);
  }
}

export class JudgeError extends ZeldaError {
  constructor(message: string, code: string, userMessage: string) {
    super(message, code, userMessage);
  }
}
