# Repository Harness

프로젝트의 기존 기술과 규칙을 분석하여 AGENTS.md와 하네스 문서를 구성하는 스킬.

개발자는 업무를 요청하고 PR을 검토한다. 에이전트는 별도 Worktree와 작업 브랜치를 준비하고, 정해진 권한 안에서 구현·검증·커밋·push·PR 작성까지 진행하며, 이미 허용된 작업을 단계마다 다시 묻지 않는다. 프로젝트별 규칙을 우선하고 merge와 배포는 별도 요청으로 처리한다. 상세 기준은 [목표와 작업 권한](./docs/main.md#목표와-작업-권한) 참고.

## 준비물

- 설치 : Node.js와 npm/npx, Git CLI, 저장소에 접근 가능한 네트워크
- 실행 : 사용할 AI Agent CLI와 필요한 계정 인증, 대상 프로젝트의 파일 쓰기 권한
- 필수 Git 연동 : Git CLI, 대상 저장소와 원격, Git 원격 인증, 호스팅 서비스의 PR 생성 권한
- 필수 알림 연동 : Discord 또는 Slack 중 하나의 Webhook 설정, 전송 대상·권한, PR 알림을 실행할 전송 경로
- 기획 수정 및 배포 : Python 3와 이 저장소. 배포된 스킬을 사용하는 사람은 Python이나 원본 저장소가 필요하지 않음

Git과 Webhook 연동은 구성·갱신 전 필수 조건이다. 문서 구성만 요청해도 생략하지 않으며, 미준비 또는 미확인 항목이 있으면 필요한 조치를 안내하고 준비 대기로 처리한다. 상세 기준은 [시작하기 전](./docs/main.md#시작하기-전) 참고.

Codex 최초 구성과 선택 기록 없는 갱신은 실행 승인 방식을 첫 질문으로 확인한다. 기존 설정 유지·승인 자동 검토·전체 권한의 효과와 변경 범위를 안내하고 명시적 답변 전에는 파일 수정과 명령별 승인 요청을 진행하지 않는다. 미응답은 선택 대기로 처리하며 구성 완료로 보고하지 않는다. 상세 기준은 [실행 승인 설정](./docs/main.md#codex-실행-승인-설정) 참고.

이슈·PR·GitHub Actions 자동화는 전용 `auth.json`과 인증 저장 방식에 필요한 GitHub 갱신용 토큰, 조직·저장소의 PR 생성 허용, `main` 등 실제 기본 브랜치의 workflow 반영까지 확인한다. 등록 위치와 준비·반영·실행 완료 기준은 [Actions flow 필수 준비](./docs/codex-subscription.md#actions-flow-필수-준비) 참고.

## 설치와 사용

대상 프로젝트에서 실행한다. Node.js와 npx가 필요하다.

```bash
npx skills add kimyoungjin98/repo-harness --skill repository-harness --agent codex -y
```

설치 후 에이전트에게 요청한다.

```text
$repository-harness 이 프로젝트에 하네스를 구성해줘.
```

- 다른 에이전트는 `--agent` 값을 해당 에이전트 이름으로 변경
- 여러 프로젝트에서 사용할 전역 설치는 `-g` 추가
- 스킬에 규칙이 포함되므로 원본 저장소를 별도로 내려받을 필요 없음
- `skills add`는 스킬을 설치하는 명령. 프로젝트의 하네스 문서 작성은 에이전트에게 구성 요청 시 진행
- GitHub 설치 명령은 이 스킬과 생성된 규칙이 원격 저장소에 반영된 이후 사용 가능
- 별도 npm 패키지 배포나 skills.sh 등록 신청 없이, Skills CLI가 GitHub 저장소의 `SKILL.md`를 찾아 설치

CLI 옵션은 [공식 Skills CLI 문서](https://github.com/vercel-labs/skills) 참고.

## 설치 없이 에이전트 시작

스킬을 전달한 상태로 Codex를 시작하려면 대상 프로젝트에서 실행한다. Codex가 설치되고 사용 가능한 환경이 필요하다.

```bash
npx skills use kimyoungjin98/repo-harness --skill repository-harness --agent codex
```

열린 에이전트 세션에서 현재 프로젝트의 하네스 구성을 요청한다. 이 방식은 스킬을 임시로 내려받아 사용하며 영구 설치하지 않는다.

## 갱신

공통 규칙은 `docs/harness/`에 한 벌만 두고 프로젝트별 차이는 `overrides/`와 `project.md`에 기록한다. `.harness-state/state.json`에는 경로와 해시만 저장하며 `baseline/`과 `agents-block.md`는 생성하지 않는다.

설치한 스킬을 갱신한 뒤 에이전트에게 기존 하네스 갱신을 요청한다.

```bash
npx skills update
```

```text
$repository-harness 최신 규칙으로 하네스를 갱신하고 프로젝트별 수정은 유지해줘.
```

설치 도구가 관리하는 `skills-lock.json`은 실제 설치 버전에 맞춰 함께 반영한다. 스킬 버전 갱신과 프로젝트 문서 갱신은 별개이며, 설치 문서가 바뀌기 전에는 하네스 상태의 설치 해시를 바꾸지 않는다. 갱신도 별도 Worktree에서 진행하고 기존 기준 브랜치·override·AGENTS.md 연결을 유지한다.

구형 설치는 프로젝트별 수정 보존을 확인한 뒤 기준 사본을 제거하는 구조로 전환한다. 스킬 업데이트만으로 대상 프로젝트의 기존 파일이 변경되는 것은 아니다.

## Discord·Slack 알림

[공용 전송 스크립트](./skills/repository-harness/scripts/notify.mjs)가 스킬에 포함된다. 기존 전송 도구가 없으면 하네스 구성 시 `scripts/harness-notify.mjs`로 배치한다. Node.js 20 이상이 필요하며 추가 패키지 설치는 없다.

선택한 서비스의 `DISCORD_WEBHOOK_URL` 또는 `SLACK_WEBHOOK_URL`을 실행 환경에 설정한 뒤 대상 프로젝트에서 사용한다. `.env`는 자동으로 읽지 않는다.

```bash
# 설정 검사만 수행 (Slack은 --provider slack)
node scripts/harness-notify.mjs --provider discord --message "설정 확인" --dry-run

# PR 알림 본문 확인 (Webhook 설정 없이 전송 전 미리보기)
node scripts/harness-notify.mjs --provider discord --pr-file /tmp/pr-notification.json --preview

# 실제 PR 알림 전송
node scripts/harness-notify.mjs --provider discord --pr-file /tmp/pr-notification.json
```

PR 알림에는 소유자/저장소·제목·브랜치·주요 변경·검증별 상태·리뷰할 부분·남은 작업을 표시한다. JSON 작성 예시, 사용자 지정 환경변수, 실패 처리는 [알림 사용법](./docs/notifications.md) 참고. 일반 메시지의 `--message`·`--message-file`도 유지하며 설정 검사와 실제 수신 성공은 구분한다.

## Codex 실행 승인 설정

하네스 구성 시 에이전트가 `기존 설정 유지` / `승인 자동 검토` / `전체 권한` 중 실행 방식을 묻는다. 변경을 선택하면 현재 프로젝트 또는 사용자 전역의 적용 범위도 확인하고 같은 작업에서 설정한다. 이미 선택한 방식과 범위는 갱신 시 유지한다.

자동 검토는 샌드박스를 유지하고 별도 에이전트가 승인 요청을 검토한다. 전체 권한은 명령 승인과 파일·네트워크 샌드박스 제한을 해제한다. 설정 파일 반영과 재시작·프로젝트 신뢰·관리자 정책에 따른 실제 적용은 구분한다. 상세 기준은 [Codex 실행 승인 설정](./docs/main.md#codex-실행-승인-설정) 참고.

## Codex 구독 계정의 이슈·PR 자동화

OpenAI API 키 없이 구독으로 로그인한 Codex CLI를 사용하는 [재사용 템플릿](./skills/repository-harness/assets/codex-subscription/)을 포함한다. 비공개 GitHub 저장소와 로그인 정보를 유지하는 전용 Linux self-hosted runner가 필요하며, 공개 저장소에서는 실행하지 않는다.

이슈 작성 시 구현·검증 후 PR을 만들고, 생성된 PR에 `/codex 수정 요청`을 남기면 같은 PR에 커밋을 추가한다. 쓰기 권한 사용자의 요청만 실행하며 PR 알림은 기존 Discord·Slack 설정을 사용한다.

하네스 최초 구성 시 자동화를 함께 구성할지 묻고, 사용자가 선택하면 같은 작업에서 바로 구성한다. 갱신 시 기록된 선택을 유지하며 선택 기록이 없으면 사용 여부를 확인한다. 배치할 파일, 러너 로그인, GitHub Variables·Secrets와 적용 검증은 [구독 자동화 사용법](./docs/codex-subscription.md) 참고. 스킬 설치만으로 자동 실행되지는 않는다.

구독 자동화는 [프로젝트 설정 양식](./skills/repository-harness/assets/codex-subscription/project.example.json)으로 기존 서버의 CLI·인증·러너·검증 환경을 연결한다. 최초 발행 정책을 확정하고 기존 정책은 보존한다. 구현·검증·push·PR·댓글·알림 상태를 나누며, 선택한 정책에 따라 검증 미완료 변경을 Draft PR로 전달할 수 있다. Draft 전달은 검증 통과나 작업 완료와 구분하며, push 이후 전달 실패는 보존 기록으로 복구한다. 상세 기준은 [자동화 안내](./docs/codex-subscription.md) 참고.

## 기획과 스킬 수정

- 기획·규칙 원본 : [docs/main.md](./docs/main.md)와 `docs/`의 관련 문서
- 에이전트 실행 절차 : [SKILL.md](./skills/repository-harness/SKILL.md)
- 작업 이력과 도메인 정책 작성 규칙 : [문서작성](./docs/document-write.md)
- 배포용 규칙 : `skills/repository-harness/references/rules/` (자동 생성)

기획 문서를 수정한 뒤 아래 명령으로 배포용 규칙을 갱신하고 확인한다. Python 3가 필요하다.

```bash
python3 scripts/build_skill.py
python3 scripts/build_skill.py --check
node tests/notify.test.mjs
node --test tests/codex-subscription.test.mjs
```

`docs/`와 생성된 규칙을 함께 커밋하여 원격 저장소에 반영한다. 설치 시 빌드를 실행하지 않으므로 생성 파일도 저장소에 포함해야 한다.

원격 반영 전에는 임시 대상 프로젝트에서 로컬 저장소로 설치를 확인할 수 있다.

```bash
npx skills add /path/to/repo-harness --skill repository-harness --agent codex -y
```
