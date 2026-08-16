#!/usr/bin/env node
/**
 * Full application boot smoke test.
 *
 * Starts the built application and asserts that it actually comes up:
 *
 *   1. `/health/live` must return 200 — proves Nest resolved the whole
 *      dependency graph and is serving HTTP.
 *   2. `/health` must return 200 — proves the database connection and schema
 *      are usable, which is the DI/schema breakage this test exists to catch.
 *
 * Exits non-zero if the process dies during boot, if either probe never
 * succeeds within the timeout, or if the app exits on its own.
 *
 * This replaces `timeout 30 node dist/main.js || true`, which swallowed every
 * exit code and could not fail.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = process.env.PORT ?? '3000';
const HOST = '127.0.0.1';
const BOOT_TIMEOUT_MS = Number(process.env.BOOT_TIMEOUT_MS ?? 90_000);
const POLL_INTERVAL_MS = 1_000;

const entry = path.resolve(__dirname, '..', 'dist', 'main.js');

/** Collected child output, replayed only when something goes wrong. */
const output = [];
let child;
let exited = null;

function record(stream, chunk) {
  const text = chunk.toString();
  output.push(text);
  process.stdout.write(`[app:${stream}] ${text}`);
}

function dumpAndFail(reason) {
  console.error(`\n✗ App boot smoke test FAILED: ${reason}\n`);
  if (output.length > 0) {
    console.error('----- application output -----');
    console.error(output.join(''));
    console.error('------------------------------');
  } else {
    console.error('(the application produced no output at all)');
  }
  stopChild();
  process.exit(1);
}

function stopChild() {
  if (child && exited === null) {
    child.kill('SIGTERM');
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe(pathname) {
  try {
    const response = await fetch(`http://${HOST}:${PORT}${pathname}`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.status;
  } catch {
    return null;
  }
}

/** Poll `pathname` until it returns 200, the deadline passes, or the app dies. */
async function waitForOk(pathname, deadline) {
  let lastStatus = null;

  while (Date.now() < deadline) {
    if (exited !== null) {
      dumpAndFail(
        `the application exited with code ${exited} before ${pathname} responded`,
      );
    }

    const status = await probe(pathname);
    if (status === 200) return;
    if (status !== null) lastStatus = status;

    await sleep(POLL_INTERVAL_MS);
  }

  dumpAndFail(
    lastStatus === null
      ? `${pathname} never accepted a connection within ${BOOT_TIMEOUT_MS}ms`
      : `${pathname} returned ${lastStatus}, expected 200, within ${BOOT_TIMEOUT_MS}ms`,
  );
}

async function main() {
  console.log(`Booting ${entry} on port ${PORT}...`);

  child = spawn(process.execPath, [entry], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (c) => record('out', c));
  child.stderr.on('data', (c) => record('err', c));

  child.on('error', (err) => dumpAndFail(`failed to spawn: ${err.message}`));
  child.on('exit', (code, signal) => {
    exited = code ?? `signal ${signal}`;
  });

  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  await waitForOk('/health/live', deadline);
  console.log('✓ /health/live responded 200 — application is serving HTTP');

  await waitForOk('/health', deadline);
  console.log('✓ /health responded 200 — database connection is healthy');

  console.log('\n✓ App boot smoke test PASSED');
  stopChild();
  process.exit(0);
}

main().catch((err) => dumpAndFail(err?.stack ?? String(err)));
