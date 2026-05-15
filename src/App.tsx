import { useState } from 'react';
import { TerminalPanel } from './presentation/features/terminal/TerminalPanel';

export default function App() {
  const [panelIds, setPanelIds] = useState<string[]>([]);

  const addPanel = () => {
    setPanelIds((prev) => [...prev, crypto.randomUUID()]);
  };
  const closePanel = (id: string) => {
    setPanelIds((prev) => prev.filter((p) => p !== id));
  };

  const hasPanels = panelIds.length > 0;

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-white">
      <main
        className={`flex flex-col items-center justify-center transition-all duration-200 ${
          hasPanels ? 'w-1/2' : 'w-full'
        }`}
      >
        <div className="space-y-6 text-center">
          <h1 className="text-4xl font-bold">workOS-Agent</h1>
          <p className="text-slate-300">Electron + React + Vite + TypeScript + Tailwind</p>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={addPanel}
              className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-900 hover:bg-emerald-400 active:bg-emerald-600"
            >
              + 터미널 추가
            </button>
            <span className="text-xs text-slate-400">현재 패널 {panelIds.length}개</span>
          </div>
        </div>
      </main>

      {hasPanels && (
        <aside className="flex w-1/2 flex-col border-l border-slate-700">
          {panelIds.map((id, idx) => (
            <div
              key={id}
              className={`min-h-0 flex-1 ${idx > 0 ? 'border-t border-slate-700' : ''}`}
            >
              <TerminalPanel label={`Terminal ${idx + 1}`} onClose={() => closePanel(id)} />
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
