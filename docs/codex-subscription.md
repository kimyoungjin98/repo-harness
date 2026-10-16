# Codex 구독 계정의 GitHub 작업 자동화

## 적용 범위

- ChatGPT 구독으로 로그인한 Codex CLI를 사용하며 OpenAI API 키는 사용하지 않음
- 비공개 GitHub 저장소와 신뢰할 수 있는 전용 Linux self-hosted runner에만 적용. 공개·오픈소스 저장소에서는 실행하지 않음
- 이 베이스에는 배포용 템플릿만 포함. 파일 복사와 필수 설정 확인 후 대상 프로젝트의 기본 브랜치에 반영해야 실행됨
- 공식 Codex 문서의 고급 CI/CD 인증 절차를 적용. 구독 계정의 Codex 사용 권한과 사용량 제한이 적용되며, 무제한 실행이나 인증의 영구 유지를 보장하지 않음
- 공개 프로젝트에서 PR 후속 작업만 필요한 경우 Codex GitHub 연동의 `@codex 수정 요청` 사용을 검토. 이 템플릿의 `/codex`와 별도 기능이며, 이슈에서 PR까지 자동 생성하는 템플릿으로 대체하지 않음

## 구성 시 사용 여부 확인

- 하네스 최초 구성과 선택 기록이 없는 갱신에서는 실행 승인 질문과 같은 시작 단계에서 이슈 → GitHub Actions → 구현·검증 → PR 생성과 PR 코멘트 후속 수정 흐름을 안내하고 `함께 구성` / `구성하지 않음`을 반드시 질문. 비공개 GitHub 저장소와 전용 Linux 러너·구독 로그인 유지 조건을 함께 설명. 준비 미완료나 workflow 파일 부재를 이유로 질문을 생략하지 않음
- 사용자가 `함께 구성`을 선택하면 같은 하네스 구성 작업에서 준비 상태 확인과 템플릿 배치를 바로 진행. 이미 자동화 구성을 요청한 경우에도 바로 진행하며 별도 요청이나 단계별 재승인을 요구하지 않음
- 필수 조건이 부족하면 가능한 준비를 진행하고 부족한 항목과 필요한 조치를 모아서 안내. 준비 대기와 실제 적용·실행 완료를 구분하며, 사용자 로그인이나 환경 승인이 필요한 단계는 해당 절차 적용
- `구성하지 않음`을 명시적으로 선택하면 실제 답변과 근거를 `project.md`에 기록하고 하네스 구성을 계속 진행. 답변 전에는 선택 대기로 보고하며 하네스 문서·상태 적용과 구성·갱신 완료 처리 보류. 현재 권한 안의 독립적인 조사는 가능하며 이미 확정한 실행 승인 설정은 해당 절차로 반영 가능
- 질문 도구가 없거나 응답 수신이 불가하면 일반 메시지로 질문하고 답변을 기다림. 질문 도구 호출, 미응답·질문 중단·대기 시간 경과를 미사용으로 처리하지 않으며 기존 workflow나 답변 근거 없는 미사용 기록만으로 선택을 확인한 것으로 처리하지 않음
- 갱신 시 기존 자동화와 답변 근거가 있는 선택을 유지. 선택 기록이 없거나 미확정이면 시작 단계에서 질문하고, 명시적인 미사용 선택은 반복 질문하지 않음. 사용자가 선택 변경을 요청하면 해당 요청 적용. 완료 보고에 자동화 선택·근거·적용 상태를 함께 표시

## 작업 흐름

| 요청 | 처리 |
| --- | --- |
| 쓰기 권한이 있는 사용자가 이슈 작성 | 이슈 분석 → Worktree 준비 → 구현·검증 → `feature/codex-issue-번호` push → PR 생성 |
| 이슈에 `codex` 라벨 추가 또는 `/codex 요청 내용` 코멘트 | 같은 작업 브랜치와 열린 PR을 이어서 작업. 라벨 재사용 시 제거 후 다시 추가 |
| 생성된 PR의 일반 코멘트에 `/codex 요청 내용` 작성 | 원본 이슈와 PR·최근 코멘트를 확인하고 같은 PR 브랜치에 수정 반영 |
| 구현·검증 완료 | PR 링크와 결과 기록 후 설정된 Discord 또는 Slack에 알림 |
| 질문 필요·검증 실패·실행 오류 | 실패 또는 보류 코멘트와 Actions 실패 기록. Worktree를 보존하고 완료로 처리하지 않음 |

