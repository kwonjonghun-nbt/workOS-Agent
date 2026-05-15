export type TerminalSize = {
  cols: number;
  rows: number;
};

export class TerminalSession {
  constructor(
    public readonly id: string,
    public readonly shell: string,
    public size: TerminalSize,
  ) {}

  resize(size: TerminalSize): void {
    this.size = size;
  }
}

export function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'cmd.exe';
  }
  return process.env.SHELL ?? '/bin/bash';
}
