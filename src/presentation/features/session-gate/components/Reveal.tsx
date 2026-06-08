import type { ReactNode } from 'react';

/**
 * 순차 공개 래퍼 — show 가 true 가 되면 마운트되며 아래에서 위로 페이드인한다.
 * overflow-hidden/grid 트랙 애니메이션을 쓰지 않아 내부 리스트/버튼 클릭을
 * 방해하지 않는다. (motion-reduce 환경에서는 즉시 표시)
 */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <div className="animate-field-in motion-reduce:animate-none">{children}</div>;
}