- 일반 코멘트만 작성하거나 `@codex`를 사용한 경우 이 템플릿은 실행하지 않음. `/codex`는 코멘트 첫 부분에서 시작하며, 명령만 작성하면 기존 이슈·PR 문맥으로 작업
- admin·maintain·write 권한을 현재 API로 확인. 외부 사용자, 봇, 읽기 권한 사용자는 실행하지 않음
- 같은 저장소의 열린 `feature/codex-issue-번호` PR만 수정. fork PR과 닫히거나 merge된 PR은 작업하지 않음
- 이슈 하나의 작업 PR은 한 개만 유지. PR이 종료된 뒤 새로운 작업이 필요하면 새 이슈로 요청
- 작업마다 최신 원격 SHA를 확인하고 일반 push 사용. 원격 변경과 충돌하면 실패로 보고하며 강제 push하지 않음
- 완료 코멘트의 요청 식별자로 같은 이벤트의 재실행을 생략. 실패한 작업은 보존된 상태를 확인한 뒤 재요청하며, 완료 후 알림만 실패했다면 수신 여부 확인 후 수동 재전송
- 최근 일반 코멘트 50개와 현재 요청을 전달. PR 요청에는 브랜치 이름으로 찾은 원본 이슈 본문도 포함. 이전 Codex 세션을 복원하는 방식은 아님
- PR의 Conversation에 일반 코멘트로 요청. 코드 줄의 수정은 파일·줄 위치를 요청 본문에 작성. 기본 브랜치의 workflow로 실행되는 `issues`·`issue_comment` 이벤트 사용

## 템플릿 배치

하네스의 Git·PR·Webhook 필수 연동 조건을 먼저 확인한다. 베이스 자체의 템플릿 제작과 대상 프로젝트의 실제 적용·실행 검증을 구분한다.

| 스킬에 포함된 원본 | 대상 프로젝트 위치 |
| --- | --- |
| `assets/codex-subscription/workflow.yml` | `.github/workflows/codex-subscription.yml` |
| `assets/codex-subscription/automation.mjs` | `.github/codex/automation.mjs` |
| `scripts/notify.mjs` | `scripts/harness-notify.mjs` |

- 기존 파일은 덮어쓰지 않음. 기존 전송 도구가 있으면 `automation.mjs`의 알림 실행 부분만 해당 도구에 맞게 조정하고 변경 근거 기록
- 설치한 템플릿의 프로젝트 루트 기준 경로와 실제 SHA-256을 `.harness-state/state.json`의 `installed_templates`에 기록. 사용자 조정이 끝난 결과의 해시 사용
- 갱신 시 기록된 해시와 현재 파일이 다르면 사용자 변경으로 보존. 파일 내용이 같을 때만 새 템플릿 적용
- 워크플로우와 제어 스크립트는 기본 브랜치에서 읽음. 작업 PR이 자동화 코드를 바꿔 실행 절차를 바꾸지 않도록 `.github/workflows/`와 `.github/codex/` 변경은 자동 반영에서 제외하며 별도 수동 검토
- 설치된 [브랜치 전략](./git-branch.md)과 `project.md`를 확인. 템플릿의 원격 작업 브랜치 규격이 기존 정책과 다르면 명시적인 override로 기록하고 `branchPattern` 및 브랜치 생성 부분을 함께 조정

## 러너와 구독 인증 준비

1. 대상 비공개 저장소의 Settings → Actions → Runners에서 전용 Linux 러너 한 개를 등록하고 `codex-subscription` 라벨 지정
2. 해당 러너 서비스 계정에서 Git, Node.js 20 이상, Bash, Codex CLI와 프로젝트 검증에 필요한 도구 준비. 설치한 버전과 PATH를 `project.md`에 기록
3. 러너의 저장소 밖 전용 Codex 설정에 `cli_auth_credentials_store = "file"`을 지정하고 해당 서비스 계정으로 `codex login` 실행
4. 로그인 파일의 `auth_mode`가 `chatgpt`이고 refresh token이 있는지 값 노출 없이 확인. 러너 서비스가 같은 사용자와 영구 저장 경로를 사용하는지 확인
5. 러너에서 로그인할 수 없으면 신뢰할 수 있는 컴퓨터에서 해당 러너용으로 로그인한 파일을 안전하게 전달. 같은 인증 사본을 여러 컴퓨터나 동시 작업에서 사용하지 않음

러너 전용 설정 예시:

```toml
cli_auth_credentials_store = "file"
```

```bash
codex login
codex login status
codex --version
```

- 기본 위치는 러너 서비스 계정의 `~/.codex/`. 기존 러너 서비스에 `CODEX_HOME`이 설정되어 있으면 해당 영구 경로를 재사용. 템플릿은 사용자 전역 설정을 변경하지 않음
- `auth.json` 원문을 저장소, 코멘트, 로그, Actions artifact나 cache에 저장하지 않음. 최초 파일을 매 실행마다 덮어쓰지 않고 Codex가 갱신한 파일을 유지
- 해당 인증을 쓰는 러너는 한 개만 사용하고 다른 워크플로우·저장소와 공유하지 않음. 러너의 작업 대기열로 직렬 실행하며, 대기 중인 후속 요청을 대체할 수 있는 Actions concurrency 설정은 추가하지 않음
- 구독 인증이 해제되거나 갱신에 실패하면 작업을 실패로 기록. 러너 계정에서 다시 로그인 후 재요청
- Codex는 `workspace-write`, 승인 요청 없음, 작업용 네트워크 허용으로 실행. 필요한 설치·테스트 권한은 러너에서 미리 준비하며, 실행 환경에서 거부한 권한을 템플릿이 우회하지 않음
- GitHub 토큰, API 키, Webhook과 입력 secret 관련 환경변수는 Codex와 검증 명령에 전달하지 않음. 전용 러너와 신뢰할 수 있는 코드 사용 조건을 대체하는 격리 기능은 아님

