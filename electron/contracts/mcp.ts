import { z } from 'zod';

export const mcpServerStatusSchema = z.object({
  running: z.boolean(),
  port: z.number().int().nullable(),
  scriptPath: z.string(),
});
export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>;

export const mcpWorkspaceStatusSchema = z.object({
  workspaceId: z.string(),
  configPath: z.string(), // .mcp.json
  sessionPath: z.string(), // .claude/workOS/.mcp-session.json
  configured: z.boolean(),
  sessionFresh: z.boolean(),
});
export type McpWorkspaceStatus = z.infer<typeof mcpWorkspaceStatusSchema>;

export const setupMcpRequestSchema = z.object({
  workspaceId: z.string().min(1),
  force: z.boolean().default(false),
});
export type SetupMcpRequest = z.infer<typeof setupMcpRequestSchema>;

export const setupMcpResponseSchema = z.object({
  status: mcpWorkspaceStatusSchema,
  actions: z.array(z.string()), // human-readable: ["wrote .mcp.json", "rotated session token", ...]
});
export type SetupMcpResponse = z.infer<typeof setupMcpResponseSchema>;

export const mcpStatusRequestSchema = z.object({
  workspaceId: z.string().min(1),
});
export type McpStatusRequest = z.infer<typeof mcpStatusRequestSchema>;

export const mcpStatusResponseSchema = z.object({
  server: mcpServerStatusSchema,
  workspace: mcpWorkspaceStatusSchema,
});
export type McpStatusResponse = z.infer<typeof mcpStatusResponseSchema>;

// Internal: tool list — surfaced to UI so users can see what is exposed.
export const mcpToolDescriptorSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
});
export type McpToolDescriptor = z.infer<typeof mcpToolDescriptorSchema>;

export const MCP_TOOLS: McpToolDescriptor[] = [
  {
    name: 'workos_taskitem_get',
    title: 'TaskItem 조회',
    description: '실행 중인 TaskItem 의 메타데이터(이름/설명/agent/prompt 등)를 가져온다.',
  },
  {
    name: 'workos_taskitem_progress',
    title: '진행 상황 보고',
    description: '의미있는 단위로 진행 메시지를 한 줄 push 한다. UI 에 실시간 표시.',
  },
  {
    name: 'workos_taskitem_complete',
    title: '완료 처리',
    description: 'TaskItem 상태를 completed 로 전환하고 결과 요약을 저장한다.',
  },
  {
    name: 'workos_taskitem_run_next',
    title: '다음 TaskItem 실행',
    description:
      '같은 Task 의 pending TaskItem 중 createdAt 이 가장 빠른 항목을 새 터미널 세션에서 자동 실행한다. complete 직후 호출해 체이닝.',
  },
  {
    name: 'workos_taskitem_add',
    title: 'TaskItem 추가',
    description:
      '진행 중인 TaskItem 의 결과로 새 TaskItem 이 필요할 때 같은 Task 에 추가한다. complete 직후 run_next 가 자동 픽업.',
  },
  {
    name: 'workos_taskitem_fail',
    title: '실패 처리',
    description: 'TaskItem 상태를 failed 로 전환하고 에러 메시지를 저장한다.',
  },
  {
    name: 'workos_task_context_get',
    title: 'Task 컨텍스트',
    description: '소속 Task + Workflow + 형제 TaskItem 요약을 가져온다.',
  },
  {
    name: 'workos_decomposition_submit',
    title: '분해 결과 제출',
    description: '요구사항 자동 분해 결과(TaskItem 배열)를 직접 제출. 파일 작성 불필요.',
  },
  {
    name: 'workos_workflow_draft_submit',
    title: '워크플로 드래프트 제출',
    description: '자동 생성된 워크플로(Step 시퀀스)를 직접 제출.',
  },
  {
    name: 'workos_catalog_list',
    title: '에이전트/스킬 카탈로그',
    description: '워크스페이스에 등록된 .claude/agents/* 와 .claude/skills/* 를 조회.',
  },
  {
    name: 'workos_notify',
    title: 'UI 토스트',
    description: '워크OS UI 에 토스트 메시지를 띄운다 (info/warn/error).',
  },
  {
    name: 'workos_extension_llm_result',
    title: '확장 LLM 결과 제출',
    description:
      '확장 프로그램이 워크OS-Agent 에게 의뢰한 AI 작업의 최종 결과(또는 에러)를 제출한다. ' +
      'requestId 는 프롬프트 파일에 명시된 식별자. content 가 있으면 성공, error 가 있으면 실패.',
  },
  {
    name: 'workos_jira_create_issue',
    title: 'Jira 이슈 생성',
    description:
      'Jira 확장을 통해 새 이슈를 생성한다. 워크플로 Task 의 부모 티켓(Epic/Story) 또는 자식 티켓 생성에 사용. attachToTaskId 가 주어지면 생성된 이슈 키가 해당 workOS Task.jiraChildKeys 에 append 된다.',
  },
  {
    name: 'workos_jira_get_issue',
    title: 'Jira 이슈 조회',
    description: 'Jira 이슈의 key/summary/status/issueType/parentKey 를 가져온다.',
  },
  {
    name: 'workos_jira_list_children',
    title: 'Jira 자식 이슈 목록',
    description:
      '부모 이슈 아래의 자식 티켓들을 조회한다 (Epic → Story/Task, Story/Task → Sub-task).',
  },
  {
    name: 'workos_jira_transition_issue',
    title: 'Jira 상태 전환',
    description: 'transition 이름(예: "In Progress", "Done") 으로 Jira 이슈 상태를 전환한다.',
  },
];

// --------- Push events ---------------------------------------------------

export type TaskItemProgressEvent = {
  workspaceId: string;
  taskItemId: string;
  message: string;
  at: number;
};

export type McpToastEvent = {
  workspaceId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};
