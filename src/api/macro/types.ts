// Type-only mirrors of electron/contracts/macro.ts.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ShellAction = {
  kind: 'shell';
  command: string;
  continueOnError?: boolean;
};

export type HttpAction = {
  kind: 'http';
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  continueOnError?: boolean;
};

export type DelayAction = {
  kind: 'delay';
  ms: number;
};

export type OsOpenAction = {
  kind: 'os.open';
  target: string;
  continueOnError?: boolean;
};

export type ClipboardAction = {
  kind: 'os.clipboard';
  text: string;
};

export type KeystrokeStep =
  | { type: 'keys'; keys: string; delayMs?: number }
  | { type: 'text'; text: string; delayMs?: number }
  | { type: 'wait'; ms: number };

export type KeystrokeAction = {
  kind: 'keystroke';
  app?: string;
  steps: KeystrokeStep[];
  continueOnError?: boolean;
};

export type AiAction = {
  kind: 'ai';
  prompt: string;
  output: 'clipboard' | 'echo';
  continueOnError?: boolean;
};

export type MacroAction =
  | ShellAction
  | HttpAction
  | DelayAction
  | OsOpenAction
  | ClipboardAction
  | KeystrokeAction
  | AiAction;

export type MacroActionKind = MacroAction['kind'];

type TileBase = {
  id: string;
  slot: number;
  label: string;
  icon?: string;
  color?: string;
};

export type ActionTile = TileBase & {
  kind: 'action';
  actions: MacroAction[];
};

export type GroupTile = TileBase & {
  kind: 'group';
  groupBoardId: string;
};

export type MacroTile = ActionTile | GroupTile;
export type MacroTileKind = MacroTile['kind'];

export type MacroBoard = {
  id: string;
  name: string;
  columns: number;
  rows: number;
  pageCount: number;
  tiles: MacroTile[];
};

export type MacroState = {
  boards: MacroBoard[];
  rootBoardId: string;
};

export type SaveBoardRequest = { board: MacroBoard };

export type DeleteTileRequest = { boardId: string; tileId: string };

export type RunTileRequest = {
  boardId: string;
  tileId: string;
  workspaceId?: string;
  prompts?: Record<string, string>;
};

export type RunActionResult = {
  index: number;
  kind: MacroActionKind;
  ok: boolean;
  message?: string;
};

export type RunTileResponse = {
  tileId: string;
  aborted: boolean;
  results: RunActionResult[];
};

export type SuggestTileRequest = { prompt: string };

export type SuggestedActionDraft = {
  kind: 'action';
  label: string;
  icon?: string;
  color?: string;
  actions: MacroAction[];
};

export type SuggestedGroupDraft = {
  kind: 'group';
  label: string;
  icon?: string;
  color?: string;
  children: SuggestedTileDraft[];
};

export type SuggestedTileDraft = SuggestedActionDraft | SuggestedGroupDraft;

export type SuggestTileResponse = { drafts: SuggestedTileDraft[] };

export type PickPathMode = 'app' | 'file' | 'directory';

export type PickPathRequest = { mode: PickPathMode };

export type PickPathResponse = { path: string | null };
