import { useUpdater } from '../../business/updater/use-updater';

export function StatusBar() {
  const { status, check, install } = useUpdater();

  if (!status) {
    return (
      <div className="flex h-6 w-full shrink-0 items-center justify-between border-t border-white/5 bg-ink-800/80 px-3 text-[11px] text-white/40" />
    );
  }

  const { state, currentVersion, newVersion, progressPercent, error, isPackaged } = status;

  const busy = state === 'checking' || state === 'downloading';

  const right = (() => {
    switch (state) {
      case 'checking':
        return <span className="text-white/60">업데이트 확인 중...</span>;
      case 'available':
        return <span className="text-amber-300">새 버전 v{newVersion} 사용 가능</span>;
      case 'downloading':
        return (
          <span className="flex items-center gap-2 text-white/70">
            다운로드 중
            <span className="inline-block h-1.5 w-24 overflow-hidden rounded bg-white/10">
              <span
                className="block h-full bg-emerald-400 transition-all"
                style={{ width: `${progressPercent ?? 0}%` }}
              />
            </span>
            {progressPercent ?? 0}%
          </span>
        );
      case 'downloaded':
        return (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded bg-emerald-500/90 px-2 py-0.5 text-[11px] font-medium text-black hover:bg-emerald-400"
          >
            v{newVersion} 재시작하고 설치
          </button>
        );
      case 'not-available':
        return <span className="text-white/50">최신 버전</span>;
      case 'error':
        return (
          <span className="text-red-300" title={error}>
            업데이트 확인 실패
          </span>
        );
      default:
        return <span className="text-white/40">{isPackaged ? '대기 중' : '개발 모드'}</span>;
    }
  })();

  return (
    <div className="flex h-6 w-full shrink-0 items-center justify-between border-t border-white/5 bg-ink-800/80 px-3 text-[11px] text-white/60">
      <div className="flex items-center gap-3">
        <span className="text-white/50">v{currentVersion}</span>
      </div>
      <div className="flex items-center gap-3">
        {right}
        <button
          type="button"
          onClick={() => void check()}
          disabled={!isPackaged || busy}
          className="rounded px-2 py-0.5 text-white/60 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={isPackaged ? '업데이트 확인' : '개발 모드에서는 업데이트를 확인할 수 없습니다'}
        >
          업데이트 확인
        </button>
      </div>
    </div>
  );
}
