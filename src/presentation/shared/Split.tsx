import {
  Children,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type Direction = 'horizontal' | 'vertical';

type SplitProps = {
  direction: Direction;
  /** 첫 번째 패널의 초기 크기 (퍼센트, 0~100). 기본 50 */
  initialFirstSize?: number;
  /** 첫 번째 패널의 최소 크기 (퍼센트). 기본 10 */
  minFirstSize?: number;
  /** 첫 번째 패널의 최대 크기 (퍼센트). 기본 90 */
  maxFirstSize?: number;
  className?: string;
  children: [ReactNode, ReactNode];
};

export function Split({
  direction,
  initialFirstSize = 50,
  minFirstSize = 10,
  maxFirstSize = 90,
  className = '',
  children,
}: SplitProps) {
  const [first, second] = Children.toArray(children);
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstSize, setFirstSize] = useState(initialFirstSize);
  const [dragging, setDragging] = useState(false);

  const isHorizontal = direction === 'horizontal';

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = isHorizontal ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;
      const pct = (offset / total) * 100;
      const clamped = Math.min(maxFirstSize, Math.max(minFirstSize, pct));
      setFirstSize(clamped);
    };

    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, isHorizontal, maxFirstSize, minFirstSize]);

  const flexDir = isHorizontal ? 'flex-row' : 'flex-col';
  const cursorClass = dragging ? (isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize') : '';
  const firstStyle = isHorizontal ? { width: `${firstSize}%` } : { height: `${firstSize}%` };
  const handleBase = isHorizontal
    ? 'w-1 cursor-col-resize hover:bg-emerald-500/60'
    : 'h-1 cursor-row-resize hover:bg-emerald-500/60';

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full ${flexDir} ${cursorClass} ${className}`}
    >
      <div className="min-h-0 min-w-0 overflow-hidden" style={firstStyle}>
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        onPointerDown={onPointerDown}
        className={`shrink-0 bg-slate-700 transition-colors ${handleBase} ${
          dragging ? 'bg-emerald-500' : ''
        }`}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
