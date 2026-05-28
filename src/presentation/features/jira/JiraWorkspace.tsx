import { useState } from 'react';
import { JiraTaskList } from './JiraTaskList';
import { JiraDashboard } from './JiraDashboard';
import { JiraLabels } from './JiraLabels';
import { JiraReports } from './JiraReports';
import { JiraTestConnection } from './JiraTestConnection';
import { JiraSlackSettings } from './JiraSlackSettings';
import { JiraTransitionMapEditor } from './JiraTransitionMapEditor';
import { TicketTemplates } from './TicketTemplates';
import { ExtensionSettingsForm } from '../extensions/ExtensionSettingsForm';
import { useExtensionList } from '../../../business/extension/use-extensions';

type Section =
  | 'tasks'
  | 'dashboard'
  | 'labels'
  | 'reports'
  | 'templates'
  | 'slack'
  | 'settings';

const NAV: { key: Section; label: string; icon: string; hint: string }[] = [
  { key: 'tasks', label: '내 이슈', icon: '📥', hint: '담당 이슈 빠른 목록' },
  { key: 'dashboard', label: '대시보드', icon: '📊', hint: '개요 · 타임라인 · 통계' },
  { key: 'labels', label: '라벨', icon: '🏷', hint: '관리 · 변경 · 추천' },
  { key: 'reports', label: '리포트', icon: '📝', hint: '기간별 마크다운 리포트' },
  { key: 'templates', label: '본문 템플릿', icon: '🧩', hint: '티켓·에픽 본문 구성 정의' },
  { key: 'slack', label: '데일리 공유', icon: '💬', hint: 'Slack 스레드 데일리 리포트' },
  { key: 'settings', label: '설정', icon: '⚙', hint: '연결 정보 · 테스트' },
];

/**
 * 단일 view 안에서 모든 Jira 기능을 좌측 네비로 전환한다. manifest의 view 가 늘어나면
 * 액티비티 바가 어수선해져서 한 진입점만 노출하는 방향으로 정리.
 */
export function JiraWorkspace() {
  const [section, setSection] = useState<Section>('dashboard');

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

      <section className="min-w-0 overflow-y-auto p-4">
        {section === 'tasks' && <JiraTaskList />}
        {section === 'dashboard' && <JiraDashboard />}
        {section === 'labels' && <JiraLabels />}
        {section === 'reports' && <JiraReports />}
        {section === 'templates' && <TicketTemplates />}
        {section === 'slack' && (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <JiraSlackSettings />
          </div>
        )}
        {section === 'settings' && <SettingsSection />}
      </section>
    </div>
  );
}

function SettingsSection() {
  const extQuery = useExtensionList();
  const ext = extQuery.data?.find((e) => e.manifest.id === 'workos.jira');
  const statusTransitionsJson =
    typeof ext?.settings.statusTransitions === 'string' ? ext.settings.statusTransitions : '';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="rounded border border-ink-800 bg-ink-900/50 p-3 text-xs leading-relaxed text-ink-300">
        Atlassian 에서 발급한 API 토큰과 도메인, 프로젝트 키를 입력하세요.
        토큰은 OS 보안 저장소(safeStorage)로 암호화돼 디스크에 저장됩니다.
      </div>
      <ExtensionSettingsForm extensionId="workos.jira" />
      <div className="border-t border-ink-800 pt-4">
        <JiraTestConnection />
      </div>
      <div className="border-t border-ink-800 pt-4">
        <JiraTransitionMapEditor currentJson={statusTransitionsJson} />
      </div>
    </div>
  );
}
