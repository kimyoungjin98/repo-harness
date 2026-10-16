# Discord·Slack 알림

## 전송 준비

- Discord 또는 Slack 중 사용할 서비스의 incoming Webhook과 전송 대상·권한을 확인
- 기존 전송 명령이나 자동화가 있으면 유지. 없으면 스킬에 포함된 `scripts/notify.mjs`를 대상 프로젝트의 `scripts/harness-notify.mjs`로 복사하여 사용
- 기본 스크립트는 Node.js 20 이상 필요. 별도 npm 패키지 설치는 불필요
- Discord는 `DISCORD_WEBHOOK_URL`, Slack은 `SLACK_WEBHOOK_URL` 환경변수 사용. 기존 설정 이름은 `--webhook-env 이름`으로 지정
- URL은 기존 비밀정보 관리 방식으로 실행 환경에 주입. 스크립트가 `.env`를 자동으로 읽지는 않음
- URL 원문을 명령 인자, 문서, 작업 이력에 기록하지 않음. `project.md`에는 서비스, 대상, 환경변수 이름, 실제 전송 명령과 권한만 기록

## 설정 확인

대상 프로젝트 루트에서 실행한다. 복사 전 준비 확인은 설치된 스킬의 `scripts/notify.mjs` 경로로 실행한다.

```bash
node scripts/harness-notify.mjs --provider discord --message "연동 설정 확인" --dry-run
```

- Slack은 `--provider slack` 사용
- `--dry-run`은 환경변수·URL 형식·본문만 검사하며 네트워크 요청을 보내지 않음
- 성공해도 인증 유효성이나 실제 수신 성공을 확인한 것은 아님. 전송 대상·권한은 별도 근거로 확인하고 실제 전송 검증 여부를 구분하여 기록
- 시험 전송은 사용자 요청과 실행 환경의 권한을 확인한 경우에만 진행

## PR 알림 전송

PR 생성 후 링크와 검증 결과를 UTF-8 파일로 작성한다. 외부 입력을 셸 명령 문자열에 직접 삽입하지 않고 파일로 전달한다.

```text
PR: 작업 제목
링크: 실제 PR URL
변경: 주요 변경 내용
검증: 실행한 명령과 결과
남음: 미실행 항목 또는 없음
```

작성한 파일 경로를 지정하여 선택한 서비스에 한 번 전송한다.

```bash
node scripts/harness-notify.mjs --provider discord --message-file /tmp/pr-notification.txt
```

- Slack은 위 명령의 `discord`를 `slack`으로 변경
- 짧은 본문은 `--message "메시지"`, 표준 입력은 `--message-file -` 사용. 두 옵션 중 하나만 지정
- 성공은 종료 코드 `0`과 `sent: true`로 확인. `dryRun: true`는 실제 전송 성공과 구분
- 오류는 종료 코드 `1`. PR 생성 성공과 알림 실패를 구분하여 보고

## 전송 기준과 실패 처리

- Discord는 `wait=true`로 전송 확인 응답을 요청하고 메시지 ID를 확인. 자동 멘션은 비활성화
- Slack은 HTTP 200과 `ok` 응답을 확인. 본문의 명시적 멘션은 서비스에서 해석될 수 있으므로 전송 전 확인
- 스크립트의 본문 제한은 Discord 2,000자, Slack 4,000자(JavaScript 문자열 길이 기준). 초과하면 실패하며 임의로 자르거나 여러 번 나누어 보내지 않음
- 기본 제한 시간은 10초. `--timeout-ms`로 1~60,000ms 사이 정수 지정 가능
- HTTP 오류, 429 요청 제한, 시간 초과는 자동 재시도하지 않음. 응답을 받지 못해도 메시지가 전달되었을 수 있으므로 채널 수신 여부와 서비스의 대기 시간을 확인한 뒤 재전송
- 공식 서비스의 HTTPS Webhook만 허용하고 리다이렉트를 따라가지 않음. 오류 응답 본문이나 URL을 로그에 출력하지 않음

API 기준: [Discord Execute Webhook](https://discord.com/developers/docs/resources/webhook#execute-webhook), [Slack Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).
