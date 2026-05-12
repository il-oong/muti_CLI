# Muti CLI

Windows에서 여러 CLI를 **프로젝트 단위**로 묶어서 한 창에서 다루는 데스크톱 앱. Electron + xterm.js + node-pty 기반. 모든 상태는 자동 저장되어 앱을 껐다 켜도 이어집니다.

기능
- 사이드바: 프로젝트 추가/이름변경/폴더 변경/삭제
- 탭바: 한 프로젝트 안에 여러 터미널 탭
- 셸 선택: cmd / PowerShell / WSL (미설치 시 자동 비활성화)
- 탭 분할: 한 탭 안에서 좌우/상하로 패널 분할 (최대 2×2)
- 자동 저장 + 복원: 강제 종료에도 마지막 5초 이내 상태 유지

---

## 빠르게 실행하기 (개발 모드)

### 1. 사전 요구사항

| 항목 | 메모 |
|---|---|
| Node.js | 20 이상 권장 (https://nodejs.org/) |
| Python 3 | `node-pty` 빌드용 |
| Visual Studio Build Tools | "Desktop development with C++" 워크로드 (Windows 한정) |

> macOS는 `xcode-select --install`, Linux는 `build-essential`로 대체.

### 2. 의존성 설치 + 실행

```bash
git clone https://github.com/il-oong/muti_CLI.git
cd muti_CLI
npm install
npm start
```

`npm install` 마지막에 `electron-builder install-app-deps`가 자동 실행되어 `node-pty`가 Electron의 Node 버전에 맞게 다시 빌드됩니다.

### 3. 첫 사용

1. 좌측 상단 **＋** 또는 빈 화면 CTA로 새 프로젝트 만들기
2. 이름 입력 → 폴더 선택 → 자동으로 첫 터미널이 열림
3. 탭바 우측 **＋** 로 새 탭, **⊟▢** / **⊟▭** 로 좌우/상하 분할
4. 사이드바 하단의 `셸:` 드롭다운으로 cmd/PowerShell/WSL 전환 (다음 새 탭부터 적용)
5. 종료했다가 다시 `npm start` → 마지막 상태 그대로 복원

---

## 설치 파일(.exe) 만들기 — Windows

```bash
npm run dist:win
```

`dist/MutiCLI-Setup-0.1.0.exe` 가 생성됩니다. 더블 클릭하면 일반 프로그램처럼 설치되고, 바탕화면/시작 메뉴 단축키가 만들어집니다. 코드 사이닝이 되어 있지 않아 SmartScreen에서 "추가 정보 → 실행"이 필요할 수 있습니다.

크로스 플랫폼

```bash
npm run dist:mac     # macOS DMG
npm run dist:linux   # Linux AppImage
npm run dist         # 현재 OS 기준
npm run pack         # 설치 파일 없이 디렉토리 묶음만 (디버깅용)
```

---

## 저장 위치

- Windows: `%APPDATA%/Muti CLI/state.json`
- macOS: `~/Library/Application Support/Muti CLI/state.json`
- Linux: `~/.config/Muti CLI/state.json`

손상되면 같은 폴더에 `state.json.broken-YYYYMMDD.json` 으로 백업되고 기본 상태로 시작합니다.

---

## 테스트

```bash
npm test
```

`store` / `shells` / `layout` 메인 로직 단위 테스트 29개 케이스.

---

## 폴더 구조

```
src/
  main/{main.js, pty-manager.js, store.js, shells.js}
  preload/preload.js
  renderer/{index.html, styles.css, renderer.js, modal.js, layout.js}
docs/
  spec.md      # 기획서
  ui-ux.md     # UI/UX 계획
  dev-plan.md  # 개발계획 + 마일스톤 / PR 표
  RULES.md     # 작업 규칙 (CLAUDE.md / AGENTS.md가 가리키는 정본)
test/{store.test.js, shells.test.js, layout.test.js}
```

---

## 알려진 제약

- 셸 자체의 출력 히스토리는 복원되지 않습니다 (OS 레벨에서 불가). 셸은 같은 작업 폴더에서 다시 시작됩니다.
- 단일 윈도우만 지원합니다 (다중 윈도우는 v2).
- 자동 업데이트 없음 — 새 인스톨러를 받아 다시 설치해야 합니다.
