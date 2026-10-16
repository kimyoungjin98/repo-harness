import test from "node:test";
import assert from "node:assert/strict";
import { openSync, closeSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { notify, run } from "../skills/repository-harness/scripts/notify.mjs";

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
