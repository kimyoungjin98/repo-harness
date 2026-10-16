import test from "node:test";
import assert from "node:assert/strict";
import { openSync, closeSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrMessage, notify, run } from "../skills/repository-harness/scripts/notify.mjs";

async function runProcess(command, args, { input = "", encoding, ...options }) {
  // File descriptors also work in sandboxes that restrict child-process pipes.
  const dir = await mkdtemp(join(tmpdir(), "notify-process-"));
  const descriptors = [];
  try {
    await writeFile(join(dir, "stdin"), input);
    descriptors.push(openSync(join(dir, "stdin"), "r"),
      openSync(join(dir, "stdout"), "w"), openSync(join(dir, "stderr"), "w"));
    const status = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { ...options, stdio: descriptors });
      child.on("error", reject);
      child.on("close", resolve);
    });
    return { status, stdout: readFileSync(join(dir, "stdout"), encoding),
      stderr: readFileSync(join(dir, "stderr"), encoding) };
  } finally {
    descriptors.forEach(closeSync);
    await rm(dir, { recursive: true, force: true });
  }
}

const discord = "https://discord.com/api/webhooks/123/fake-secret?thread_id=42";
const slack = "https://hooks.slack.com/services/T123/B456/fake-secret";
const env = { DISCORD_WEBHOOK_URL: discord, SLACK_WEBHOOK_URL: slack };
const cli = fileURLToPath(
  new URL("../skills/repository-harness/scripts/notify.mjs", import.meta.url),
);

const prReport = {
  repository: "team/shopping-tool", title: "레포지토리 하네스 구성",
  url: "https://github.com/team/shopping-tool/pull/1", action: "created",
  head: "feature/configure-harness", base: "main",
  summary: ["AGENTS.md에 하네스 규칙 연결", "PR 알림 스크립트 추가"],
  checks: [
    { name: "문서 링크", status: "passed", detail: "관련 링크 12개 확인" },
    { name: "Webhook 수신", status: "not_run", detail: "실제 전송 요청이 없어 미실행" },
    { name: "앱 테스트", status: "not_applicable", detail: "앱 코드 변경 없음" },
  ],
  review: ["프로젝트의 기준 브랜치와 실제 검증 명령 확인"],
  remaining: ["실제 Webhook 수신 검증"],
};

test("PR message identifies repository and separates changes, checks, review, remaining", () => {
  assert.equal(formatPrMessage(prReport), `**[PR 생성] team/shopping-tool #1**
레포지토리 하네스 구성

브랜치: feature/configure-harness → main
PR 링크: https://github.com/team/shopping-tool/pull/1

**변경**
- AGENTS.md에 하네스 규칙 연결
- PR 알림 스크립트 추가

**검증**
- [통과] 문서 링크
  관련 링크 12개 확인

- [미실행] Webhook 수신
  실제 전송 요청이 없어 미실행

- [비적용] 앱 테스트
  앱 코드 변경 없음

**리뷰할 부분**
- 프로젝트의 기준 브랜치와 실제 검증 명령 확인

**남은 작업**
- 실제 Webhook 수신 검증`);
  const updated = structuredClone(prReport);
  updated.action = "updated";
  updated.remaining = [];
  updated.checks.push({ name: "추가 테스트", status: "failed", detail: "원인 확인 필요" });
  assert.match(formatPrMessage(updated), /^\*\*\[PR 갱신\]/);
  assert.match(formatPrMessage(updated), /\[실패\] 추가 테스트/);
  assert.match(formatPrMessage(updated), /남은 작업\*\*\n- 없음$/);
});

