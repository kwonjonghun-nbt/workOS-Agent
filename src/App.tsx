import { useState } from 'react';
import { TerminalPanel } from './presentation/features/terminal/TerminalPanel';
import { Split } from './presentation/shared/Split';

export default function App() {
  const [panelIds, setPanelIds] = useState<string[]>([]);

  const addPanel = () => {
    setPanelIds((prev) => [...prev, crypto.randomUUID()]);
  };
  const closePanel = (id: string) => {
    setPanelIds((prev) => prev.filter((p) => p !== id));
  };

  const hasPanels = panelIds.length > 0;

  const mainContent = (
    <main className="flex h-full w-full flex-col items-center justify-center">
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
  );

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-white">
      {hasPanels ? (
        <Split direction="horizontal" initialFirstSize={50}>
          {mainContent}
          <TerminalStack panelIds={panelIds} onClose={closePanel} startIndex={0} />
        </Split>
      ) : (
        mainContent
      )}
    </div>
  );
}

type TerminalStackProps = {
  panelIds: string[];
  onClose: (id: string) => void;
  startIndex: number;
};

function TerminalStack({ panelIds, onClose, startIndex }: TerminalStackProps) {
  if (panelIds.length === 1) {
    const id = panelIds[0];
    return (
      <div className="h-full w-full">
        <TerminalPanel label={`Terminal ${startIndex + 1}`} onClose={() => onClose(id)} />
      </div>
    );
  }

  const [head, ...tail] = panelIds;

  return (
    <Split direction="vertical" initialFirstSize={100 / panelIds.length}>
      <TerminalPanel label={`Terminal ${startIndex + 1}`} onClose={() => onClose(head)} />
      <TerminalStack panelIds={tail} onClose={onClose} startIndex={startIndex + 1} />
    </Split>
  );
}
