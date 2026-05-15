// 현재 터미널 도메인은 mutation/event 전용이라 queryKey 사용처가 없다.
// 추후 query (예: terminal:list 도입 시) 가 생기면 여기에 factory 를 확장한다.
export const terminalKeys = {
  all: ['terminal'] as const,
} as const;
