import { terminalApi } from '../../api/terminal';
import type { TerminalDataEvent, TerminalExitEvent } from '../../api/terminal';

// 터미널 스트리밍 이벤트는 react-query 의 query/mutation 모델에 맞지 않는 pub/sub 이다.
// 그러나 business 가 api 레이어를 직접 import 하지 않도록 server-state 를 경유시킨다.
// (server-state 만이 api/** 를 import 할 수 있다는 레이어 규칙 유지.)

export const terminalEvents = {
  subscribeData: (listener: (event: TerminalDataEvent) => void) => terminalApi.onData(listener),
  subscribeExit: (listener: (event: TerminalExitEvent) => void) => terminalApi.onExit(listener),
};

export type { TerminalDataEvent, TerminalExitEvent };