## GitHub 설정

Settings → Secrets and variables → Actions에서 다음 설정을 준비한다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `CODEX_BASE_BRANCH` | 프로젝트에서 확인한 작업 기준 브랜치. 기존 `develop` 등을 유지. 미지정 시 원격 기본 브랜치 |
| Variable | `CODEX_VERIFY_COMMAND` | 프로젝트 루트에서 실행할 필수 검증 명령. 예: 기존 package.json에 정의된 lint·테스트·빌드 명령. 빈 값은 실행 실패 |
| Variable | `CODEX_NOTIFY_PROVIDER` | `discord` 또는 `slack` |
| Secret | `DISCORD_WEBHOOK_URL` 또는 `SLACK_WEBHOOK_URL` | 선택한 서비스의 승인된 전송 대상 URL |

- OpenAI API 키나 `CODEX_AUTH_JSON` Secret은 필요 없음. 구독 로그인 정보는 전용 러너가 영구 보관
- GitHub의 `GITHUB_TOKEN`은 저장소 접근용 인증이며 OpenAI API 키와 별개. 템플릿이 쓰기·PR·코멘트 권한을 선언하고 작업 단계에서만 사용
- Settings → Actions → General → Workflow permissions의 **Allow GitHub Actions to create and approve pull requests** 활성화 여부 확인. 조직 정책이 차단하면 관리자 조치 필요. 템플릿은 PR을 승인하거나 merge하지 않음
- 토큰으로 만든 이벤트의 후속 CI 실행·승인 요구는 GitHub 설정에 따라 확인. 템플릿이 PR을 만들었다는 이유로 별도 CI 통과를 보장하지 않음. `CODEX_VERIFY_COMMAND`는 PR 생성·갱신 직전에 실제 실행
- workflow 설치와 필수 설정 준비는 사용자의 기본 브랜치 merge 후 유효. 러너 등록, 로그인, Secret 설정과 정책 변경은 템플릿 제작만으로 완료 처리하지 않음
- 기존 CI가 actionlint를 사용하면 해당 설정의 `self-hosted-runner.labels`에 `codex-subscription` 추가. 기존 라벨과 설정은 보존

## CI 작업 권한

- 자동화가 Worktree와 작업 브랜치를 준비·확인하고 Codex는 그 안에서 구현·검증만 실행. 커밋·push·PR·결과 코멘트·알림은 제어 스크립트가 처리
- 이 방식은 템플릿을 선택한 프로젝트에서 CLI의 직접 커밋·PR 실행 부분을 대체. 기존 프로젝트의 작업 범위 제한과 merge·배포 권한은 유지
- 같은 작업은 원격 브랜치와 PR을 재사용. 보존된 깨끗한 Worktree는 원격 SHA까지 fast-forward할 수 있을 때 재사용. 미커밋 변경이나 원격에 없는 커밋은 덮어쓰지 않고 운영자가 확인
- 성공적으로 원격 반영하고 작업 공간이 깨끗한 경우에만 자동 생성 Worktree 정리. 실패 시 경로와 브랜치를 보존
- 검증 명령을 제어 스크립트가 다시 실행하고, Codex가 필수 검증 미완료를 보고하면 publish를 보류. 변경이 없으면 불필요한 커밋이나 새 PR 없이 결과만 기록
- runner timeout·프로세스 중단에서는 실패 코멘트를 남기지 못할 수 있음. Actions 실패 상태와 러너의 Worktree를 함께 확인

## 적용 검증

1. 러너·인증·Git·PR·Webhook 설정의 준비 상태 확인. 이 단계에서 인증 시험용 PR이나 알림을 임의 전송하지 않음
2. 기본 브랜치에 파일 반영 후, 실제 실행 검증을 요청한 비공개 테스트 저장소에서 쓰기 권한 사용자의 이슈로 PR 생성 확인
3. 해당 PR의 Conversation 코멘트에서 `/codex` 요청. 같은 PR에 새 커밋이 추가되는지 확인
4. 검증 실패, 읽기 권한 사용자, 봇, fork PR, 종료된 PR, 중복 실행, 원격 충돌, 인증 만료와 알림 실패 확인
5. [하네스 평가](./evaluation.md)에 따라 실제 실행한 결과와 미실행 항목을 구분하여 기록

공식 기준: [Codex CI/CD 구독 인증](https://learn.chatgpt.com/docs/auth/ci-cd-auth), [Codex 비대화형 실행](https://learn.chatgpt.com/docs/non-interactive-mode), [Codex GitHub 연동](https://developers.openai.com/codex/integrations/github), [GitHub 이벤트](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [GitHub Actions 토큰](https://docs.github.com/en/actions/concepts/security/github_token).
