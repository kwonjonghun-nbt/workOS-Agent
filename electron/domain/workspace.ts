import type { WorkspaceKind } from '../contracts/workspace';

export class WorkspaceDomainError extends Error {
  constructor(
    public readonly code: 'INVALID_NAME' | 'INVALID_PATH' | 'INVALID_OPERATION',
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceDomainError';
  }
}

export class Workspace {
  constructor(
    public readonly id: string,
    public name: string,
    public readonly rootPath: string,
    public readonly createdAt: number,
    public lastOpenedAt: number,
    public readonly kind: WorkspaceKind = 'user',
  ) {
    if (!name.trim()) {
      throw new WorkspaceDomainError('INVALID_NAME', 'workspace name must be non-empty');
    }
    if (!rootPath.trim()) {
      throw new WorkspaceDomainError('INVALID_PATH', 'workspace rootPath must be non-empty');
    }
  }

  rename(name: string): void {
    if (this.kind === 'system') {
      throw new WorkspaceDomainError(
        'INVALID_OPERATION',
        'system workspace cannot be renamed',
      );
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new WorkspaceDomainError('INVALID_NAME', 'workspace name must be non-empty');
    }
    this.name = trimmed;
  }

  touch(now: number): void {
    this.lastOpenedAt = now;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      rootPath: this.rootPath,
      createdAt: this.createdAt,
      lastOpenedAt: this.lastOpenedAt,
      kind: this.kind,
    };
  }
}
