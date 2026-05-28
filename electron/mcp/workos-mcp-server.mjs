#!/usr/bin/env node
/**
 * workOS-Agent — stdio MCP server.
 *
 * Spawned by the user's `claude` CLI via the workspace .mcp.json. Reads the
 * sidecar `<workspace>/.claude/workOS/.mcp-session.json` (written by the
 * Electron main process) to learn the local control-plane port + token, then
 * proxies every tool call to that HTTP endpoint.
 *
 * Discovery order for the sidecar:
 *   1. process.env.WORKOS_SESSION_FILE (explicit override)
 *   2. ascend from process.cwd() until `.claude/workOS/.mcp-session.json` is found.
 *
 * Tool list MUST stay in sync with electron/contracts/mcp.ts (MCP_TOOLS).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ---------- session discovery ------------------------------------------------

async function loadSession() {
  const explicit = process.env.WORKOS_SESSION_FILE;
  const candidates = explicit ? [explicit] : ascend(process.cwd());
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.port === 'number' &&
        typeof parsed.token === 'string' &&
        typeof parsed.workspaceId === 'string'
      ) {
        return { ...parsed, sessionFile: p };
      }
    } catch {
      // continue
    }
  }
  throw new Error(
    'workOS-Agent MCP: .mcp-session.json not found. ' +
      'Open the workspace in workOS-Agent and run MCP Setup.',
  );
}

function ascend(start) {
  const out = [];
  let cur = path.resolve(start);
  while (true) {
    out.push(path.join(cur, '.claude', 'workOS', '.mcp-session.json'));
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return out;
}

// ---------- HTTP client ------------------------------------------------------

async function call(session, route, body) {
  const url = `http://127.0.0.1:${session.port}${route}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.token}`,
      'x-workos-workspace': session.workspaceId,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`control plane non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || parsed.ok === false || parsed.error) {
    throw new Error(parsed.message || parsed.error || `HTTP ${res.status}`);
  }
  return parsed.data ?? null;
}

// ---------- tool schemas -----------------------------------------------------

const TOOLS = [
  {
    name: 'workos_taskitem_get',
    description:
      'Get the metadata of a TaskItem (name, description, prompt, agentName, status). Use at start of execution to confirm what you are doing.',
    inputSchema: {
      type: 'object',
      properties: { taskItemId: { type: 'string' } },
      required: ['taskItemId'],
    },
    route: '/v1/taskitem/get',
  },
  {
    name: 'workos_taskitem_progress',
    description:
      'Report a short progress message for the running TaskItem. Pushes a live update to the workOS UI.',
    inputSchema: {
      type: 'object',
      properties: {
        taskItemId: { type: 'string' },
        message: { type: 'string', description: 'one short line, human-readable' },
      },
      required: ['taskItemId', 'message'],
    },
    route: '/v1/taskitem/progress',
  },
  {
    name: 'workos_taskitem_complete',
    description:
      'Mark the TaskItem as completed. Optionally include a short output summary or artifact path.',
    inputSchema: {
      type: 'object',
      properties: {
        taskItemId: { type: 'string' },
        output: { type: 'string', description: 'short summary of what was done' },
        artifactPath: { type: 'string', description: 'optional path to a larger artifact' },
      },
      required: ['taskItemId'],
    },
    route: '/v1/taskitem/complete',
  },
  {
    name: 'workos_taskitem_run_next',
    description:
      'Pick the next pending TaskItem in the same Task (oldest createdAt first) and start it in a fresh terminal session. Call this AFTER workos_taskitem_complete to chain execution. Returns { nextTaskItemId, sessionId } or { nextTaskItemId: null } when no pending items remain.',
    inputSchema: {
      type: 'object',
      properties: {
        taskItemId: {
          type: 'string',
          description: 'The TaskItem you just finished — used to locate siblings in the same Task.',
        },
      },
      required: ['taskItemId'],
    },
    route: '/v1/taskitem/run-next',
  },
  {
    name: 'workos_taskitem_add',
    description:
      'Append new TaskItem(s) to the same Task as the running TaskItem. Use this when the execution result of the current TaskItem is "more TaskItems need to be created" (e.g. analysis discovers N sub-tasks). The new items are appended to the parent Task and will be picked up by workos_taskitem_run_next after completion. If stepId is omitted, the current TaskItem\'s stepId is reused.',
    inputSchema: {
      type: 'object',
      properties: {
        taskItemId: {
          type: 'string',
          description: 'The currently running TaskItem — used to locate the parent Task.',
        },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              stepId: {
                type: 'string',
                description:
                  'Optional. Step id this TaskItem belongs to. Must be a step of the parent workflow. Falls back to the current TaskItem stepId when omitted.',
              },
              name: { type: 'string' },
              description: { type: 'string' },
              agentName: { type: 'string' },
              prompt: {
                type: 'string',
                description: 'Prompt body that the new TaskItem will execute.',
              },
            },
            required: ['name', 'agentName'],
          },
        },
      },
      required: ['taskItemId', 'items'],
    },
    route: '/v1/taskitem/add',
  },
  {
    name: 'workos_taskitem_fail',
    description: 'Mark the TaskItem as failed with an error message.',
    inputSchema: {
      type: 'object',
      properties: {
        taskItemId: { type: 'string' },
        error: { type: 'string' },
      },
      required: ['taskItemId', 'error'],
    },
    route: '/v1/taskitem/fail',
  },
  {
    name: 'workos_task_context_get',
    description:
      'Fetch the parent Task + Workflow and sibling TaskItem summaries for a given TaskItem.',
    inputSchema: {
      type: 'object',
      properties: { taskItemId: { type: 'string' } },
      required: ['taskItemId'],
    },
    route: '/v1/task/context',
  },
  {
    name: 'workos_decomposition_submit',
    description:
      'Submit the decomposition result for a Task. Replaces existing TaskItems with the provided list.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              agentName: { type: 'string' },
              prompt: { type: 'string' },
            },
            required: ['stepId', 'name', 'agentName', 'prompt'],
          },
        },
      },
      required: ['taskId', 'items'],
    },
    route: '/v1/decomposition/submit',
  },
  {
    name: 'workos_workflow_draft_submit',
    description: 'Submit a generated Workflow draft (creates a Workflow + Steps).',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'matches the draftId passed in the prompt' },
        name: { type: 'string' },
        description: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              agentName: { type: 'string' },
            },
            required: ['name', 'agentName'],
          },
        },
      },
      required: ['draftId', 'name', 'steps'],
    },
    route: '/v1/workflow-draft/submit',
  },
  {
    name: 'workos_catalog_list',
    description: 'List agents/skills available in the workspace (.claude/agents + .claude/skills).',
    inputSchema: { type: 'object', properties: {} },
    route: '/v1/catalog/list',
  },
  {
    name: 'workos_notify',
    description: 'Push a toast notification to the workOS UI.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['info', 'warn', 'error'] },
        message: { type: 'string' },
      },
      required: ['level', 'message'],
    },
    route: '/v1/notify',
  },
  {
    name: 'workos_extension_llm_result',
    description:
      'Submit the final result (or error) of an extension-issued AI task back to workOS-Agent. The prompt file the user told you to read contains a "requestId" — pass it exactly. On success, pass the full output in `content`. On failure, pass a human-readable reason in `error`. Call this exactly ONCE per requestId, after you have produced the complete result.',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: {
          type: 'string',
          description: 'The requestId given to you inside the prompt file. Required.',
        },
        content: {
          type: 'string',
          description:
            'The full result as a single string. For markdown reports, the entire markdown body. For JSON outputs, the JSON encoded as a string. Required when not erroring.',
        },
        error: {
          type: 'string',
          description:
            'Human-readable failure reason. Provide when the task cannot be completed; omit `content` in that case.',
        },
      },
      required: ['requestId'],
    },
    route: '/v1/extension/llm-result',
  },
  {
    name: 'workos_jira_create_issue',
    description:
      'Create a new Jira issue via the Jira extension. Use for creating a parent ticket (Epic/Story) for a workflow Task, or for creating child tickets under a parent. If attachToTaskId is omitted, the currently running TaskItem\'s parent Task is used automatically (when in jira mode with childMode !== "all"); the response includes autoAttachedToTaskId if this happened.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        issueType: {
          type: 'string',
          description: 'e.g. "Epic", "Story", "Task", "Sub-task"',
        },
        parentKey: {
          type: 'string',
          description:
            'Optional parent issue key (Epic key for Story, Story key for Sub-task)',
        },
        description: { type: 'string' },
        projectKey: {
          type: 'string',
          description: 'Optional. Defaults to first configured project key.',
        },
        attachToTaskId: {
          type: 'string',
          description:
            'Optional workOS Task id. If provided, the created issue key is appended to that Task.jiraExplicitChildKeys. If omitted, the currently running TaskItem\'s parent Task is used automatically when applicable.',
        },
      },
      required: ['summary', 'issueType'],
    },
    route: '/v1/jira/create-issue',
  },
  {
    name: 'workos_jira_get_issue',
    description:
      'Get a Jira issue summary (key, summary, status, issueType, parentKey).',
    inputSchema: {
      type: 'object',
      properties: { issueKey: { type: 'string' } },
      required: ['issueKey'],
    },
    route: '/v1/jira/get-issue',
  },
  {
    name: 'workos_jira_list_children',
    description:
      'List child issues under a parent (Epic → Stories/Tasks; Story/Task → Sub-tasks).',
    inputSchema: {
      type: 'object',
      properties: { parentKey: { type: 'string' } },
      required: ['parentKey'],
    },
    route: '/v1/jira/list-children',
  },
  {
    name: 'workos_jira_transition_issue',
    description:
      'Transition a Jira issue to a new status by transition name (e.g. "In Progress", "Done").',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string' },
        transitionName: { type: 'string' },
      },
      required: ['issueKey', 'transitionName'],
    },
    route: '/v1/jira/transition-issue',
  },
];

// ---------- server -----------------------------------------------------------

async function main() {
  const session = await loadSession();

  const server = new Server(
    { name: 'workos-agent', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }],
      };
    }
    try {
      const data = await call(session, tool.route, req.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `workOS tool error: ${err?.message ?? String(err)}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // stderr is captured by Claude CLI for diagnostics
  process.stderr.write(`workos-agent mcp fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
