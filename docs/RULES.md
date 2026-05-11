# Muti CLI — Repository Rules (정본)

> 이 파일은 이 레포에서 작업하는 **모든 자동화 에이전트(Claude Code, Codex CLI, Cursor, Aider 등)와 사람 협업자**가 따라야 할 규칙의 정본이다. `CLAUDE.md`, `AGENTS.md`, `.cursorrules` 등은 모두 이 파일을 가리키는 포인터다.
>
> 변경은 PR로만. 규칙 자체를 바꿀 때도 일반 코드 변경과 동일한 PR 절차를 따른다.

## 0. 작업 시작 전 필수 행동

자동화 에이전트는 어떤 변경이라도 시작하기 전에 다음을 **반드시** 수행한다.

1. 이 파일(`docs/RULES.md`)을 읽는다.
2. `docs/spec.md`, `docs/ui-ux.md`, `docs/dev-plan.md` 중 변경과 관련된 섹션을 읽는다.
3. 변경이 위 문서의 합의된 범위(특히 `spec.md` §4 P0/P1/P2)를 벗어난다면 작업을 멈추고 사용자에게 먼저 확인을 요청한다.
4. 마일스톤 순서(`dev-plan.md` §6)와 충돌하는 작업이라면 사용자 승인 후 진행한다.

## 1. 브랜치·PR 전략

- 브랜치는 항상 **`main`에서 분기**.
- 마일스톤 브랜치명: `claude/mN-<short-slug>` (예: `claude/m1-app-skeleton`).
- 그 외 메타 작업: `claude/<topic>` (예: `claude/repo-rules`).
- 한 PR = 한 마일스톤 또는 한 응집된 변경. 큰 변경은 쪼갠다.
- **이전 PR이 머지된 다음에야** 다음 마일스톤 브랜치를 만든다 (stacked PR 금지, base는 항상 `main`).
- `main`에 직접 push 금지. force push 금지.

## 2. PR 본문 양식

모든 PR은 다음 4개 섹션을 포함한다:

```md
## Summary
무엇을 왜 바꿨는지 2~3줄.

## Changes
- 파일/모듈별 변경 핵심 (불릿).

## Linked Spec Section
- docs/spec.md §X, docs/ui-ux.md §Y, docs/dev-plan.md §Z

## Manual Test Plan
- [ ] 체크박스로 손으로 따라갈 수 있는 검증 단계
```

## 3. 커밋 컨벤션

- Conventional Commits 스타일: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `revert:`.
- 제목 ≤ 70자, 명령형(영문).
- 본문(필요 시)에는 **이유**를 적는다 (무엇을 바꿨는지는 diff가 말한다).
- 비밀 정보(.env, 키 등) 커밋 금지.
- `git add -A` 보다 명시적 파일 add 선호.

## 4. 코드 스타일

- 언어: JavaScript (CommonJS).
  - `src/main/**`, `src/preload/**`: Node CJS.
  - `src/renderer/**`: 번들러 없이 `<script>` 태그 + UMD. ESM `import` 사용 금지.
- 들여쓰기 2 spaces. 따옴표는 single. 세미콜론 사용.
- 주석은 **WHY가 비자명할 때만**. WHAT 주석 금지.
- 죽은 코드/사용처 없는 export 삭제. 백워드 호환 셔임 추가 금지.
- 외부 입력(파일/IPC) 경계에서만 검증. 내부 호출은 신뢰.

## 5. IPC·아키텍처

- 새 IPC 채널은 `docs/dev-plan.md` §3 표에 먼저 추가하고 PR 본문에 링크.
- preload의 `window.api` 화이트리스트 밖으로 노출하지 않는다.
- `nodeIntegration: false`, `contextIsolation: true` 유지.

## 6. 데이터 스키마

- `state.json` 스키마 변경 시:
  1. `docs/dev-plan.md` §4의 타입 정의를 동일 PR에서 갱신.
  2. `schemaVersion`을 1 증가.
  3. `src/main/store.js`에 마이그레이션 함수 추가.
  4. 손상 감지 시 `state.broken-YYYYMMDD.json`로 백업 후 기본값 시작 정책 유지.

## 7. 테스트

- 메인 로직(`store`, `shells`, 분할 트리 등)은 `node --test` 단위 테스트 추가.
- 렌더러는 수동 체크리스트로 검증 — `spec.md` 시나리오 A/B/C를 PR 본문에 옮겨 체크.
- 테스트가 깨진 채로 PR 머지 금지.

## 8. 위험·파괴적 행동

다음은 사용자 명시적 승인 없이는 금지:

- `git push --force`, `git reset --hard <원격>`, 머지된 커밋 amend.
- 의존성 메이저 업그레이드/다운그레이드.
- `--no-verify` 등 훅 우회.
- `state.json` 등 사용자 데이터 파일 삭제.
- 외부 서비스(원격 API, Slack 등)로의 전송.

## 9. UI/UX 변경

- `docs/ui-ux.md`의 와이어프레임·플로우와 일치하지 않는 UI 변경은 먼저 해당 문서를 PR로 갱신한다.
- 디자인 토큰(§5)을 우회한 하드코딩 색상/사이즈 금지.

## 10. 마일스톤 진행 규칙

`docs/dev-plan.md` §6 표가 마스터다. 표 외 작업을 끼워 넣고 싶다면:

1. 별도 PR로 표를 먼저 갱신해 합의.
2. 그 다음 구현 PR을 연다.

## 11. 자동화 에이전트 추가 지시

- 모든 추측은 사실로 보고하지 말 것. 검증되지 않은 작동은 "수동 확인 필요"로 명시.
- 큰 리팩터·추상화는 작업 범위 밖이면 손대지 말 것 (요청된 변경에 한정).
- 한 PR 안에서 무관한 변경 섞기 금지.
