import { useEffect } from 'react';

type Handler = (e: KeyboardEvent) => void;

/**
 * 글로벌 키보드 단축키 — input/textarea 포커스 중에는 발화하지 않음.
 * combo 예시: 'mod+1', 'mod+enter', 'shift+/'
 */
export function useHotkey(combo: string, handler: Handler, deps: React.DependencyList = []) {
  useEffect(() => {
    const parts = combo.toLowerCase().split('+');
    const wantMod = parts.includes('mod') || parts.includes('meta') || parts.includes('cmd');
    const wantShift = parts.includes('shift');
    const wantAlt = parts.includes('alt');
    const key = parts[parts.length - 1];

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      const isMod = e.metaKey || e.ctrlKey;
      if (wantMod && !isMod) return;
      if (!wantMod && isMod) return;
      if (wantShift && !e.shiftKey) return;
      if (wantAlt && !e.altKey) return;
      if (e.key.toLowerCase() !== key) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
