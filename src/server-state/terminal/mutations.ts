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
//
// 옵션 객체는 dynamic 의존성이 없어 모듈 상수로 둔다 (불필요한 객체 재생성 방지).

const createOptions = mutationOptions<CreateTerminalResponse, Error, CreateTerminalRequest>({
  mutationFn: (req) => terminalApi.create(req),
});

const writeOptions = mutationOptions<void, Error, WriteTerminalRequest>({
  mutationFn: (req) => terminalApi.write(req),
});

const resizeOptions = mutationOptions<void, Error, ResizeTerminalRequest>({
  mutationFn: (req) => terminalApi.resize(req),
});

const disposeOptions = mutationOptions<void, Error, DisposeTerminalRequest>({
  mutationFn: (req) => terminalApi.dispose(req),
});

export const terminalMutations = {
  create: () => createOptions,
  write: () => writeOptions,
  resize: () => resizeOptions,
  dispose: () => disposeOptions,
};
