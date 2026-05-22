import { z } from 'zod';

// Shared transport schemas for the Macro Buttons extension. Both main and
// renderer import these (renderer as type-only — no runtime crossing).

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const shellActionSchema = z.object({
  kind: z.literal('shell'),
  command: z.string().min(1, 'command 가 비어 있습니다'),
  continueOnError: z.boolean().optional(),
});

const httpActionSchema = z.object({
  kind: z.literal('http'),
  method: httpMethodSchema,
  url: z.string().url('유효한 URL이 아닙니다'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  continueOnError: z.boolean().optional(),
});

const delayActionSchema = z.object({
  kind: z.literal('delay'),
  ms: z.number().int().min(0).max(60_000),
});

const osOpenActionSchema = z.object({
  kind: z.literal('os.open'),
  target: z.string().min(1),
  continueOnError: z.boolean().optional(),
});

const clipboardActionSchema = z.object({
  kind: z.literal('os.clipboard'),
  text: z.string(),
});

const keystrokeStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('keys'),
    keys: z.string().min(1),
    delayMs: z.number().int().min(0).max(10_000).optional(),
  }),
  z.object({
    type: z.literal('text'),
    text: z.string(),
    delayMs: z.number().int().min(0).max(10_000).optional(),
  }),
  z.object({
    type: z.literal('wait'),
    ms: z.number().int().min(0).max(10_000),
  }),
]);

const keystrokeActionSchema = z.object({
  kind: z.literal('keystroke'),
  app: z.string().optional(),
  steps: z.array(keystrokeStepSchema).min(1),
  continueOnError: z.boolean().optional(),
});

const aiActionSchema = z.object({
  kind: z.literal('ai'),
  prompt: z.string().min(1),
  output: z.enum(['clipboard', 'echo']),
  continueOnError: z.boolean().optional(),
});

export const macroActionSchema = z.discriminatedUnion('kind', [
  shellActionSchema,
  httpActionSchema,
  delayActionSchema,
  osOpenActionSchema,
  clipboardActionSchema,
  keystrokeActionSchema,
  aiActionSchema,
]);
export type MacroActionDto = z.infer<typeof macroActionSchema>;

const tileBase = {
  id: z.string().min(1),
  slot: z.number().int().min(0),
  label: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
};

const actionTileSchema = z.object({
  ...tileBase,
  kind: z.literal('action'),
  actions: z.array(macroActionSchema),
});

const groupTileSchema = z.object({
  ...tileBase,
  kind: z.literal('group'),
  groupBoardId: z.string().min(1),
});

export const macroTileSchema = z.discriminatedUnion('kind', [
  actionTileSchema,
  groupTileSchema,
]);
export type MacroTileDto = z.infer<typeof macroTileSchema>;

export const macroBoardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  columns: z.number().int().min(1).max(12),
  rows: z.number().int().min(1).max(12),
  // Older saved files predate pagination — default to a single page so they
  // load without breakage.
  pageCount: z.number().int().min(1).max(50).default(1),
  tiles: z.array(macroTileSchema),
});
export type MacroBoardDto = z.infer<typeof macroBoardSchema>;

export const macroStateSchema = z.object({
  boards: z.array(macroBoardSchema),
  rootBoardId: z.string().min(1),
});
export type MacroStateDto = z.infer<typeof macroStateSchema>;

// ---------------- requests ----------------

export const saveBoardRequestSchema = z.object({
  board: macroBoardSchema,
});
export type SaveBoardRequest = z.infer<typeof saveBoardRequestSchema>;

export const deleteTileRequestSchema = z.object({
  boardId: z.string().min(1),
  tileId: z.string().min(1),
});
export type DeleteTileRequest = z.infer<typeof deleteTileRequestSchema>;

export const runTileRequestSchema = z.object({
  boardId: z.string().min(1),
  tileId: z.string().min(1),
  // Workspace whose cwd should be used for `shell` actions. Optional — falls
  // back to the system default workspace.
  workspaceId: z.string().optional(),
  // Pre-resolved values for `{{prompt[:label]}}` tokens. Keyed by label;
  // empty-string key matches `{{prompt}}` with no label. Renderer collects
  // these via a modal before invoking runTile.
  prompts: z.record(z.string(), z.string()).optional(),
});
export type RunTileRequest = z.infer<typeof runTileRequestSchema>;

// ---------------- path picker ----------------

export const pickPathRequestSchema = z.object({
  mode: z.enum(['app', 'file', 'directory']),
});
export type PickPathRequest = z.infer<typeof pickPathRequestSchema>;

export type PickPathResponse = { path: string | null };

// ---------------- AI suggestion ----------------

export const suggestTileRequestSchema = z.object({
  prompt: z.string().min(1, 'prompt 가 비어 있습니다').max(2000),
});
export type SuggestTileRequest = z.infer<typeof suggestTileRequestSchema>;

// What the AI returns. Slot/id are not assigned by the model — the renderer
// places drafts into the current board's empty slots (and into new sub-
// boards for groups) before saving. The response is a list so AI can emit
// multiple top-level tiles in one shot; each tile is recursive (a group can
// contain child drafts that populate its sub-board).

const suggestedActionDraftSchema = z.object({
  kind: z.literal('action'),
  label: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  actions: z.array(macroActionSchema),
});

export type SuggestedActionDraft = z.infer<typeof suggestedActionDraftSchema>;

export type SuggestedGroupDraft = {
  kind: 'group';
  label: string;
  icon?: string;
  color?: string;
  children: SuggestedTileDraft[];
};

export type SuggestedTileDraft = SuggestedActionDraft | SuggestedGroupDraft;

// Recursive group schema requires z.lazy. We use z.union (not
// z.discriminatedUnion) because lazy is incompatible with discriminated.
const suggestedGroupDraftSchema: z.ZodType<SuggestedGroupDraft> = z.lazy(() =>
  z.object({
    kind: z.literal('group'),
    label: z.string().min(1),
    icon: z.string().optional(),
    color: z.string().optional(),
    children: z.array(suggestedTileDraftSchema),
  }),
);

const suggestedTileDraftSchema: z.ZodType<SuggestedTileDraft> = z.lazy(() =>
  z.union([suggestedActionDraftSchema, suggestedGroupDraftSchema]),
);

export const suggestResponseSchema = z.object({
  drafts: z.array(suggestedTileDraftSchema).min(1),
});

export type SuggestTileResponse = {
  drafts: SuggestedTileDraft[];
};

// Re-export for the service parser.
export const aiSuggestResponseSchema = suggestResponseSchema;

// ---------------- responses ----------------

export type RunActionResult = {
  index: number;
  kind: MacroActionDto['kind'];
  ok: boolean;
  message?: string;
};

export type RunTileResponse = {
  tileId: string;
  aborted: boolean;
  results: RunActionResult[];
};
