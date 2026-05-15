import { workspaceApi } from '../../api/workspace';
import type { WorkspaceChangedEvent } from '../../api/workspace';

// `workspace:changed` 는 메인이 SSOT 인 워크스페이스 목록을 broadcast 한다.
// business 가 api/** 를 직접 import 하지 않도록 server-state 를 경유.

export const workspaceEvents = {
  subscribeChanged: (listener: (event: WorkspaceChangedEvent) => void) =>
    workspaceApi.onChanged(listener),
};

export type { WorkspaceChangedEvent };
