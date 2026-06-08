import type { ReactNode } from 'react';

/**
 * 라벨 + 컨트롤 + 에러 메시지를 묶는 필드 래퍼.
 * div 로 감싼다 — label 로 감싸면 클릭이 내부 첫 폼 컨트롤로 전달(label forwarding)되어
 * 의도치 않게 트리거되는 문제가 있다(예: "변경" 버튼이 멋대로 눌림).
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
