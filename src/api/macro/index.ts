import type {
  DeleteTileRequest,
  MacroState,
  PickPathRequest,
  PickPathResponse,
  RunTileRequest,
  RunTileResponse,
  SaveBoardRequest,
  SuggestTileRequest,
  SuggestTileResponse,
} from './types';

function api() {
  return window.electronAPI.macro;
}

export const macroApi = {
  getState: (): Promise<MacroState> => api().getState(),
  saveBoard: (req: SaveBoardRequest): Promise<MacroState> => api().saveBoard(req),
  deleteTile: (req: DeleteTileRequest): Promise<MacroState> => api().deleteTile(req),
  runTile: (req: RunTileRequest): Promise<RunTileResponse> => api().runTile(req),
  suggestTile: (req: SuggestTileRequest): Promise<SuggestTileResponse> =>
    api().suggestTile(req),
  pickPath: (req: PickPathRequest): Promise<PickPathResponse> => api().pickPath(req),
};

export type {
  ActionTile,
  AiAction,
  ClipboardAction,
  DelayAction,
  DeleteTileRequest,
  GroupTile,
  HttpAction,
  HttpMethod,
  KeystrokeAction,
  KeystrokeStep,
  MacroAction,
  MacroActionKind,
  MacroBoard,
  MacroState,
  MacroTile,
  MacroTileKind,
  OsOpenAction,
  RunActionResult,
  RunTileRequest,
  RunTileResponse,
  SaveBoardRequest,
  ShellAction,
  PickPathMode,
  PickPathRequest,
  PickPathResponse,
  SuggestTileRequest,
  SuggestTileResponse,
  SuggestedActionDraft,
  SuggestedGroupDraft,
  SuggestedTileDraft,
} from './types';
