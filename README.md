# Muti CLI

여러 개의 터미널(cmd / PowerShell / bash)을 **프로젝트 단위**로 묶어서 한 창에서 다루는 데스크톱 앱입니다. Electron + xterm.js + node-pty 기반이며, 작업 상태(프로젝트·탭·작업 폴더·창 크기)는 **자동 저장**되어 앱을 껐다 켜도 이어집니다.

## 주요 기능

- 사이드바: 프로젝트 목록 (이름 + 작업 폴더)
- 탭바: 프로젝트별 여러 개의 터미널 탭
- 셸: Windows는 `cmd.exe`, macOS/Linux는 `$SHELL` 자동 사용
- 자동 저장: `state.json`에 250ms 디바운스로 저장 (`%APPDATA%/Muti CLI/state.json`)
- 자동 복원: 마지막으로 본 프로젝트·탭·작업 폴더·창 크기·위치 복원
- 설치형 배포: Windows NSIS 인스톨러 / macOS DMG / Linux AppImage

> 참고: 실제 셸 출력의 스크롤백 버퍼는 복원되지 않고, **셸을 같은 작업 폴더에서 다시 띄우는** 방식으로 이어집니다. (셸 프로세스 상태를 그대로 보존하는 건 OS상 불가능합니다.)

## 개발 환경 실행

```bash
npm install
npm start
```

> `node-pty`는 네이티브 모듈이라 빌드 도구가 필요합니다.
> - **Windows**: Visual Studio Build Tools (Desktop C++) + Python 3
> - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
> - **Linux**: `build-essential`, `python3`

## 설치 파일(.exe) 만들기 — Windows

```bash
npm run dist:win
```

`dist/MutiCLI-Setup-<version>.exe` 가 만들어집니다. 더블 클릭하면 일반 프로그램처럼 설치되고, 시작 메뉴/바탕화면 단축키가 생성됩니다.

크로스 플랫폼:

```bash
npm run dist       # 현재 OS 기준으로 빌드
```

## 사용법

1. 사이드바 상단 **＋** 로 프로젝트 생성 → 이름 입력 → 작업 폴더 선택
2. 탭바 우측 **＋** 로 같은 프로젝트 안에 터미널을 더 엽니다
3. 프로젝트를 클릭해 전환하면 해당 프로젝트의 탭들이 보입니다
4. 탭 이름 더블클릭으로 이름 변경, **×** 로 닫기
5. 사이드바의 활성 프로젝트에 표시되는 `이름변경 / 폴더 / 삭제` 버튼으로 프로젝트 관리

모든 변경은 즉시 자동 저장됩니다. 앱을 다시 열면 마지막 상태에서 이어집니다.

## 폴더 구조

```
src/
  main/
    main.js          # Electron 메인 프로세스, IPC, 창 생성
    pty-manager.js   # node-pty 세션 관리
    store.js         # state.json 로드/저장
  preload/
    preload.js       # contextBridge 로 안전한 API 노출
  renderer/
    index.html
    renderer.js      # 사이드바/탭바/터미널 UI 로직
    styles.css
```

## 상태 파일 위치

- Windows: `%APPDATA%/Muti CLI/state.json`
- macOS:   `~/Library/Application Support/Muti CLI/state.json`
- Linux:   `~/.config/Muti CLI/state.json`
