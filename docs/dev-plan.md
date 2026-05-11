# Muti CLI — 개발계획서 (Development Plan)

> 버전 0.1 / 작성일 2026-05-11 / 상태: 초안

연관 문서: [`spec.md`](./spec.md), [`ui-ux.md`](./ui-ux.md).

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 앱 셸 | Electron 30+ | 1차 타깃 Windows, 크로스 플랫폼 자연 지원 |
| 터미널 | xterm.js 5.x + `xterm-addon-fit` | 렌더러에서 동작 |
| PTY | `node-pty` 1.x | 메인 프로세스 전용, asar unpack 필요 |
| 패키징 | `electron-builder` 24+ | Windows NSIS / mac DMG / Linux AppImage |
| 언어 | JavaScript (ESM 미사용, Node CJS + script-tag 렌더러) | 번들러 없이 단순 유지 |
| 테스트 | `node --test` (Node 20+ 내장) | 메인 로직만 단위 테스트 |

> 번들러(webpack/vite) 도입은 비용 대비 효용이 낮아 보류한다. 렌더러는 `node_modules`의 UMD 파일을 `<script>` 태그로 직접 참조한다.

## 2. 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                  Electron Main Process                    │
│  - BrowserWindow 관리                                     │
│  - IPC 라우팅                                              │
│  - PTYManager (node-pty 세션 맵)                          │
│  - Store (state.json read/write, debounce)                │
│  - ShellRegistry (cmd/powershell/wsl 가용성 탐지)         │
└──────────────────────────────────────────────────────────┘
                ▲                        ▲
        IPC invoke/handle         IPC send/on
                │                        │
┌──────────────────────────────────────────────────────────┐
│  Preload (contextBridge: window.api)                      │
│  - api.state.{get,set}                                    │
│  - api.dialog.{pickFolder}                                │
│  - api.pty.{spawn,write,resize,kill,                      │
│             onData,onExit,defaultShell,listShells}        │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │
┌──────────────────────────────────────────────────────────┐
│  Renderer (DOM + xterm.js)                                │
│  - components/sidebar.js                                  │
│  - components/tabbar.js                                   │
│  - components/split.js (분할 트리 렌더)                   │
│  - components/terminal.js (xterm 인스턴스 관리)           │
│  - components/modals.js                                   │
│  - renderer.js (상태 컨테이너 + 라우팅)                   │
└──────────────────────────────────────────────────────────┘
```

원칙:
- 메인이 **상태의 단일 소스**. 렌더러는 변경을 `state:set`으로 통째 보낸다 (간단함 우선, 데이터가 작음).
- PTY 세션은 메인이 보유. 렌더러는 `id`로만 참조.
- 모든 IPC는 preload의 화이트리스트 API를 통해서만 노출.

## 3. IPC 인터페이스 명세

| 채널 | 방향 | 페이로드 | 반환 |
|---|---|---|---|
| `state:get` | invoke (R→M) | – | `State` 전체 |
| `state:set` | invoke (R→M) | `State` | `true` |
| `dialog:pickFolder` | invoke (R→M) | – | `string \| null` |
| `pty:defaultShell` | invoke (R→M) | – | `'cmd' \| 'powershell' \| 'bash' \| 'zsh'` |
| `pty:listShells` | invoke (R→M) | – | `Array<{ id, label, available }>` |
| `pty:spawn` | invoke (R→M) | `{ id, shell, cwd, env, cols, rows }` | `{ pid, shell, cwd }` |
| `pty:write` | send (R→M) | `{ id, data }` | – |
| `pty:resize` | send (R→M) | `{ id, cols, rows }` | – |
| `pty:kill` | send (R→M) | `{ id }` | – |
| `pty:data` | event (M→R) | `{ id, data }` | – |
| `pty:exit` | event (M→R) | `{ id, exitCode, signal }` | – |

## 4. 데이터 모델 (state.json)

```ts
type ShellId = 'cmd' | 'powershell' | 'wsl';

interface Pane {
  id: string;
  cwd: string | null;
  shell: ShellId | null; // null = 프로젝트 디폴트 사용
}

interface Split {
  type: 'split';
  dir: 'h' | 'v';     // h: 좌우, v: 상하
  ratio: number;       // 0.1 ~ 0.9
  a: PaneOrSplit;
  b: PaneOrSplit;
}

type PaneOrSplit = Pane | Split;

interface Tab {
  id: string;
  title: string;
  layout: PaneOrSplit;
  activePaneId: string;
}

interface Project {
  id: string;
  name: string;
  folder: string | null;
  defaultShell: ShellId;     // 1차 디폴트는 'cmd'
  tabs: Tab[];
  activeTabId: string | null;
}

interface State {
  schemaVersion: 1;
  projects: Project[];
  activeProjectId: string | null;
  window: { width: number; height: number; x: number | null; y: number | null; maximized: boolean };
}
```

저장 정책:
- 디바운스 250ms.
- `tmp` 파일에 쓴 뒤 `rename`으로 원자적 교체.
- `schemaVersion` 불일치 시 마이그레이션 함수에 위임 (없으면 백업 후 기본 상태로 시작).

## 5. 파일 구조 (목표)

```
src/
  main/
    main.js          # 창 생성, IPC 라우팅
    pty-manager.js   # node-pty 세션 맵
    store.js         # state.json 입출력, 디바운스 저장
    shells.js        # ShellRegistry (cmd/powershell/wsl 탐지)
  preload/
    preload.js       # contextBridge
  renderer/
    index.html
    styles.css
    renderer.js      # 상태 컨테이너, 라우팅
    components/
      sidebar.js
      tabbar.js
      split.js
      terminal.js
      modals.js
