import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { agentEnvironment, authorize, request, run } from '../skills/repository-harness/assets/codex-subscription/automation.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const missing = () => { throw Object.assign(new Error('Not found'), { status: 404 }); };

function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), 'codex-template-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'repo');
  const remote = join(directory, 'remote.git');
  const home = join(directory, 'auth');
  const runnerTemp = join(directory, 'runner');
  const bin = join(directory, 'bin');
  for (const path of [root, home, runnerTemp, bin]) mkdirSync(path);
  git(directory, 'init', '--bare', remote);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  mkdirSync(join(root, 'scripts'));
  // Exercise the real formatter and CLI with simulated delivery, never a Webhook.
  const notifyModule = new URL('../skills/repository-harness/scripts/notify.mjs', import.meta.url).href;
  writeFileSync(join(root, 'scripts/harness-notify.mjs'), `
import { run } from ${JSON.stringify(notifyModule)};
import { readFileSync, writeFileSync } from 'node:fs';
if (process.env.FAIL_NOTIFY) process.exit(1);
const args = process.argv.slice(2);
writeFileSync(process.env.NOTIFICATION_CAPTURE, readFileSync(args[args.indexOf('--pr-file') + 1]));
await run(args, { env: process.env, fetchImpl: async () => new Response('{"id":"fake-id"}', {status:200}) });
`);
  writeFileSync(join(root, 'README.md'), 'initial\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'Initial');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-u', 'origin', 'main');
  writeFileSync(join(home, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { refresh_token: 'fake-refresh' } }));
  writeFileSync(join(bin, 'codex'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.PROMPT_CAPTURE, fs.readFileSync(0, 'utf8'));
if (process.env.OPENAI_API_KEY || process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.DISCORD_WEBHOOK_URL) process.exit(33);
if (!process.env.NO_CHANGE) fs.writeFileSync(process.env.PROTECTED_CHANGE ? '.github/codex/changed.txt' : 'change.txt', process.env.CHANGE_TEXT || 'implemented');
if (process.env.FAIL_CODEX) process.exit(1);
if (process.env.RACE_SHA) require('node:child_process').execFileSync('git', ['--git-dir=' + process.env.TEST_REMOTE, 'update-ref', 'refs/heads/feature/codex-issue-7', process.env.RACE_SHA]);
fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({status: process.env.BLOCKED ? 'blocked' : 'ready', summary:'작업 요약', validation:'검증 결과', remaining:'없음', checks:[{name:'관련 테스트',status:process.env.CHECKS_FAILED ? 'failed' : 'passed',detail:'1건 검사'}],review:['변경 파일의 기대 동작 확인']}));
`);
  chmodSync(join(bin, 'codex'), 0o755);
  const issue = { number: 7, state: 'open', title: 'Task $(touch escaped)', body: 'Implement this', html_url: 'https://github.com/test/repo/issues/7' };
  const context = { repo: { owner: 'test', repo: 'repo' }, runId: 91, eventName: 'issues',
    payload: { action: 'opened', repository: { id: 9, private: true, default_branch: 'main', full_name: 'test/repo' },
      sender: { login: 'author', type: 'User' }, issue: { number: 7 } } };
  const state = { permission: 'write', private: true, prs: [], comments: [], created: [], failures: [] };
  const github = {
    rest: {
      repos: {
        get: async () => ({ data: { private: state.private } }),
        getCollaboratorPermissionLevel: async () => ({ data: { permission: state.permission } }),
        getBranch: async ({ branch }) => {
          try { return { data: { commit: { sha: git(remote, 'rev-parse', `refs/heads/${branch}`) } } }; }
          catch { return missing(); }
        },
      },
      issues: {
        get: async ({ issue_number }) => ({ data: issue_number === 7 ? issue : { ...state.prs[0], pull_request: {} } }),
        listComments: async () => {},
        createComment: async data => { state.comments.push({ ...data, user: { login: 'github-actions[bot]' } }); },
      },
      pulls: {
        list: async () => ({ data: state.prs }),
        get: async () => ({ data: { ...state.prs[0], head: { ...state.prs[0].head,
          sha: git(remote, 'rev-parse', `refs/heads/${state.prs[0].head.ref}`) } } }),
        create: async data => {
          if (state.failCreate) throw new Error('모의 PR 생성 오류');
          const pr = { number: 13, state: 'open', title: data.title, body: data.body, html_url: 'https://github.com/test/repo/pull/13',
            head: { ref: data.head, repo: { full_name: 'test/repo' } }, base: { ref: data.base } };
          state.prs.push(pr); state.created.push(data); return { data: pr };
        },
      },
    },
    paginate: async () => state.comments,
  };
  const core = { info() {}, setFailed: message => state.failures.push(message), getInput: () => 'fake-github-token',
    summary: { addRaw() { return this; }, async write() {} } };
  const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CODEX_HOME: home, GITHUB_WORKSPACE: root,
    RUNNER_TEMP: runnerTemp, CODEX_VERIFY_COMMAND: 'test -f change.txt', CODEX_NOTIFY_PROVIDER: 'discord',
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/fake', OPENAI_API_KEY: 'must-not-be-used',
    GITHUB_TOKEN: 'must-not-reach-agent', INPUT_GITHUB_TOKEN: 'must-not-reach-agent', PROMPT_CAPTURE: join(directory, 'prompt.txt'),
    NOTIFICATION_CAPTURE: join(directory, 'notification.json') };
  for (const key of ['NO_CHANGE', 'FAIL_CODEX', 'BLOCKED', 'FAIL_NOTIFY', 'PROTECTED_CHANGE']) delete environment[key];
  return { root, remote, home, runnerTemp, directory, issue, context, github, core, state, environment };
}

test('공개 저장소·봇·일반 코멘트·읽기 권한 요청을 거부', async t => {
  const s = setup(t);
  assert.equal(await authorize(s.github, s.context), true);
  s.context.payload.repository.private = false;
  assert.equal(await authorize(s.github, s.context), false);
  s.context.payload.repository.private = true;
  s.state.private = false;
  assert.equal(await authorize(s.github, s.context), false);
  s.state.private = true;
  s.context.payload.sender.type = 'Bot';
  assert.equal(await authorize(s.github, s.context), false);
  s.context.payload.sender.type = 'User';
  s.state.permission = 'read';
  assert.equal(await authorize(s.github, s.context), false);
  s.state.permission = 'write';
  s.context.eventName = 'issue_comment';
  s.context.payload.action = 'created';
  s.context.payload.comment = { id: 1, body: 'hello /codex do something' };
  assert.equal(await authorize(s.github, s.context), false);
  s.context.payload.comment.body = '/codex do something';
  assert.equal(await authorize(s.github, s.context), true);
});

test('이슈에서 PR 생성, 완료 이벤트 재실행 생략, 후속 코멘트에서 같은 PR 수정', async t => {
  const s = setup(t);
  await run(s.github, s.context, s.core, s.environment);
  assert.deepEqual(s.state.failures, []);
  assert.equal(s.state.created.length, 1);
  const firstReport = JSON.parse(readFileSync(s.environment.NOTIFICATION_CAPTURE, 'utf8'));
  assert.equal(firstReport.repository, 'test/repo');
  assert.equal(firstReport.action, 'created');
  assert.equal(firstReport.head, 'feature/codex-issue-7');
  assert.equal(firstReport.base, 'main');
  assert.deepEqual(firstReport.checks.at(-1), {name:s.environment.CODEX_VERIFY_COMMAND,status:'passed',detail:'PR 반영 직전 자동화 재검증 통과'});
  assert.match(s.state.created[0].body, /Closes #7/);
  assert.equal(git(s.remote, 'show', 'feature/codex-issue-7:change.txt'), 'implemented');
  assert.equal(git(s.root, 'branch', '--show-current'), 'main');
  assert.equal(existsSync(join(s.root, 'escaped')), false);
  await run(s.github, s.context, s.core, s.environment);
  assert.equal(s.state.comments.length, 1);
  const previous = git(s.remote, 'rev-parse', 'feature/codex-issue-7');
  s.context.eventName = 'issue_comment';
  s.context.payload.action = 'created';
  s.context.payload.issue = { number: 13, pull_request: {} };
  s.context.payload.comment = { id: 30, body: '/codex second change' };
  s.environment.CHANGE_TEXT = 'second';
  await run(s.github, s.context, s.core, s.environment);
  assert.deepEqual(s.state.failures, []);
  assert.equal(s.state.created.length, 1);
  assert.equal(git(s.remote, 'show', 'feature/codex-issue-7:change.txt'), 'second');
  assert.equal(JSON.parse(readFileSync(s.environment.NOTIFICATION_CAPTURE, 'utf8')).action, 'updated');
  assert.equal(git(s.remote, 'rev-parse', 'feature/codex-issue-7^'), previous);
  assert.match(readFileSync(s.environment.PROMPT_CAPTURE, 'utf8'), /originalIssue/);
});

test('PR 요청에 원본 이슈를 포함하고 fork와 종료된 PR 차단', async t => {
  const s = setup(t);
  await run(s.github, s.context, s.core, s.environment);
  s.context.eventName = 'issue_comment';
  s.context.payload.action = 'created';
  s.context.payload.issue = { number: 13, pull_request: {} };
  s.context.payload.comment = { id: 40, body: '/codex fix change.txt' };
  const task = await request(s.github, s.context);
  assert.equal(task.context.trigger.body, '/codex fix change.txt');
  assert.equal(task.context.originalIssue.number, 7);
  s.state.prs[0].head.repo.full_name = 'other/repo';
  await assert.rejects(request(s.github, s.context), /같은 저장소/);
  s.state.prs[0].head.repo.full_name = 'test/repo';
  s.state.prs[0].state = 'closed';
  await assert.rejects(request(s.github, s.context), /닫힌/);
});

for (const mode of ['verification', 'blocked', 'reported-failure', 'codex', 'auth']) {
  test(`${mode} 실패 시 publish 없이 작업 상태 보존`, async t => {
    const s = setup(t);
    if (mode === 'verification') s.environment.CODEX_VERIFY_COMMAND = 'exit 1';
    if (mode === 'blocked') s.environment.BLOCKED = '1';
    if (mode === 'reported-failure') s.environment.CHECKS_FAILED = '1';
    if (mode === 'codex') s.environment.FAIL_CODEX = '1';
    if (mode === 'auth') writeFileSync(join(s.home, 'auth.json'), '{"OPENAI_API_KEY":"fake-secret"}');
    await run(s.github, s.context, s.core, s.environment);
    assert.equal(s.state.failures.length, 1);
    assert.equal(s.state.created.length, 0);
    assert.throws(() => git(s.remote, 'rev-parse', 'feature/codex-issue-7'));
    if (mode !== 'auth') assert.equal(existsSync(join(s.runnerTemp, 'codex-work-9/feature-codex-issue-7/change.txt')), true);
    assert.doesNotMatch(JSON.stringify(s.state), /fake-secret|fake-refresh|must-not-reach-agent/);
  });
}

test('push 후 PR 생성 실패는 다음 요청에서 복구', async t => {
  const s = setup(t);
  s.state.failCreate = true;
  await run(s.github, s.context, s.core, s.environment);
  assert.equal(s.state.failures.length, 1);
  assert.equal(git(s.remote, 'show', 'feature/codex-issue-7:change.txt'), 'implemented');
  s.state.failCreate = false;
  s.state.failures = [];
  s.context.runId++;
  s.environment.NO_CHANGE = '1';
  await run(s.github, s.context, s.core, s.environment);
  assert.deepEqual(s.state.failures, []);
  assert.equal(s.state.created.length, 1);
});

test('변경 없는 새 작업은 PR이나 커밋을 만들지 않음', async t => {
  const s = setup(t);
  s.environment.NO_CHANGE = '1';
  s.environment.CODEX_VERIFY_COMMAND = 'test -f README.md';
  await run(s.github, s.context, s.core, s.environment);
  assert.deepEqual(s.state.failures, []);
  assert.equal(s.state.created.length, 0);
  assert.match(s.state.comments[0].body, /추가 변경 없음/);
});

test('동시 원격 수정은 일반 push가 거부하고 변경을 보존', async t => {
  const s = setup(t);
  git(s.root, 'switch', '-c', 'race');
  writeFileSync(join(s.root, 'race.txt'), 'another user');
  git(s.root, 'add', '.'); git(s.root, 'commit', '-m', 'Concurrent work');
  git(s.root, 'push', 'origin', 'race');
  s.environment.RACE_SHA = git(s.root, 'rev-parse', 'HEAD');
  s.environment.TEST_REMOTE = s.remote;
  git(s.root, 'switch', 'main');
  await run(s.github, s.context, s.core, s.environment);
  assert.match(s.state.failures[0], /git push/);
  assert.equal(s.state.created.length, 0);
  assert.equal(git(s.remote, 'show', 'feature/codex-issue-7:race.txt'), 'another user');
  assert.equal(existsSync(join(s.runnerTemp, 'codex-work-9/feature-codex-issue-7/change.txt')), true);
});

test('알림 실패는 PR 성공과 구분하고 이벤트 재실행으로 중복 전송하지 않음', async t => {
  const s = setup(t);
  s.environment.FAIL_NOTIFY = '1';
  await run(s.github, s.context, s.core, s.environment);
  assert.equal(s.state.created.length, 1);
  assert.match(s.state.failures[0], /PR 반영 성공, 알림 실패/);
  await run(s.github, s.context, s.core, s.environment);
  assert.equal(s.state.created.length, 1);
  assert.equal(s.state.comments.length, 1);
});

test('자동화 제어 파일 변경은 publish 전에 차단', async t => {
  const s = setup(t);
  // Existing tracked directory, as it would be in an installed repository.
  mkdirSync(join(s.root, '.github/codex'), { recursive: true });
  writeFileSync(join(s.root, '.github/codex/control.txt'), 'trusted');
  git(s.root, 'add', '.'); git(s.root, 'commit', '-m', 'Automation'); git(s.root, 'push');
  s.environment.PROTECTED_CHANGE = '1';
  s.environment.CODEX_VERIFY_COMMAND = 'true';
  await run(s.github, s.context, s.core, s.environment);
  assert.match(s.state.failures[0], /자동화 파일 변경/);
  assert.equal(s.state.created.length, 0);
});

test('Codex 환경에서 GitHub·API·입력 secret을 제거하고 인증 경로는 유지', () => {
  assert.deepEqual(agentEnvironment({ PATH: '/bin', CODEX_HOME: '/private/codex', INPUT_GITHUB_TOKEN: 'x',
    GITHUB_TOKEN: 'x', CODEX_API_KEY: 'x', CUSTOM_SECRET: 'x', SLACK_WEBHOOK_URL: 'x', GIT_CONFIG_VALUE_0: 'x' }),
  { PATH: '/bin', CODEX_HOME: '/private/codex' });
});
