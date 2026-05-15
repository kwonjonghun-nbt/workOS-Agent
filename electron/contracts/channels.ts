export const CHANNELS = {
  terminal: {
    create: 'terminal:create',
    write: 'terminal:write',
    resize: 'terminal:resize',
    dispose: 'terminal:dispose',
  },
  terminalEvents: {
    data: 'terminal:data',
    exit: 'terminal:exit',
  },
} as const;
