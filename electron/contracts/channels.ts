export const CHANNELS = {
  workspace: {
    list: 'workspace:list',
    add: 'workspace:add',
    remove: 'workspace:remove',
    rename: 'workspace:rename',
    openDialog: 'workspace:openDialog',
    setActive: 'workspace:setActive',
  },
  workspaceEvents: {
    changed: 'workspace:changed',
  },
  terminal: {
    create: 'terminal:create',
    write: 'terminal:write',
    resize: 'terminal:resize',
    dispose: 'terminal:dispose',
    list: 'terminal:list',
  },
  terminalEvents: {
    data: 'terminal:data',
    exit: 'terminal:exit',
  },
} as const;