docs/
  spec.md
  ui-ux.md
  dev-plan.md
test/
  store.test.js
  shells.test.js
```

## 6. 마일스톤 (각 단계 = 1 PR, base = `main`)

| PR | 브랜치 | 핵심 결과물 | Definition of Done |
|---|---|---|---|
| PR-M0 | `claude/multi-cli-environment-J8Sj3` | docs 3종, scaffold revert | docs 3개 머지, 코드 변경 없음 |
| PR-M1 | `claude/m1-app-skeleton` | `package.json`, main/preload, 빈 창, store 골격 | `npm start` → 빈 다크 창, 종료 시 `state.json` 생성 |
| PR-M2 | `claude/m2-sidebar-projects` | 사이드바, 프로젝트 CRUD, 자동 저장/복원 | 프로젝트 추가/이름변경/삭제 후 재시작 시 복원 |
| PR-M3 | `claude/m3-tabs-and-pty` | 탭바, 단일 패널, node-pty 연결 | 탭 여러 개 열고 명령 실행 가능 |
| PR-M4 | `claude/m4-shell-selection` | shells.js 탐지, 사이드바 디폴트 셸 드롭다운, 프로젝트 저장 | cmd/PowerShell/WSL 셋 다 선택 가능, WSL 미설치 시 비활성 |
| PR-M5 | `claude/m5-split-panes` | 분할 트리 데이터 + 렌더, splitter 드래그 | 한 탭 안에서 2×2까지 분할/해제 |
| PR-M6 | `claude/m6-autosave-restore` | 디바운스 튜닝, 원자적 쓰기, 부팅 복원 보강 | 강제 종료 후 재실행해도 마지막 상태 복원, 손실 0 |
| PR-M7 | `claude/m7-windows-installer` | electron-builder NSIS 마무리, README 갱신 | `npm run dist:win` → `MutiCLI-Setup-x.y.z.exe` 정상 설치/실행 |

규칙:
1. 한 PR이 머지된 다음에야 다음 마일스톤 브랜치를 만든다.
2. 모든 PR 본문에 `Summary / Changes / Manual test plan / Linked spec section` 포함.
3. PR은 `mcp__github__create_pull_request`로 생성. 레포: `il-oong/muti_CLI`.

## 7. 셸 탐지(`shells.js`) 구현 방침

- `cmd`: `process.env.COMSPEC` 또는 `C:\Windows\System32\cmd.exe`. Windows에서 항상 가용.
- `powershell`: 우선순위 `pwsh.exe` → `powershell.exe`. `PATH` 또는 `%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` 존재 검사.
- `wsl`: `wsl.exe` 존재 검사. 미설치 시 `available: false`, UI에서 비활성화.
- macOS/Linux: `$SHELL` → fallback `/bin/bash`. (이번 사이클 검증 대상은 Windows.)

## 8. 테스트 전략

- **단위 테스트 (Node 내장 `node:test`)**
  - `store.test.js`: 상태 로드/저장, 마이그레이션, 원자적 쓰기.
  - `shells.test.js`: 셸 탐지 결과 모킹 (filesystem stub).
- **수동 체크리스트**: `spec.md`의 시나리오 A/B/C를 매 마일스톤 PR 본문에 첨부, 직접 따라가며 OK 체크.
- **CI**: 이번 사이클은 도입 보류(향후 단계). 로컬에서 `npm test` 통과 확인.

## 9. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| `node-pty` 네이티브 빌드 실패 | 신규 사용자 진입 장벽 | README에 사전 요건 명시(VS Build Tools + Python). 향후 prebuilt 바이너리 활용 검토 |
| PowerShell 실행 정책 차단 | PowerShell 셸이 빈 창처럼 보임 | 첫 실행 시 `Get-ExecutionPolicy` 결과 감지 후 안내 메시지 |
| WSL 미설치 환경에서 사용자 혼동 | 드롭다운에서 선택 시 실패 | 가용성 탐지 후 비활성 상태로 표기, 라벨에 `(설치되지 않음)` 부기 |
| state.json 손상 | 모든 프로젝트 손실 | 원자적 쓰기 + 손상 감지 시 `state.broken-YYYYMMDD.json`로 백업 후 기본 상태로 시작 |
| 탭 30개 시 메모리 과다 | 사용 불가 | 비활성 탭의 xterm은 dispose 후 출력은 ring buffer로 보존 — v2 과제 |

## 10. 배포

- 산출물: `dist/MutiCLI-Setup-<version>.exe` (NSIS).
- 옵션: 설치 경로 변경 가능, 바탕화면 및 시작 메뉴 단축키 생성.
- 코드 사인: v1 보류 (사용자에게 SmartScreen 경고 안내).
- 자동 업데이트: v1 보류, 차기 인스톨러 수동 실행.