test("PR multiline paragraphs survive preview and JSON delivery for Discord and Slack", async () => {
  const report = structuredClone(prReport);
  report.summary = ["첫 번째 변경\r\n  이어지는 설명\n\n다음 문단", "두 번째 변경"];
  report.checks[0].detail = "명령 실행 완료\r\n12개 링크 확인";
  report.review = ["설정 확인\n프로젝트 기준과 비교"];
  report.remaining = ["수신 검증\n요청 후 실행"];
  const dir = await mkdtemp(join(tmpdir(), "notify-pr-lines-"));
  try {
    const path = join(dir, "pr.json");
    await writeFile(path, JSON.stringify(report));
    for (const provider of ["discord", "slack"]) {
      const preview = await run(["--provider", provider, "--pr-file", path, "--preview"]);
      const emphasis = provider === "discord" ? "**" : "*";
      assert.ok(preview.includes(`${emphasis}검증${emphasis}\n`));
      assert.ok(preview.includes("- 첫 번째 변경\n  이어지는 설명\n\n  다음 문단\n- 두 번째 변경"));
      assert.ok(preview.includes("- [통과] 문서 링크\n  명령 실행 완료\n  12개 링크 확인\n\n- [미실행]"));
      assert.ok(preview.includes("- 설정 확인\n  프로젝트 기준과 비교"));
      assert.ok(preview.includes("- 수신 검증\n  요청 후 실행"));
      assert.equal(preview.includes("\\n"), false);
      assert.equal(preview.includes("\r"), false);
      const result = await run(["--provider", provider, "--pr-file", path], {
        env, fetchImpl: async (_url, options) => {
          const payload = JSON.parse(options.body);
          assert.equal(payload[provider === "discord" ? "content" : "text"], preview);
          return new Response(provider === "discord" ? '{"id":"987"}' : "ok", { status: 200 });
        },
      });
      assert.equal(result.sent, true);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("PR message rejects missing context and invalid checks without exposing supplied values", () => {
  for (const field of ["repository", "title", "url", "action", "head", "base", "summary", "checks", "review", "remaining"]) {
    const invalid = structuredClone(prReport);
    delete invalid[field];
    assert.throws(() => formatPrMessage(invalid), /PR|repository|action|검증/);
  }
  for (const change of [
    { repository: "shopping-tool" }, { summary: [] }, { review: [] },
    { checks: [{ name: "test", status: "maybe", detail: "uncertain" }] },
    { checks: [{ name: "test", status: "not_run", detail: "" }] },
    { url: "https://fake-secret@github.com/team/shopping-tool/pull/1" },
    { url: "https://github.com/other/repo/pull/1?fake-secret" },
    { url: "https://github.com/team/shopping-tool/pull/1?access_token=fake-secret" },
  ]) {
    assert.throws(() => formatPrMessage({ ...prReport, ...change }), error => !error.message.includes("fake-secret"));
  }
});

test("PR JSON supports preview, dry-run, delivery, and mutually exclusive message inputs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "notify-pr-"));
  try {
    const path = join(dir, "pr.json");
    await writeFile(path, JSON.stringify(prReport));
    let calls = 0;
    const dependencies = { env, fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(JSON.parse(options.body).content, formatPrMessage(prReport));
      return new Response('{"id":"987"}', { status: 200 });
    } };
    const args = ["--provider", "discord", "--pr-file", path];
    assert.equal(await run([...args, "--preview"], { env: {}, fetchImpl: () => assert.fail("Unexpected network") }), formatPrMessage(prReport));
    assert.equal((await run([...args, "--dry-run"], dependencies)).dryRun, true);
    assert.equal(calls, 0);
    assert.equal((await run(args, dependencies)).sent, true);
    assert.equal(calls, 1);
    await assert.rejects(run([...args, "--message", "a"], dependencies), /하나만/);
    await assert.rejects(run([...args, "--preview", "--dry-run"], dependencies), /하나만/);
    await writeFile(path, '{"fake-secret":');
    await assert.rejects(run([...args, "--dry-run"], dependencies), error => error.message.includes("JSON") && !error.message.includes("fake-secret"));
    assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("PR preview through stdin is readable without a Webhook and respects service length", async () => {
  const result = await runProcess(process.execPath,
    [cli, "--provider", "discord", "--pr-file", "-", "--preview"],
    { env: { ...process.env, DISCORD_WEBHOOK_URL: "" }, input: JSON.stringify(prReport), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), formatPrMessage(prReport));
  const dir = await mkdtemp(join(tmpdir(), "notify-pr-long-"));
  try {
    const path = join(dir, "pr.json");
    await writeFile(path, JSON.stringify({ ...prReport, summary: ["가".repeat(2100)] }));
    await assert.rejects(run(["--provider", "discord", "--pr-file", path, "--preview"]), /2000자/);
    const message = await run(["--provider", "slack", "--pr-file", path, "--preview"]);
    assert.match(message, /가{2100}/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Discord sends Korean multiline JSON once and waits for confirmation", async () => {
  let calls = 0;
  const message = "PR 생성\nhttps://example.com/pull/1\n검증: 통과 @everyone";
  const result = await notify(
    { provider: "discord", message },
    {
      env,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url.searchParams.get("wait"), "true");
        assert.equal(url.searchParams.get("thread_id"), "42");
        assert.equal(options.method, "POST");
        assert.equal(options.redirect, "error");
        assert.deepEqual(JSON.parse(options.body), {
          content: message,
          allowed_mentions: { parse: [] },
        });
        return new Response('{"id":"987"}', { status: 200 });
      },
    },
  );
  assert.deepEqual(result, { provider: "discord", sent: true });
  assert.equal(calls, 1);
});

test("Slack sends text with custom environment variable and requires ok", async () => {
  const result = await notify(
    { provider: "slack", message: "검증 통과", webhookEnv: "TEAM_HOOK" },
    {
      env: { TEAM_HOOK: slack },
      fetchImpl: async (url, options) => {
        assert.equal(url.href, slack);
        assert.deepEqual(JSON.parse(options.body), { text: "검증 통과" });
        return new Response("ok", { status: 200 });
      },
    },
  );
  assert.equal(result.sent, true);
});

test("dry-run validates settings without network or secret output", async () => {
  const result = await notify(
    { provider: "slack", message: "준비 확인", dryRun: true },
    {
      env,
      fetchImpl: () => {
        throw new Error("Must not send");
      },
    },
  );
  assert.equal(result.dryRun, true);
  assert.ok(!JSON.stringify(result).includes("fake-secret"));
});

test("invalid input never makes a request", async () => {
  const cases = [
    [{ provider: "other", message: "a" }, env],
    [{ provider: "constructor", message: "a" }, env],
    [{ provider: "discord", message: " " }, env],
    [{ provider: "discord", message: "a".repeat(2001) }, env],
    [{ provider: "slack", message: "a".repeat(4001) }, env],
    [{ provider: "slack", message: "a", timeoutMs: NaN }, env],
    [{ provider: "slack", message: "a" }, {}],
    [{ provider: "slack", message: "a" }, { SLACK_WEBHOOK_URL: discord }],
    [
      { provider: "slack", message: "a" },
      {
        SLACK_WEBHOOK_URL:
          "https://hooks.slack.com.evil.example/services/T/B/fake-secret",
      },
    ],
    [
      { provider: "slack", message: "a" },
      { SLACK_WEBHOOK_URL: slack.replace("https:", "http:") },
    ],
  ];
  for (const [options, values] of cases) {
    await assert.rejects(
      notify(options, {
        env: values,
        fetchImpl: () => assert.fail("Unexpected network request"),
      }),
    );
  }
});

test("HTTP errors redact response and do not retry", async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    let calls = 0;
    await assert.rejects(
      notify(
        { provider: "slack", message: "a" },
        {
          env,
          fetchImpl: async () => {
            calls++;
            return new Response(slack, { status });
          },
        },
      ),
      (error) =>
        error.message.includes(`HTTP ${status}`) &&
        !error.message.includes("fake-secret"),
    );
    assert.equal(calls, 1);
  }
});

test("unconfirmed 2xx and network errors never report success or expose URLs", async () => {
  for (const provider of ["slack", "discord"]) {
    await assert.rejects(
      notify(
        { provider, message: "a" },
        {
          env,
          fetchImpl: async () =>
            new Response("unexpected fake-secret", { status: 200 }),
        },
      ),
      /수신 여부/,
    );
  }
  await assert.rejects(
    notify(
      { provider: "slack", message: "a" },
      {
        env,
        fetchImpl: async () => {
          throw new Error(`failed ${slack}`);
        },
      },
    ),
    (error) =>
      !error.message.includes("fake-secret") &&
      error.message.includes("미확정"),
  );
});

test("request timeout aborts without retrying", async () => {
  let calls = 0;
  await assert.rejects(
    notify(
      { provider: "slack", message: "a", timeoutMs: 5 },
      {
        env,
        fetchImpl: (_url, { signal }) => {
          calls++;
          return new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(new Error(slack)), {
              once: true,
            }),
          );
        },
      },
    ),
    /시간 초과/,
  );
  assert.equal(calls, 1);
});

test("message-file and conflicting CLI options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "notify-test-"));
  try {
    const file = join(dir, "message.txt");
    await writeFile(file, "PR 생성\n검증 완료");
    const result = await run(
      ["--provider", "slack", "--message-file", file, "--dry-run"],
      { env },
    );
    assert.equal(result.dryRun, true);
    await assert.rejects(
      run(["--provider", "slack", "--message", "a", "--message-file", file], {
        env,
      }),
      /하나만/,
    );
    await assert.rejects(
      run(["--provider", "slack", "--message-file", join(dir, "missing")], {
        env,
      }),
      /읽을 수/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI exits correctly, supports stdin, and hides secrets on failure", async () => {
  const success = await runProcess(
    process.execPath,
    [cli, "--provider", "slack", "--message-file", "-", "--dry-run"],
    {
      env: { ...process.env, ...env },
      input: "알림\nPR 링크",
      encoding: "utf8",
    },
  );
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).dryRun, true);
  const failure = await runProcess(
    process.execPath,
    [cli, "--provider", "slack", "--message", "a"],
    {
      env: { ...process.env, SLACK_WEBHOOK_URL: "fake-secret" },
      encoding: "utf8",
    },
  );
  assert.equal(failure.status, 1);
  assert.ok(!(failure.stdout + failure.stderr).includes("fake-secret"));
});

test("CLI runs through an installed symbolic link", async () => {
  const dir = await mkdtemp(join(tmpdir(), "notify-link-"));
  try {
    const link = join(dir, "notify.mjs");
    await symlink(cli, link);
    const result = await runProcess(process.execPath,
      [link, "--provider", "discord", "--message", "확인", "--dry-run"],
      { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).dryRun, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
