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
    rename: 'terminal:rename',
  },
  terminalEvents: {
    data: 'terminal:data',
    exit: 'terminal:exit',
  },
  workOS: {
    listSteps: 'workOS:listSteps',
    createStep: 'workOS:createStep',
    updateStep: 'workOS:updateStep',
    deleteStep: 'workOS:deleteStep',
    findDuplicateSteps: 'workOS:findDuplicateSteps',
    mergeDuplicateSteps: 'workOS:mergeDuplicateSteps',

    listWorkflows: 'workOS:listWorkflows',
    createWorkflow: 'workOS:createWorkflow',
    updateWorkflow: 'workOS:updateWorkflow',
    deleteWorkflow: 'workOS:deleteWorkflow',

    listTasks: 'workOS:listTasks',
    createTask: 'workOS:createTask',
    updateTask: 'workOS:updateTask',
    deleteTask: 'workOS:deleteTask',
    decomposeTask: 'workOS:decomposeTask',

    listTaskItems: 'workOS:listTaskItems',
    createTaskItem: 'workOS:createTaskItem',
    updateTaskItem: 'workOS:updateTaskItem',
    deleteTaskItem: 'workOS:deleteTaskItem',
    executeTaskItem: 'workOS:executeTaskItem',

    catalog: 'workOS:catalog',
    gitDiff: 'workOS:gitDiff',
    gitStatus: 'workOS:gitStatus',
    gitFileDiff: 'workOS:gitFileDiff',
    gitStagePaths: 'workOS:gitStagePaths',
    gitUnstagePaths: 'workOS:gitUnstagePaths',
    gitCommit: 'workOS:gitCommit',

    seedPreset: 'workOS:seedPreset',
    requestAiDecompose: 'workOS:requestAiDecompose',
    importDecomposition: 'workOS:importDecomposition',
    requestAiWorkflowGen: 'workOS:requestAiWorkflowGen',
    importWorkflowDraft: 'workOS:importWorkflowDraft',
  },
  workOSEvents: {
    changed: 'workOS:changed',
  },
  mcp: {
    status: 'mcp:status',
    setup: 'mcp:setup',
    listTools: 'mcp:listTools',
  },
  mcpEvents: {
    progress: 'mcp:progress',
    toast: 'mcp:toast',
  },
  preferences: {
    getSync: 'preferences:getSync',
    setTheme: 'preferences:setTheme',
  },
  updater: {
    getStatus: 'updater:getStatus',
    check: 'updater:check',
    quitAndInstall: 'updater:quitAndInstall',
  },
  updaterEvents: {
    status: 'updater:status',
  },
  extension: {
    list: 'extension:list',
    setEnabled: 'extension:setEnabled',
    updateSettings: 'extension:updateSettings',
  },
  extensionEvents: {
    changed: 'extension:changed',
  },
  jira: {
    listMyIssues: 'jira:listMyIssues',
    testConnection: 'jira:testConnection',
  },
  jiraSnapshot: {
    trigger: 'jiraSnapshot:trigger',
    getLatest: 'jiraSnapshot:getLatest',
    getMeta: 'jiraSnapshot:getMeta',
  },
  jiraSnapshotEvents: {
    progress: 'jiraSnapshot:progress',
  },
  jiraLabels: {
    getNotes: 'jiraLabels:getNotes',
    saveNotes: 'jiraLabels:saveNotes',
    searchByLabel: 'jiraLabels:searchByLabel',
    bulkReplace: 'jiraLabels:bulkReplace',
    updateIssueLabels: 'jiraLabels:updateIssueLabels',
    suggest: 'jiraLabels:suggest',
  },
  jiraReports: {
    list: 'jiraReports:list',
    get: 'jiraReports:get',
    save: 'jiraReports:save',
    delete: 'jiraReports:delete',
    generate: 'jiraReports:generate',
  },
} as const;
