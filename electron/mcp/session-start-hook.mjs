#!/usr/bin/env node
/**
 * workOS-Agent — Claude Code SessionStart hook.
 *
 * Installed into a user workspace's `.claude/settings.local.json` by the
 * Electron main process (McpService.setupAt) when the Session Gate is enabled.
 * On `startup` it long-polls workOS's local control plane; workOS opens a modal
 * asking the user to create / select / skip a Jira ticket. The chosen context
 * is returned and injected into the session via `additionalContext`.
 *
 * Fail-open: if the control plane is unreachable (workOS not running), the
 * session file is missing, or anything errors, the hook prints nothing and
 * exits 0 so the claude session starts normally and is never blocked.
 *
 * Per-launch control via the WORKOS_GATE environment variable (inherited from
 * the shell that launched `claude`):
 *   - mode `always` (default): gate runs UNLESS WORKOS_GATE is off/0/false/no/skip.
 *       e.g. `WORKOS_GATE=off claude` skips the gate for that launch.
 *   - mode `flag` (installed via --mode=flag): gate runs ONLY IF WORKOS_GATE is
 *       on/1/true/yes.  e.g. `WORKOS_GATE=on claude` opts a single launch in.
 * The mode is baked into the hook command as `--mode=<mode>` at install time.
 *
 * Reads the same sidecar as workos-mcp-server.mjs:
 *   `<workspace>/.claude/workOS/.mcp-session.json`  → { port, token, workspaceId }
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROUTE = '/v1/session/start';

const OFF_VALUES = new Set(['off', '0', 'false', 'no', 'skip']);
const ON_VALUES = new Set(['on', '1', 'true', 'yes']);

function gateEnabled() {
  const mode = parseMode(process.argv.slice(2));
  const raw = (process.env.WORKOS_GATE ?? '').trim().toLowerCase();
  if (mode === 'flag') {
    // opt-in: only run when explicitly turned on for this launch.
    return ON_VALUES.has(raw);
  }
  // 'always': run unless explicitly turned off for this launch.
  return !OFF_VALUES.has(raw);
}

function parseMode(argv) {
  for (const a of argv) {
    const m = /^--mode=(.+)$/.exec(a);
    if (m) return m[1] === 'flag' ? 'flag' : 'always';
  }
  return 'always';
}

async function main() {
  const input = await readStdin();
  let hook = {};
  try {
    hook = input.trim() ? JSON.parse(input) : {};
  } catch {
    hook = {};
  }

  // Only gate brand-new sessions. resume/clear/compact pass through untouched.
  const source = typeof hook.source === 'string' ? hook.source : 'startup';
  if (source !== 'startup') {
    process.exit(0);
  }

  // Per-launch env override / opt-in flag mode.
  if (!gateEnabled()) {
    process.exit(0);
  }

  const cwd = typeof hook.cwd === 'string' && hook.cwd ? hook.cwd : process.cwd();

  const session = await loadSession(cwd);
  if (!session) {
    // workOS not set up here — do not block.
    process.exit(0);
  }

  let data;
  try {
    data = await call(session, ROUTE, { cwd, source });
  } catch (err) {
    // Control plane down / timeout / any error → fail open.
    process.stderr.write(`workos session-gate: ${err?.message ?? String(err)}\n`);
    process.exit(0);
  }

  const additionalContext =
    data && typeof data.additionalContext === 'string' ? data.additionalContext : '';
  if (additionalContext.trim()) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext,
        },
      }),
    );
  }
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => {
      buf += c;
    });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

async function loadSession(startDir) {
  const explicit = process.env.WORKOS_SESSION_FILE;
  const candidates = explicit ? [explicit] : ascend(startDir);
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
        return parsed;
      }
    } catch {
      // continue
    }
  }
  return null;
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
    throw new Error(`control plane non-JSON response (${res.status})`);
  }
  if (!res.ok || parsed.ok === false || parsed.error) {
    throw new Error(parsed.message || parsed.error || `HTTP ${res.status}`);
  }
  return parsed.data ?? null;
}

main().catch((err) => {
  process.stderr.write(`workos session-gate fatal: ${err?.stack ?? err}\n`);
  process.exit(0);
});
