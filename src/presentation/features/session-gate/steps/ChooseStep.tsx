import { ChoiceButton } from '../components/ChoiceButton';

/** 게이트 첫 화면 — 생성/선택/스킵 중 하나를 고른다. */
export function ChooseStep({
  onCreate,
  onSelect,
  onSkip,
  submitting,
}: {
  onCreate: () => void;
  onSelect: () => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-3 px-5 py-4">
      <p className="text-sm text-ink-200">
        작업을 시작하기 전에 이 세션이 어떤 Jira 티켓에 속하는지 정합니다. 티켓 누락을 막기 위한
        단계입니다.
      </p>
      <div className="grid gap-2">
        <ChoiceButton
          title="새 Jira 티켓 생성"
          detail="에픽을 선택(또는 생성)하고 그 아래에 새 티켓을 만들어 시작합니다."
          onClick={onCreate}
          disabled={submitting}
        />
        <ChoiceButton
          title="기존 Jira 티켓 선택"
          detail="검색하거나 내게 할당된 이슈 중에서 골라 시작합니다."
          onClick={onSelect}
          disabled={submitting}
        />
        <ChoiceButton
          title="티켓 없이 시작 (스킵)"
          detail="이 세션은 특정 티켓에 연결하지 않습니다."
          onClick={onSkip}
          disabled={submitting}
          muted
        />
      </div>
    </div>
  );
}
