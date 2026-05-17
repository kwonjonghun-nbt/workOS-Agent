export type TerminalSize = {
  cols: number;
  rows: number;
};

export class TerminalSession {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly shell: string,
    public readonly cwd: string,
    public size: TerminalSize,
    public readonly createdAt: number,
    public name: string,
  ) {}

  resize(size: TerminalSize): void {
    this.size = size;
  }

  rename(name: string): void {
    this.name = name;
  }
}

export function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'cmd.exe';
  }
  return process.env.SHELL ?? '/bin/bash';
}
