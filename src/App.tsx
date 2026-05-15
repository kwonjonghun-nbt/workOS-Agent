import { useState } from 'react';
import { TerminalPanel } from './presentation/features/terminal/TerminalPanel';
import { Split } from './presentation/shared/Split';

export default function App() {
  const [showTerminal, setShowTerminal] = useState(false);

  const mainContent = (
    <main className="flex h-full w-full flex-col items-center justify-center">
      <div className="space-y-6 text-center">
        <h1 className="text-4xl font-bold">workOS-Agent</h1>
        <p className="text-slate-300">Electron + React + Vite + TypeScript + Tailwind</p>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTerminal((v) => !v)}
            className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-900 hover:bg-emerald-400 active:bg-emerald-600"
          >
            {showTerminal ? '터미널 닫기' : '터미널 열기'}
          </button>
        </div>
      </div>
    </main>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-white">
      {showTerminal ? (
        <Split direction="horizontal" initialFirstSize={50}>
          {mainContent}
          <TerminalPanel onClosePanel={() => setShowTerminal(false)} />
        </Split>
      ) : (
        mainContent
      )}
    </div>
  );
}
