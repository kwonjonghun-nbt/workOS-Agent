# 도메인 모델 설계

원본 [WorkOS](file:///Users/kwonjonghun/Documents/toy-project/WorkOS)의 모델을 참고하되, **모든 핵심 엔티티를 독립 모델로 분리**한다. 임베드/중첩 대신 **ID 참조**로만 관계를 표현해, 어느 한 모델의 수정이 다른 모델의 식별자나 외래 참조를 깨뜨리지 않게 한다.

## 1. 엔티티 개요

| 모델 | 역할 | 원본 WorkOS 매핑 |
|------|------|------------------|
| `Workflow` | 사용자 정의 업무 프로세스. Step의 **순서 있는 참조 목록** | Workflow |
| `Step` | 한 단계의 책임 + 매칭 에이전트. **여러 Workflow에서 재사용** | Workflow에 임베드됐던 Step을 독립화 |
| `Task` | 한 요구사항을 한 Workflow에 적용해 분해한 결과(번들) | TaskBundle |
| `TaskItem` | 분해된 개별 실행 단위 = 1 Step = 1 에이전트 호출 | Task |

## 2. 관계도

```
Workflow ─── stepIds: StepId[] ───→ Step ─── agentNames: string[] ──→ (.claude/agents/*)

Task ── workflowId ──→ Workflow
  └─ taskItemIds: TaskItemId[] ──→ TaskItem ── stepId ──→ Step
                                              └─ workflowId ──→ Workflow (편의 역참조)
```

- **모든 참조는 ID로만**. Step 본문이 Workflow JSON 안에 들어가지 않는다.
- Workflow의 **배열 순서가 실행 순서**다. 별도 `order` 정수 필드 없음 (정수 중복/싱크 버그 차단 — 원본 설계 유지).
- Task ↔ TaskItem 도 동일 원칙: Task 안에 `taskItemIds` 만 두고, TaskItem 본문은 별도 파일.

## 3. 모델 정의

### 3.1 ID 타입

```ts
export type WorkflowId = string;  // base64url ([A-Za-z0-9_-]+)
export type StepId     = string;
export type TaskId     = string;
export type TaskItemId = string;
```

모든 ID는 **파일명으로 쓸 수 있는 base64url 문자**만 허용 (`^[A-Za-z0-9_-]+$`). 외부 동기화·수동 편집을 신뢰 경계로 보고 path traversal 차단.

### 3.2 Step (독립)

```ts
export interface Step {
  readonly id: StepId;
  name: string;             // "API 레이어 개발"
  description: string;      // 분해 프롬프트에 주입될 책임 설명
  agentNames: string[];     // .claude/agents/{name}; 최소 1개
  tags?: string[];          // 검색·필터(선택)
  createdAt: number;        // epoch ms
  updatedAt: number;
}
```

- `Step`은 어느 Workflow에도 종속되지 않는다.
- **다중 에이전트** 매칭 가능 — 한 단계에서 병렬 검수 등을 위해 배열.
- Step 수정 시 영향 범위(이 Step을 참조하는 Workflow 목록)는 인덱스 조회로 보여줄 책임은 UI/서비스 레이어가 진다.

### 3.3 Workflow (독립)

```ts
export interface Workflow {
  readonly id: WorkflowId;
  name: string;
  description: string;
  tags?: string[];
  stepIds: StepId[];        // 실행 순서대로. 배열 인덱스 = 순서
  createdAt: number;
  updatedAt: number;
}
```

- `steps: Step[]` 대신 **`stepIds`만 보관**한다.
- 동일 Step을 두 Workflow가 공유해도 정의 드리프트가 없다.

### 3.4 Task (독립, 번들 단위)

```ts
export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";

export interface Task {
  readonly id: TaskId;
  readonly workflowId: WorkflowId;  // 분해 기준이 된 워크플로우
  requirement: string;              // 원본 요구사항 텍스트
  title: string;                    // 사용자가 부여한 짧은 라벨
  status: TaskStatus;               // 번들 전체 진행 상태(자식 집계 또는 사용자 설정)
  taskItemIds: TaskItemId[];        // 실행 순서대로
  createdAt: number;
  updatedAt: number;
}
```

- 한 요구사항 + 한 Workflow → 한 Task. Task가 곧 "분해 결과 묶음".
- TaskItem 본문은 임베드하지 않고 **`taskItemIds`만 보관** — 큰 프롬프트 본문이 Task JSON을 부풀리지 않게 한다.

### 3.5 TaskItem (독립, 실행 단위)

```ts
export type TaskItemStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface TaskItem {
  readonly id: TaskItemId;
  readonly taskId: TaskId;          // 소속 Task(역참조 — 고아 청소·조회 편의)
  readonly stepId: StepId;          // 어느 Step에서 파생되었나
  readonly workflowId: WorkflowId;  // 편의 역참조(스냅샷 시점 기준)
  name: string;
  description: string;
  prompt: string;                   // 에이전트에 그대로 전달될 본문
  agentName: string;                // 실행에 사용할 단일 에이전트 (Step.agentNames 중 1)
  dependsOn?: TaskItemId[];         // 명시되면 DAG, 없으면 배열 순서
  status: TaskItemStatus;
  sessionId?: string;               // 첫 실행 시 부여된 세션 UUID(후속 턴용)
  promptFilePath?: string;          // 실행 시 디스크에 쓴 임시 프롬프트 파일 경로
  output?: string;                  // 짧은 결과 요약
  artifactPath?: string;            // 큰 결과는 별도 파일
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
}
```

- **`prompt`는 TaskItem이 소유**. 실행 시 [코어 동작](./core-flow.md)대로 임시 파일에 써서 Claude CLI 인자로 넘긴다.
- `agentName`은 Step의 다중 에이전트 중 **이 항목이 실제 실행할 1개**를 확정한다 (다중 에이전트 Step은 동일 stepId의 TaskItem이 N개로 펼쳐진다).

## 4. 저장 레이아웃

[프로젝트별 저장 컨셉](./project-storage.md)에 따라 `<root>/.claude/workOS/` 밑.

```
<root>/.claude/workOS/
├── steps/
│   └── {stepId}.json          # 독립 Step
├── workflows/
│   └── {workflowId}.json      # Workflow (stepIds만 보관)
├── tasks/
│   └── {taskId}.json          # Task (taskItemIds만 보관)
├── task-items/
│   └── {taskItemId}.json      # TaskItem 본문
└── prompts/
    └── {taskItemId}-{ts}.md   # 실행 시 임시 프롬프트 (정리 정책: 일정 기간 후 삭제)
```

- 각 모델은 **자기 디렉토리에 1 파일 = 1 엔티티**로 저장한다. (목록 파일/인덱스 파일 없음 — 디렉토리 스캔이 권위 원본)
- 파일 충돌 시 자동 삭제 금지 (원본 ensure 정책 그대로).

## 5. 무결성 규약

| 규약 | 내용 |
|------|------|
| **참조는 ID만** | 어느 모델도 다른 모델의 본문을 임베드하지 않는다. |
| **불변 식별자** | `id`/외래 ID 필드는 `readonly`. 이름·설명이 바뀌어도 ID는 고정. |
| **순서 = 배열 순서** | 워크플로우의 Step 순서, Task의 TaskItem 순서 모두 배열 인덱스. |
| **삭제는 참조 검사 후** | Step/Workflow 삭제 시 참조 무결성 검사. 강제 삭제는 "참조 끊기" 동작과 분리. |
| **시간 기록** | 모든 모델에 `createdAt/updatedAt` (epoch ms). |
| **상태 기계는 단순** | TaskItemStatus는 5상태 폐쇄 집합. 임의 문자열 금지. |

## 6. 변경 시나리오로 보는 격리 효과

- **Step 이름 변경**: 해당 `{stepId}.json` 하나만 수정. 이를 참조하는 Workflow/TaskItem 파일은 무변경.
- **Workflow에서 Step 제거**: Workflow의 `stepIds`에서 ID만 제거. Step 본체와 다른 Workflow는 무영향.
- **Step 자체 삭제**: 참조 워크플로우가 있으면 거부 또는 dangling 경고. TaskItem의 `stepId`는 스냅샷이므로 과거 Task에는 영향 없음.
- **Task 재실행/재분해**: 새 TaskItem들을 만들고, 기존 TaskItem은 보존하거나 archive — Task JSON의 `taskItemIds` 만 갱신.

## 7. 검증·계약 위치 (구현 시)

- **렌더러 ↔ 메인** IPC 경계에서 zod 스키마로 검증 → `electron/contracts/{step,workflow,task,task-item}.ts`.
- 도메인 본체는 순수 TS 인터페이스로 두고, **fs/zod 등 부수효과는 service/repository 레이어**가 책임진다 ([CLAUDE.md 레이어 규약](../CLAUDE.md) 따름).

## 8. 1차 버전 단순화

- 선형(순차) Workflow만 지원 — `Workflow.stepIds`만 있고 조건 분기 없음.
- Step의 다중 에이전트는 **모델로는 허용**하되, UI에서는 1개 선택만 노출해도 무방.
- TaskItem `dependsOn`은 모델만 두고, 1차 실행기는 배열 순서로 단순 실행.

## 9. 한 줄 요약

**"Workflow · Step · Task · TaskItem 4개를 모두 독립 파일로 분리해 ID로만 묶고, 어느 한 쪽 수정이 다른 쪽을 깨지 않게 격리한다."**
