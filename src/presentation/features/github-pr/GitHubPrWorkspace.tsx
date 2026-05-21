import { useState } from 'react';
import { ExtensionSettingsForm } from '../extensions/ExtensionSettingsForm';
import { GitHubPrList } from './GitHubPrList';
import { GitHubPrTestConnection } from './GitHubPrTestConnection';

type Section = 'pulls' | 'settings';

const NAV: { key: Section; label: string; icon: string; hint: string }[] = [
  { key: 'pulls', label: 'Pull Requests', icon: '🔀', hint: '레포별 PR 목록' },
  { key: 'settings', label: '설정', icon: '⚙', hint: '토큰 · 레포 · 연결 테스트' },
];

/**
 * Single-view workspace for the GitHub PR extension. Mirrors the Jira layout
 * (left nav inside the view) so the activity bar stays a single entry per
 * extension.
 */
export function GitHubPrWorkspace() {
  const [section, setSection] = useState<Section>('pulls');

  return (
    <div className="grid h-full grid-cols-[180px_1fr] gap-0">
      <nav className="flex flex-col gap-0.5 border-r border-ink-800 bg-ink-900/50 p-2">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => setSection(n.key)}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
              section === n.key
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
            }`}
            title={n.hint}
          >
            <span className="w-4 text-center">{n.icon}</span>
            <span className="truncate">{n.label}</span>
          </button>
        ))}
      </nav>

      <section className="min-w-0 overflow-hidden">
        {section === 'pulls' && <GitHubPrList />}
        {section === 'settings' && <SettingsSection />}
      </section>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded border border-ink-800 bg-ink-900/50 p-3 text-xs leading-relaxed text-ink-300">
        GitHub Personal Access Token 과 추적할 레포 목록을 입력하세요. 토큰은
        OS 보안 저장소(safeStorage)로 암호화돼 디스크에 저장됩니다.
      </div>
      <ExtensionSettingsForm extensionId="workos.github-pr" />
      <div className="border-t border-ink-800 pt-4">
        <GitHubPrTestConnection />
      </div>
    </div>
  );
}
