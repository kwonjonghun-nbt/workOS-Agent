import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { macroApi } from '../../api/macro';
import type {
  DeleteTileRequest,
  RunTileRequest,
  SaveBoardRequest,
  SuggestTileRequest,
} from '../../api/macro';
import { macroKeys } from './keys';

export const macroQueries = {
  state: () =>
    queryOptions({
      queryKey: macroKeys.state(),
      queryFn: () => macroApi.getState(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }),
};

export const macroMutations = {
  saveBoard: () =>
    mutationOptions({
      mutationFn: (req: SaveBoardRequest) => macroApi.saveBoard(req),
    }),
  deleteTile: () =>
    mutationOptions({
      mutationFn: (req: DeleteTileRequest) => macroApi.deleteTile(req),
    }),
  runTile: () =>
    mutationOptions({
      mutationFn: (req: RunTileRequest) => macroApi.runTile(req),
    }),
  suggestTile: () =>
    mutationOptions({
      mutationFn: (req: SuggestTileRequest) => macroApi.suggestTile(req),
    }),
};
