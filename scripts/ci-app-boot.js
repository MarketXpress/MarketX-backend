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
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const PORT = process.env.PORT ?? '3000';
const HOST = '127.0.0.1';
const BOOT_TIMEOUT_MS = Number(process.env.BOOT_TIMEOUT_MS ?? 90_000);
const POLL_INTERVAL_MS = 1_000;

// Dynamically locate main.js inside dist/ recursively to prevent path mismatch errors
function findMainJs(dir) {
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = findMainJs(fullPath);

      if (found) return found;
    } else if (entry.name === 'main.js') {
      return fullPath;
    }
  }

  return null;
}

const entry = findMainJs(path.resolve(__dirname, '..', 'dist'));

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
  if (!entry) {
    dumpAndFail(
      'Could not find compiled main.js in dist/ directory. Did you run "npm run build"?',
    );
  }

  console.log(`Booting ${entry} on port ${PORT}...`);

  /**
   * The smoke test should be able to boot without requiring a real
   * production JWT secret. Preserve an explicitly supplied JWT_SECRET,
   * otherwise generate an ephemeral secret for this child process only.
   */
  const childEnv = {
    ...process.env,
    JWT_SECRET:
      process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex'),
  };

  child = spawn(process.execPath, [entry], {
    env: childEnv,
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