import { mutationOptions } from '@tanstack/react-query';
import { terminalApi } from '../../api/terminal';
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  DisposeTerminalRequest,
  ResizeTerminalRequest,
  WriteTerminalRequest,
} from '../../api/terminal';

// NOTE: 터미널은 명령형 IPC + 스트리밍 모델이라 react-query 의 캐싱 모델과 직접 맞지는 않는다.
// 그래도 레이어 규칙(Business → Server State → API)을 지키기 위해 mutationOptions 로 래핑한다.
// onSuccess 의 invalidation 은 없음 — 캐시할 대상이 없다.
// 스트리밍 수신(onData/onExit)은 캐시가 아닌 pub/sub 이므로 ./events.ts 에서 노출한다.

export const terminalMutations = {
  create: () =>
    mutationOptions<CreateTerminalResponse, Error, CreateTerminalRequest>({
      mutationFn: (req) => terminalApi.create(req),
    }),

  write: () =>
    mutationOptions<void, Error, WriteTerminalRequest>({
      mutationFn: (req) => terminalApi.write(req),
    }),

  resize: () =>
    mutationOptions<void, Error, ResizeTerminalRequest>({
      mutationFn: (req) => terminalApi.resize(req),
    }),

  dispose: () =>
    mutationOptions<void, Error, DisposeTerminalRequest>({
      mutationFn: (req) => terminalApi.dispose(req),
    }),
};
