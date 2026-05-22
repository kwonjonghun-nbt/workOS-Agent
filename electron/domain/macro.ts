// Pure domain types for the Macro Buttons extension. No node/electron deps.
//
// A Board is a single grid (think a Stream Deck page). Each board contains
// tiles in a sparse layout — every tile occupies a linear `slot` index
// (row = floor(slot / columns), col = slot % columns).
//
// Tiles come in two kinds:
//   - 'action' — executes a sequence of MacroActions on click
//   - 'group'  — navigates into another board (folder). When the user is
//                inside a sub-board, slot 0 is virtually reserved as a Back
//                tile (auto-rendered by the renderer; never stored).

export type ShellAction = {
  kind: 'shell';
  command: string;
  continueOnError?: boolean;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

/**
 * Sends keystrokes to the system (or a specific app). macOS only — backed by
 * osascript / System Events. First use prompts for Accessibility permission.
 */
export type KeystrokeStep =
  | { type: 'keys'; keys: string; delayMs?: number }   // e.g. "cmd+shift+t", "enter"
  | { type: 'text'; text: string; delayMs?: number }   // type literal text
  | { type: 'wait'; ms: number };                       // explicit pause

export type KeystrokeAction = {
  kind: 'keystroke';
  // Optional: bring this app to the foreground before sending keys. macOS
  // application name as it appears in the menu bar (e.g. "Slack", "Safari").
  app?: string;
  steps: KeystrokeStep[];
  continueOnError?: boolean;
};

/**
 * Runs a claude CLI call mid-sequence. Same plumbing as the macro AI
 * generator, but executed as part of a tile run. Result is either copied to
 * the OS clipboard (so later actions can pull it via {{clipboard}}) or just
 * echoed into the extension terminal.
 */
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

// ---------------- tiles ----------------

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
  // Sub-board id this group points to. The sub-board lives in the same
  // `boards` list; it is reachable only by navigating into this tile.
  groupBoardId: string;
};

export type MacroTile = ActionTile | GroupTile;

// ---------------- board ----------------

export type MacroBoard = {
  id: string;
  name: string;
  columns: number;
  rows: number;
  // Number of grid pages. Each page is columns*rows slots wide. Global slot
  // index = page * (columns * rows) + localSlot. Defaults to 1.
  pageCount: number;
  tiles: MacroTile[];
};

export type MacroState = {
  boards: MacroBoard[];
  // The user-facing entry board. All other boards are reachable from here
  // via group tiles. A board may be orphaned if a group tile referencing it
  // is deleted — that's fine for v1; we just don't auto-GC.
  rootBoardId: string;
};

export const MACRO_EXTENSION_ID = 'workos.macro-buttons';

const ROOT_BOARD_ID = 'root';

export function emptyBoard(id: string, name: string): MacroBoard {
  return { id, name, columns: 5, rows: 3, pageCount: 1, tiles: [] };
}

export function defaultState(): MacroState {
  const board = emptyBoard(ROOT_BOARD_ID, 'Macros');
  return { boards: [board], rootBoardId: board.id };
}

export function findBoard(state: MacroState, boardId: string): MacroBoard | null {
  return state.boards.find((b) => b.id === boardId) ?? null;
}

export function findTile(board: MacroBoard, tileId: string): MacroTile | null {
  return board.tiles.find((t) => t.id === tileId) ?? null;
}

export function isActionTile(tile: MacroTile): tile is ActionTile {
  return tile.kind === 'action';
}

export function isGroupTile(tile: MacroTile): tile is GroupTile {
  return tile.kind === 'group';
}
