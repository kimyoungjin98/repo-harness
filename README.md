# Repository Harness

프로젝트의 기존 기술과 규칙을 분석하여 AGENTS.md와 하네스 문서를 구성하는 스킬.

## 준비물

- 설치 : Node.js와 npm/npx, Git CLI, 저장소에 접근 가능한 네트워크
- 실행 : 사용할 AI Agent CLI와 필요한 계정 인증, 대상 프로젝트의 파일 쓰기 권한
- 원격 작업과 PR : Git 원격 인증과 호스팅 서비스의 PR 생성 권한
- 알림 : Discord 또는 Slack Webhook 설정과 전송 권한
- 기획 수정 및 배포 : Python 3와 이 저장소. 배포된 스킬을 사용하는 사람은 Python이나 원본 저장소가 필요하지 않음

문서 구성만 요청한 경우 원격 작업과 알림의 미준비 상태를 기록하고 구성할 수 있다. 전체 워크플로우 실행 전에는 각 단계에 필요한 준비물을 갖춰야 한다. 상세 기준은 [시작하기 전](./docs/main.md#시작하기-전) 참고.

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

구형 설치는 프로젝트별 수정 보존을 확인한 뒤 기준 사본을 제거하는 구조로 전환한다. 스킬 업데이트만으로 대상 프로젝트의 기존 파일이 변경되는 것은 아니다.

## 기획과 스킬 수정

- 기획·규칙 원본 : [docs/main.md](./docs/main.md)와 `docs/`의 관련 문서
- 에이전트 실행 절차 : [SKILL.md](./skills/repository-harness/SKILL.md)
- 작업 이력과 도메인 정책 작성 규칙 : [문서작성](./docs/document-write.md)
- 배포용 규칙 : `skills/repository-harness/references/rules/` (자동 생성)

기획 문서를 수정한 뒤 아래 명령으로 배포용 규칙을 갱신하고 확인한다. Python 3가 필요하다.

```bash
python3 scripts/build_skill.py
python3 scripts/build_skill.py --check
```

`docs/`와 생성된 규칙을 함께 커밋하여 원격 저장소에 반영한다. 설치 시 빌드를 실행하지 않으므로 생성 파일도 저장소에 포함해야 한다.

원격 반영 전에는 임시 대상 프로젝트에서 로컬 저장소로 설치를 확인할 수 있다.

```bash
npx skills add /path/to/repo-harness --skill repository-harness --agent codex -y
```
