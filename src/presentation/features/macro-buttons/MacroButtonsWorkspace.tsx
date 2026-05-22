import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAiRuntimeStore } from '../../../business/macro-buttons/ai-runtime-store';
import { macroKeys, macroMutations, macroQueries } from '../../../server-state/macro';
import type {
  MacroBoard,
  MacroState,
  MacroTile,
} from '../../../server-state/macro';
import type { SuggestedTileDraft } from '../../../api/macro';
import { AiSuggestModal } from './AiSuggestModal';
import { ButtonEditor } from './ButtonEditor';
import { PromptCollectorModal, collectPromptLabels } from './PromptCollectorModal';

const TILE_SIZE = 96;

type EditTarget =
  | { mode: 'create'; slot: number }
  | { mode: 'edit'; tileId: string }
  | null;

// What's on the in-memory clipboard. `sourceBoardId` lets paste honor a cut
// (remove from origin); we also pass the tile by value so navigating boards
// doesn't lose it. Sub-board ids are NOT deep-cloned on copy — pasting a
// group tile creates a fresh empty sub-board.
type Clipboard = {
  tile: MacroTile;
  sourceBoardId: string;
  mode: 'copy' | 'cut';
} | null;

export function MacroButtonsWorkspace() {
  const qc = useQueryClient();
  const stateQuery = useQuery(macroQueries.state());

  const onStateSuccess = (state: MacroState) =>
    qc.setQueryData<MacroState>(macroKeys.state(), state);

  const runMutation = useMutation(macroMutations.runTile());
  const saveMutation = useMutation({
    ...macroMutations.saveBoard(),
    onSuccess: onStateSuccess,
  });
  const deleteTileMutation = useMutation({
    ...macroMutations.deleteTile(),
    onSuccess: onStateSuccess,
  });

  // AI runtime state lives in zustand so it survives navigating away from
  // this panel (claude CLI calls take 1–2 min and the user may need to
  // interact with the terminal panel to answer trust prompts).
  const ai = useAiRuntimeStore();

  const [editMode, setEditMode] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [aiDraft, setAiDraft] = useState<MacroTile | null>(null);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  // Current visible page per board id — preserves page across navigations.
  const [pageByBoard, setPageByBoard] = useState<Record<string, number>>({});
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  // When a tile click hits a macro that uses {{prompt}} tokens, we defer the
  // runTile call until the user has filled in those values via this modal.
  const [pendingRun, setPendingRun] = useState<{
    boardId: string;
    tileId: string;
    tileLabel: string;
    labels: string[];
  } | null>(null);

  const board = useMemo<MacroBoard | null>(() => {
    const state = stateQuery.data;
    if (!state) return null;
    const currentId = navStack[navStack.length - 1] ?? state.rootBoardId;
    return state.boards.find((b) => b.id === currentId) ?? null;
  }, [stateQuery.data, navStack]);

  const breadcrumb = useMemo<string[]>(() => {
    const state = stateQuery.data;
    if (!state) return [];
    const names: string[] = [];
    names.push(state.boards.find((b) => b.id === state.rootBoardId)?.name ?? 'Macros');
    for (const next of navStack) {
      const b = state.boards.find((b) => b.id === next);
      if (b) names.push(b.name);
    }
    return names;
  }, [stateQuery.data, navStack]);

  // Esc cancels an active clipboard.
  useEffect(() => {
    if (!clipboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClipboard(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipboard]);

  // When the AI modal is (re-)opened with a ready result waiting, materialize
  // every draft into tiles (and new sub-boards for group drafts) on the
  // current board and persist them. Self-contained — sits above the early
  // returns so the hook order is stable.
  useEffect(() => {
    if (ai.status !== 'ready' || !ai.result || !ai.modalOpen) return;
    const data = stateQuery.data;
    if (!data) return;
    const currentBoardId = navStack[navStack.length - 1] ?? data.rootBoardId;
    const targetBoard = data.boards.find((b) => b.id === currentBoardId);
    if (!targetBoard) return;

    const result = ai.consumeResult();
    if (!result) return;

    const isSub = navStack.length > 0;
    const slotsPerPage = targetBoard.columns * targetBoard.rows;
    const totalPages = Math.max(1, targetBoard.pageCount);
    const currentPage = Math.min(
      pageByBoard[targetBoard.id] ?? 0,
      totalPages - 1,
    );

    // Build all board mutations from the draft tree, then dispatch one
    // saveBoard per board. The service auto-creates referenced sub-boards
    // on the first save, so we save the parent first and each sub-board
    // after.
    const updates = materializeDrafts({
      board: targetBoard,
      pageIndex: currentPage,
      isSubBoard: isSub,
      drafts: result.drafts,
    });

    // Save parent first, then each new sub-board sequentially. Parallel
    // saveBoard calls race on the JSON repo's tmp-rename pattern and fail
    // with ENOENT (the first rename wins, others find nothing to rename).
    const queue = [updates.parent, ...updates.newBoards];
    const saveNext = (i: number) => {
      if (i >= queue.length) return;
      saveMutation.mutate(
        { board: queue[i] },
        { onSuccess: () => saveNext(i + 1) },
      );
    };
    saveNext(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.status, ai.modalOpen]);

  if (stateQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-500">
        로드 중...
      </div>
    );
  }
  if (stateQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-rose-400">
        매크로 상태를 불러올 수 없습니다: {(stateQuery.error as Error).message}
      </div>
    );
  }
  const state = stateQuery.data;
  if (!state || !board) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-500">
        보드가 없습니다.
      </div>
    );
  }

  const isSubBoard = navStack.length > 0;
  const slotsPerPage = board.columns * board.rows;
  const totalPages = Math.max(1, board.pageCount);
  const currentPage = Math.min(pageByBoard[board.id] ?? 0, totalPages - 1);
  const pageStart = currentPage * slotsPerPage;
  const pageEnd = pageStart + slotsPerPage;

  // Map local slot index (0..slotsPerPage-1) → tile on current page.
  const tilesByLocalSlot = new Map<number, MacroTile>();
  for (const t of board.tiles) {
    if (t.slot < pageStart || t.slot >= pageEnd) continue;
    tilesByLocalSlot.set(t.slot - pageStart, t);
  }

  const setBoardPage = (boardId: string, page: number) =>
    setPageByBoard((prev) => ({ ...prev, [boardId]: page }));

  const navigateBack = () => setNavStack((s) => s.slice(0, -1));
  const navigateInto = (groupBoardId: string) =>
    setNavStack((s) => [...s, groupBoardId]);

  // -------- helpers --------

  const isReservedLocalSlot = (localSlot: number) =>
    isSubBoard && localSlot === 0;

  const findFirstEmptyGlobalSlotInPage = (): number => {
    for (let local = 0; local < slotsPerPage; local++) {
      if (isReservedLocalSlot(local)) continue;
      const g = pageStart + local;
      if (!board.tiles.some((t) => t.slot === g)) return g;
    }
    // Page is full; fall back to the first non-reserved local slot — the
    // caller will overwrite or the user will see the same target.
    return pageStart + (isSubBoard ? 1 : 0);
  };

  // -------- handlers --------

  const onSlotClick = (localSlot: number) => {
    if (isReservedLocalSlot(localSlot)) {
      navigateBack();
      return;
    }
    const tile = tilesByLocalSlot.get(localSlot);
    const globalSlot = pageStart + localSlot;

    // Paste takes precedence when an item is on the clipboard.
    if (editMode && clipboard && !tile) {
      pasteAt(globalSlot);
      return;
    }

    if (editMode) {
      setEditTarget(
        tile ? { mode: 'edit', tileId: tile.id } : { mode: 'create', slot: globalSlot },
      );
      return;
    }

    if (!tile) return;
    if (tile.kind === 'group') {
      navigateInto(tile.groupBoardId);
      return;
    }
    // If the macro references any {{prompt}} tokens, ask the user for values
    // first and then run with them as overrides.
    const promptLabels = collectPromptLabels(tile.actions);
    if (promptLabels.length > 0) {
      setPendingRun({
        boardId: board.id,
        tileId: tile.id,
        tileLabel: tile.label,
        labels: promptLabels,
      });
      return;
    }
    runMutation.mutate({ boardId: board.id, tileId: tile.id });
  };

  const copyTile = (tile: MacroTile) => {
    setClipboard({ tile, sourceBoardId: board.id, mode: 'copy' });
  };
  const cutTile = (tile: MacroTile) => {
    setClipboard({ tile, sourceBoardId: board.id, mode: 'cut' });
  };

  const pasteAt = (globalSlot: number) => {
    if (!clipboard) return;
    const src = clipboard.tile;
    // 1) Place the new tile in the current board at the given slot.
    let pasted: MacroTile;
    if (src.kind === 'group') {
      // Always allocate a new sub-board id on copy. On cut, keep the original
      // groupBoardId so the entire folder moves intact.
      pasted = {
        ...src,
        id: makeId(),
        slot: globalSlot,
        groupBoardId: clipboard.mode === 'cut' ? src.groupBoardId : makeId(),
      };
    } else {
      pasted = { ...src, id: makeId(), slot: globalSlot, actions: src.actions };
    }
    const dstBoard: MacroBoard = {
      ...board,
      tiles: [...board.tiles.filter((t) => t.slot !== globalSlot), pasted],
    };

    if (clipboard.mode === 'cut' && clipboard.sourceBoardId === board.id) {
      // Cut + paste within the same board: drop the original in one save.
      dstBoard.tiles = dstBoard.tiles.filter((t) => t.id !== src.id);
      saveMutation.mutate({ board: dstBoard });
    } else if (clipboard.mode === 'cut') {
      // Cut across boards: save current board first, then remove source.
      saveMutation.mutate(
        { board: dstBoard },
        {
          onSuccess: () => {
            deleteTileMutation.mutate({
              boardId: clipboard.sourceBoardId,
              tileId: src.id,
            });
          },
        },
      );
    } else {
      saveMutation.mutate({ board: dstBoard });
    }
    setClipboard(null);
  };

  // -------- drag and drop (reorder within current page) --------

  const handleDragStart = (tile: MacroTile) => (e: React.DragEvent) => {
    if (!editMode) return;
    e.dataTransfer.setData('text/macro-tile-id', tile.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (localSlot: number) => (e: React.DragEvent) => {
    if (!editMode) return;
    if (isReservedLocalSlot(localSlot)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(localSlot);
  };

  const handleDragLeave = () => setDragOverSlot(null);

  const handleDrop = (localSlot: number) => (e: React.DragEvent) => {
    if (!editMode) return;
    if (isReservedLocalSlot(localSlot)) return;
    e.preventDefault();
    setDragOverSlot(null);
    const id = e.dataTransfer.getData('text/macro-tile-id');
    if (!id) return;
    const src = board.tiles.find((t) => t.id === id);
    if (!src) return;
    const targetGlobal = pageStart + localSlot;
    if (src.slot === targetGlobal) return;
    const dst = board.tiles.find((t) => t.slot === targetGlobal);
    const newTiles = board.tiles.map((t) => {
      if (t.id === src.id) return { ...t, slot: targetGlobal };
      if (dst && t.id === dst.id) return { ...t, slot: src.slot };
      return t;
    });
    saveMutation.mutate({ board: { ...board, tiles: newTiles } });
  };

  // -------- edit / save flow --------

  const closeEditor = () => {
    setEditTarget(null);
    setAiDraft(null);
  };

  const handleSaveTile = (next: MacroTile) => {
    const nextBoard: MacroBoard = {
      ...board,
      tiles:
        editTarget?.mode === 'edit'
          ? board.tiles.map((t) => (t.id === next.id ? next : t))
          : [...board.tiles, next],
    };
    saveMutation.mutate({ board: nextBoard }, { onSuccess: () => closeEditor() });
  };

  const handleDeleteTile = (tileId: string) => {
    deleteTileMutation.mutate(
      { boardId: board.id, tileId },
      { onSuccess: () => closeEditor() },
    );
  };

  // -------- AI flow --------

  const handleAiSubmit = (prompt: string) => {
    void ai.submit(prompt);
  };

  // Header button: always route through restore() so the effect (above the
  // early returns) picks up any ready result and opens the editor.
  const handleAiHeaderButton = () => ai.restore();

  const aiStatus = ai.status;

  const editorInitial = editTarget
    ? aiDraft ?? resolveEditorInitial(board, editTarget, isSubBoard)
    : null;

  // -------- pagination --------

  const addPage = () => {
    saveMutation.mutate(
      { board: { ...board, pageCount: totalPages + 1 } },
      {
        onSuccess: () => setBoardPage(board.id, totalPages),
      },
    );
  };

  const removeCurrentPage = () => {
    if (totalPages <= 1) return;
    const hasTiles = board.tiles.some(
      (t) => t.slot >= pageStart && t.slot < pageEnd,
    );
    if (hasTiles) {
      window.alert('이 페이지에 매크로가 남아 있어 삭제할 수 없습니다.');
      return;
    }
    // Shift all later tiles down by one page so global slot indices stay valid.
    const shifted = board.tiles.map((t) =>
      t.slot >= pageEnd ? { ...t, slot: t.slot - slotsPerPage } : t,
    );
    saveMutation.mutate(
      { board: { ...board, pageCount: totalPages - 1, tiles: shifted } },
      {
        onSuccess: () =>
          setBoardPage(board.id, Math.max(0, currentPage - 1)),
      },
    );
  };

  // -------- render --------

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-ink-800 px-4">
        <div className="flex items-center gap-2">
          <Breadcrumb
            names={breadcrumb}
            onJumpTo={(idx) => setNavStack((s) => s.slice(0, idx))}
          />
          <span className="rounded-md bg-ink-850 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            {board.tiles.length} 매크로
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              type="button"
              onClick={handleAiHeaderButton}
              className="rounded-md border border-claude-500/40 bg-claude-500/10 px-3 py-1 text-xs text-claude-200 transition-colors hover:bg-claude-500/20"
              title={
                ai.backgrounded
                  ? '진행 중인 AI 작업 다시 열기'
                  : 'AI 로 매크로 생성'
              }
            >
              {ai.backgrounded
                ? aiStatus === 'ready'
                  ? '✓ 결과 보기'
                  : aiStatus === 'error'
                    ? '⚠ 작업 펼치기'
                    : '🪄 작업 펼치기'
                : '🪄 AI 생성'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`rounded-md border px-3 py-1 text-xs transition-colors ${
              editMode
                ? 'border-claude-500/60 bg-claude-500/15 text-claude-200'
                : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'
            }`}
          >
            {editMode ? '✓ 편집 종료' : '✎ 편집'}
          </button>
        </div>
      </header>

      {clipboard && (
        <div className="flex shrink-0 items-center justify-between border-b border-claude-500/30 bg-claude-500/10 px-4 py-1.5 text-xs text-claude-200">
          <span>
            {clipboard.mode === 'cut' ? '✂ 잘라내기' : '📋 복사'} —{' '}
            <span className="font-medium">{clipboard.tile.label || '(이름 없음)'}</span>
            . 빈 슬롯을 클릭해 붙여넣으세요.
          </span>
          <button
            type="button"
            onClick={() => setClipboard(null)}
            className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider text-claude-300 hover:bg-claude-500/20"
          >
            취소 (Esc)
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${board.columns}, ${TILE_SIZE}px)` }}
        >
          {Array.from({ length: slotsPerPage }).map((_, localSlot) => {
            const isBack = isReservedLocalSlot(localSlot);
            if (isBack) {
              return <BackTile key="back" onClick={navigateBack} />;
            }
            const tile = tilesByLocalSlot.get(localSlot);
            const isRunning =
              runMutation.isPending && runMutation.variables?.tileId === tile?.id;
            const isDragOver = dragOverSlot === localSlot;
            return (
              <Tile
                key={localSlot}
                tile={tile}
                running={isRunning}
                editMode={editMode}
                hasPasteTarget={Boolean(clipboard) && !tile}
                isDragOver={isDragOver}
                onClick={() => onSlotClick(localSlot)}
                onCopy={tile ? () => copyTile(tile) : undefined}
                onCut={tile ? () => cutTile(tile) : undefined}
                onDragStart={tile ? handleDragStart(tile) : undefined}
                onDragOver={handleDragOver(localSlot)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(localSlot)}
              />
            );
          })}
        </div>

        <Pagination
          page={currentPage}
          total={totalPages}
          editMode={editMode}
          onChange={(p) => setBoardPage(board.id, p)}
          onAdd={addPage}
          onRemove={removeCurrentPage}
        />

        {editMode && (
          <p className="mt-4 text-xs text-ink-500">
            편집 모드 — 타일 드래그로 위치 이동. 호버 시 ✂/📋 로 잘라내기/복사. 그룹
            타일은 "📁 그룹" 탭으로 만들 수 있습니다.
          </p>
        )}
      </div>

      {editTarget && editorInitial && (
        <ButtonEditor
          initial={editorInitial}
          exists={editTarget.mode === 'edit'}
          onCancel={closeEditor}
          onSave={handleSaveTile}
          onDelete={() => handleDeleteTile(editorInitial.id)}
          saving={saveMutation.isPending || deleteTileMutation.isPending}
        />
      )}

      {pendingRun && (
        <PromptCollectorModal
          tileLabel={pendingRun.tileLabel}
          labels={pendingRun.labels}
          onCancel={() => setPendingRun(null)}
          onSubmit={(values) => {
            const { boardId, tileId } = pendingRun;
            setPendingRun(null);
            runMutation.mutate({ boardId, tileId, prompts: values });
          }}
        />
      )}

      {ai.modalOpen && (
        <AiSuggestModal
          prompt={ai.prompt}
          onPromptChange={ai.setPrompt}
          pending={ai.status === 'pending'}
          errorMessage={ai.status === 'error' ? ai.error : null}
          onCancel={ai.cancel}
          onMinimize={ai.minimize}
          onSubmit={handleAiSubmit}
        />
      )}
    </div>
  );
}

function resolveEditorInitial(
  board: MacroBoard,
  target: NonNullable<EditTarget>,
  isSubBoard: boolean,
): MacroTile | null {
  if (target.mode === 'edit') {
    return board.tiles.find((t) => t.id === target.tileId) ?? null;
  }
  const slotsPerPage = board.columns * board.rows;
  const localSlot = target.slot % slotsPerPage;
  // New tile in a sub-board cannot occupy the Back slot. Snap up to the next
  // slot on the same page if needed.
  const adjustedSlot =
    isSubBoard && localSlot === 0 ? target.slot + 1 : target.slot;
  return {
    kind: 'action',
    id: makeId(),
    slot: adjustedSlot,
    label: '',
    actions: [],
  };
}

/**
 * Walks a draft tree from the AI and produces:
 *  - the parent board's updated tile list (drafts placed in the active page's
 *    empty slots, auto-extending pageCount if needed)
 *  - new sub-board records for every group draft (populated with the group's
 *    children placed starting at slot 1, since slot 0 is the virtual Back).
 *
 * Existing tiles on the target board are preserved. All ids are freshly
 * generated. Children of a group are placed on the first page of the new
 * sub-board; if there are more children than fit, pageCount grows.
 */
function materializeDrafts(args: {
  board: MacroBoard;
  pageIndex: number;
  isSubBoard: boolean;
  drafts: SuggestedTileDraft[];
}): { parent: MacroBoard; newBoards: MacroBoard[] } {
  const { board, pageIndex, isSubBoard, drafts } = args;
  const slotsPerPage = board.columns * board.rows;
  const newBoards: MacroBoard[] = [];

  // Find empty local slots in the active page (skipping Back slot if sub).
  const occupied = new Set(board.tiles.map((t) => t.slot));
  const pageStart = pageIndex * slotsPerPage;
  const startLocal = isSubBoard ? 1 : 0;
  const availableLocals: number[] = [];
  for (let local = startLocal; local < slotsPerPage; local++) {
    const g = pageStart + local;
    if (!occupied.has(g)) availableLocals.push(g);
  }

  // If drafts exceed the active page's room, append additional pages.
  let pageCount = board.pageCount;
  let extraPageOffset = pageCount * slotsPerPage;
  while (availableLocals.length < drafts.length) {
    // The newly appended page starts fresh (no Back slot at the top level;
    // even for sub-boards, only page 0 of the sub-board renders the Back
    // — actually our Back tile is rendered per-page in sub-boards, so the
    // top slot of EVERY appended page must also be skipped on sub-boards).
    for (
      let local = isSubBoard ? 1 : 0;
      local < slotsPerPage && availableLocals.length < drafts.length;
      local++
    ) {
      availableLocals.push(extraPageOffset + local);
    }
    pageCount += 1;
    extraPageOffset += slotsPerPage;
  }

  const newTiles: MacroTile[] = [];
  drafts.forEach((draft, i) => {
    const slot = availableLocals[i];
    if (draft.kind === 'action') {
      newTiles.push({
        kind: 'action',
        id: makeId(),
        slot,
        label: draft.label,
        icon: draft.icon,
        color: draft.color,
        actions: draft.actions,
      });
      return;
    }
    // Group: create the tile + spin up an empty sub-board, then recursively
    // materialize children into it.
    const groupBoardId = makeId();
    newTiles.push({
      kind: 'group',
      id: makeId(),
      slot,
      label: draft.label,
      icon: draft.icon,
      color: draft.color,
      groupBoardId,
    });
    const childBoard: MacroBoard = {
      id: groupBoardId,
      name: draft.label || 'Group',
      columns: board.columns,
      rows: board.rows,
      pageCount: 1,
      tiles: [],
    };
    const childResult = materializeDrafts({
      board: childBoard,
      pageIndex: 0,
      isSubBoard: true,
      drafts: draft.children,
    });
    newBoards.push(childResult.parent, ...childResult.newBoards);
  });

  return {
    parent: {
      ...board,
      pageCount,
      tiles: [...board.tiles, ...newTiles],
    },
    newBoards,
  };
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function Breadcrumb({
  names,
  onJumpTo,
}: {
  names: string[];
  onJumpTo: (stackIndex: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-base font-semibold text-ink-100">
      {names.map((name, i) => {
        const isLast = i === names.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-ink-600">/</span>}
            {isLast ? (
              <span>{name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onJumpTo(i)}
                className="text-ink-400 hover:text-ink-200"
              >
                {name}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function BackTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-24 w-24 overflow-hidden rounded-lg border border-ink-700 bg-ink-850 text-ink-200 transition-colors hover:bg-ink-800"
      title="뒤로 가기"
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1.5">
        <span className="text-2xl leading-none">↩</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
          back
        </span>
      </div>
    </button>
  );
}

function Pagination({
  page,
  total,
  editMode,
  onChange,
  onAdd,
  onRemove,
}: {
  page: number;
  total: number;
  editMode: boolean;
  onChange: (p: number) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (total === 1 && !editMode) return null;
  return (
    <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="rounded border border-ink-700 bg-ink-900 px-2 py-1 hover:bg-ink-800 disabled:opacity-30"
      >
        ←
      </button>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`h-6 min-w-6 rounded px-1.5 text-[11px] transition-colors ${
            i === page
              ? 'bg-claude-500/20 text-claude-200'
              : 'bg-ink-900 text-ink-400 hover:bg-ink-800'
          }`}
        >
          {i + 1}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page === total - 1}
        className="rounded border border-ink-700 bg-ink-900 px-2 py-1 hover:bg-ink-800 disabled:opacity-30"
      >
        →
      </button>
      {editMode && (
        <>
          <button
            type="button"
            onClick={onAdd}
            className="ml-2 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-ink-300 hover:bg-ink-800"
            title="페이지 추가"
          >
            ＋ 페이지
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-rose-300 hover:bg-ink-800 disabled:opacity-30"
            title="현재 페이지 삭제 (비어있을 때만)"
          >
            − 페이지
          </button>
        </>
      )}
    </div>
  );
}

function Tile({
  tile,
  running,
  editMode,
  hasPasteTarget,
  isDragOver,
  onClick,
  onCopy,
  onCut,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  tile: MacroTile | undefined;
  running: boolean;
  editMode: boolean;
  hasPasteTarget: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  if (!tile) {
    const interactive = editMode || hasPasteTarget;
    return (
      <button
        type="button"
        onClick={interactive ? onClick : undefined}
        disabled={!interactive}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`h-24 w-24 rounded-lg border border-dashed transition-colors ${
          isDragOver
            ? 'border-claude-400 bg-claude-500/15 text-claude-200'
            : hasPasteTarget
              ? 'border-claude-500/60 bg-claude-500/5 text-claude-300 hover:bg-claude-500/10'
              : editMode
                ? 'border-ink-600 bg-ink-900/40 text-ink-500 hover:border-claude-500/60 hover:text-claude-300'
                : 'border-ink-800 bg-ink-900/30 text-ink-800'
        }`}
        title={
          hasPasteTarget
            ? '여기에 붙여넣기'
            : editMode
              ? '빈 슬롯 — 클릭하여 추가'
              : '빈 슬롯'
        }
      >
        {hasPasteTarget ? (
          <span className="text-xl">📋</span>
        ) : editMode ? (
          <span className="text-2xl">+</span>
        ) : null}
      </button>
    );
  }

  const isGroup = tile.kind === 'group';
  const hasColor = Boolean(tile.color);
  // No color = transparent for both kinds. Users explicitly opt into a fill
  // via the picker; without one, the dashed border distinguishes the tile.
  const tileStyle = hasColor ? { background: tile.color } : undefined;
  const tileBorderClass = hasColor
    ? 'border border-ink-700'
    : 'border border-dashed border-ink-600 bg-ink-900/20';
  const subtitle = isGroup
    ? '📁 그룹'
    : tile.actions.map((a) => a.kind).join(' → ') || '(빈 시퀀스)';

  return (
    <div
      className={`group relative h-24 w-24 ${isDragOver ? 'ring-2 ring-claude-400' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={running}
        draggable={editMode}
        onDragStart={onDragStart}
        className={`h-full w-full overflow-hidden rounded-lg text-ink-100 shadow-sm transition-transform hover:scale-[1.03] disabled:opacity-60 ${tileBorderClass} ${
          editMode ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={tileStyle}
        title={editMode ? '클릭하여 편집 · 드래그로 이동' : subtitle}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1.5">
          {tile.icon ? (
            <span className="text-2xl leading-none">{tile.icon}</span>
          ) : isGroup ? (
            <span className="text-2xl leading-none">📁</span>
          ) : null}
          <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight">
            {tile.label || '(이름 없음)'}
          </span>
        </div>
        {running && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] uppercase tracking-wider text-ink-200">
            실행 중…
          </div>
        )}
        {!editMode && isGroup && (
          <div className="pointer-events-none absolute right-1 top-1 rounded bg-black/40 px-1 text-[9px] text-ink-200">
            ›
          </div>
        )}
      </button>

      {editMode && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCut?.();
            }}
            className="pointer-events-auto rounded bg-black/60 px-1 text-[10px] text-ink-200 hover:bg-black/80"
            title="잘라내기"
          >
            ✂
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy?.();
            }}
            className="pointer-events-auto rounded bg-black/60 px-1 text-[10px] text-ink-200 hover:bg-black/80"
            title="복사"
          >
            📋
          </button>
        </div>
      )}
    </div>
  );
}
